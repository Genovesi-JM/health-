"""Move a patient's reservation without surrendering it before the new claim.

Only the same clinician and service country are supported. Every successful move
returns to requested, so a previous acceptance never approves a different time.
"""
from datetime import datetime
import hashlib
import hmac
import json
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import update

from app.health_models import (
    AppointmentSlot, Consultation, ConsultationReschedule, HealthAuditLog,
    TeleconsultationParticipant, TeleconsultationSession,
)
from app.services.appointments import MARKET_ZONES, current_doctor, ensure_capacity, lock_resources
from app.services.notifications import enqueue_notification


def _not_committed(message):
    return HTTPException(409, {"code": "reschedule_not_committed", "request_key_committed": False, "message": message})


def reschedule(db, consultation, body, patient, user, key):
    try:
        key = str(UUID(key))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(422, "Indique uma chave UUID para alterar ou recuperar este horário.") from None
    digest = hashlib.sha256(json.dumps(body.model_dump(), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    doctor_id, patient_id, consultation_id = consultation.doctor_id, consultation.patient_id, consultation.id
    if patient_id != patient.id:
        raise HTTPException(404, "Consulta não encontrada.")
    try:
        lock_resources(db, doctor_id, patient_id)
        db.refresh(consultation)
        previous = db.query(ConsultationReschedule).filter_by(consultation_id=consultation_id, request_key=key).first()
        if previous:
            if previous.actor_user_id != user.id or not hmac.compare_digest(previous.request_digest, digest):
                raise HTTPException(409, "Esta chave já foi usada com outra alteração. Recupere o pedido original.")
            return consultation
        from app.rbac import require_consents
        require_consents(patient, db)
        if consultation.reschedule_revision != body.expected_revision:
            raise _not_committed("O horário mudou noutra sessão. Atualize a consulta antes de escolher novamente.")
        if consultation.status not in ("requested", "scheduled"):
            raise _not_committed("Esta consulta já não permite alterar o horário.")
        if consultation.started_at or consultation.ended_at:
            raise _not_committed("Existem registos de cuidados iniciados. A consulta requer revisão antes de alterar o horário.")
        session = db.query(TeleconsultationSession).filter_by(consultation_id=consultation_id).populate_existing().first()
        participants = db.query(TeleconsultationParticipant).filter_by(session_id=session.id).populate_existing().all() if session else []
        if session and (session.status not in ("scheduled", "waiting") or session.started_at or session.ended_at
                        or any(person.joined_at or person.left_at for person in participants)):
            raise _not_committed("Existem registos de uma teleconsulta iniciada. A consulta requer revisão antes de alterar o horário.")
        if not doctor_id or consultation.doctor_id != doctor_id or consultation.country not in MARKET_ZONES:
            raise _not_committed("A alteração requer um médico e país de atendimento definidos.")
        if consultation.payment_status == "paid" or consultation.payment_id:
            raise _not_committed("Esta consulta requer apoio para rever o pagamento antes de alterar o horário.")
        doctor = current_doctor(db, doctor_id, consultation.country)
        slot = db.get(AppointmentSlot, body.slot_id, populate_existing=True)
        if not slot or slot.doctor_id != doctor_id or slot.country != consultation.country:
            raise _not_committed("Escolha um horário publicado pelo mesmo médico no mesmo país.")
        if slot.timezone not in MARKET_ZONES[consultation.country]:
            raise _not_committed("O fuso horário precisa de ser revisto antes da marcação.")
        if slot.id == consultation.slot_id:
            raise _not_committed("Escolha um horário diferente do atual.")
        if slot.withdrawn or slot.reserved_consultation_id or slot.starts_at <= datetime.utcnow():
            raise _not_committed("Este horário já não está disponível. A marcação anterior foi mantida.")
        try:
            ensure_capacity(db, doctor_id=doctor_id, patient_id=patient_id, start=slot.starts_at,
                            end=slot.ends_at, exclude_id=consultation_id)
        except HTTPException as error:
            if error.status_code == 409:
                raise _not_committed("O médico ou paciente já tem uma consulta neste horário. A marcação anterior foi mantida.") from None
            raise
        old_slot_id, old_status = consultation.slot_id, consultation.status
        if old_slot_id:
            old_slot = db.get(AppointmentSlot, old_slot_id, populate_existing=True)
            if not old_slot or old_slot.reserved_consultation_id != consultation_id:
                raise _not_committed("A reserva atual precisa de verificação. Atualize a consulta ou contacte o apoio.")
        slots = AppointmentSlot.__table__
        claimed = db.execute(update(slots).where(slots.c.id == slot.id, slots.c.withdrawn.is_(False),
                            slots.c.reserved_consultation_id.is_(None)).values(reserved_consultation_id=consultation_id))
        if claimed.rowcount != 1:
            raise _not_committed("O horário acabou de ser reservado. A marcação anterior foi mantida.")
        revision = consultation.reschedule_revision + 1
        row = ConsultationReschedule(consultation_id=consultation_id, revision=revision, request_key=key,
            request_digest=digest, actor_user_id=user.id, previous_slot_id=old_slot_id,
            slot_id=slot.id, previous_status=old_status)
        db.add(row)
        changed = db.execute(update(Consultation.__table__).where(
            Consultation.id == consultation_id, Consultation.status == old_status,
            Consultation.reschedule_revision == body.expected_revision,
            Consultation.doctor_id == doctor_id, Consultation.patient_id == patient_id,
        ).values(slot_id=slot.id, scheduled_at=slot.starts_at, scheduled_end_at=slot.ends_at,
                 timezone=slot.timezone, status="requested", reschedule_revision=revision,
                 updated_at=datetime.utcnow()))
        if changed.rowcount != 1:
            raise _not_committed("A consulta mudou. Atualize-a antes de alterar o horário.")
        if old_slot_id:
            db.execute(update(slots).where(slots.c.id == old_slot_id,
                slots.c.reserved_consultation_id == consultation_id).values(reserved_consultation_id=None))
        if session:
            session.status = "scheduled"
            for field in ("identity_confirmed", "consent_confirmed", "vitals_reviewed",
                          "medication_reviewed", "clinical_summary_ready"):
                setattr(session, field, False)
            # Keep the authored note as a draft and retain prior audit events.
            # Attendance/device confirmations must refer to the new time.
            for person in participants:
                person.camera_ready = person.microphone_ready = person.consent_confirmed = False
                person.network_quality = None
                person.checked_in_at = None
            db.add(HealthAuditLog(actor_user_id=user.id, action="teleconsultation.preparation_reset",
                resource_type="teleconsultation_session", resource_id=session.id,
                metadata_json=json.dumps({"consultation_id": consultation_id, "reschedule_revision": revision})))
        db.flush()
        db.add(HealthAuditLog(actor_user_id=user.id, action="consultation_rescheduled", resource_type="consultation",
            resource_id=consultation_id, metadata_json=json.dumps({"revision": revision, "request_id": row.id,
                "previous_slot_id": old_slot_id, "slot_id": slot.id, "from_status": old_status, "to_status": "requested"})))
        for recipient in sorted({user.id, doctor.user_id}):
            enqueue_notification(db, user_id=recipient, event_key=f"reschedule:{row.id}:requested",
                title="Alteração de horário pedida", message="O horário foi alterado e aguarda nova aceitação do médico. Abra a consulta para consultar.",
                entity_type="consultation", entity_id=consultation_id)
        db.commit()
        db.refresh(consultation)
        return consultation
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível confirmar a alteração. Repita com a mesma chave e conteúdo.") from None
