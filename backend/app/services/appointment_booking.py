"""One transaction for request identity, capacity claim and consultation audit."""
import hashlib
import json
from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError, OperationalError

from app.health_models import AppointmentSlot, Consultation
from app.services.appointments import current_doctor, ensure_capacity, lock_resources, utc
from app.services.consultation_lifecycle import record_event


def _replay(db, patient_id, key, digest):
    if not key:
        return None
    previous = db.query(Consultation).filter_by(patient_id=patient_id, booking_request_key=key).populate_existing().first()
    if previous and previous.booking_request_digest != digest:
        raise HTTPException(409, "Esta chave já foi usada com outro pedido. Atualize a escolha.")
    return previous


def create_booking(db, body, patient, user, key):
    from app.services.specialties import normalize_specialty
    if key is not None:
        try:
            key = str(UUID(key))
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(422, "A chave do pedido deve ser um UUID válido.") from None
    digest = hashlib.sha256(json.dumps(body.model_dump(mode="json"), sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    existing = _replay(db, patient.id, key, digest)
    if existing:
        return existing, False
    specialty = normalize_specialty(body.specialty)
    if body.next_available and (body.slot_id or body.doctor_id or body.scheduled_at):
        raise HTTPException(422, "Escolha a fila ou um horário publicado.")
    if not body.slot_id and bool(body.doctor_id) != bool(body.scheduled_at):
        raise HTTPException(422, "Escolha um médico e horário publicado em conjunto.")
    requested_time = utc(body.scheduled_at) if body.scheduled_at else None
    if requested_time and requested_time <= datetime.utcnow():
        raise HTTPException(422, "Escolha uma data e hora futuras.")
    doctor_id = body.doctor_id
    slot = None
    if body.slot_id:
        slot = db.get(AppointmentSlot, body.slot_id)
        if not slot:
            raise HTTPException(404, "Horário não encontrado.")
        if (doctor_id and doctor_id != slot.doctor_id) or (requested_time and requested_time != slot.starts_at):
            raise HTTPException(422, "O médico ou data não corresponde ao horário escolhido.")
        doctor_id = slot.doctor_id
    if doctor_id:
        try:
            doctor = current_doctor(db, doctor_id, body.country)
        except HTTPException as error:
            if error.status_code == 403:
                raise HTTPException(400, "Este médico não está autorizado para receber marcações.") from None
            raise
        if normalize_specialty(doctor.specialization) != specialty:
            raise HTTPException(422, "O médico não corresponde à especialidade escolhida.")
    try:
        lock_resources(db, doctor_id, patient.id)
        existing = _replay(db, patient.id, key, digest)
        if existing:
            return existing, False
        if doctor_id:
            current_doctor(db, doctor_id, body.country)
            if slot:
                slot = db.get(AppointmentSlot, slot.id, populate_existing=True)
            else:
                slot = db.query(AppointmentSlot).filter_by(doctor_id=doctor_id, starts_at=requested_time,
                    country=body.country, withdrawn=False).populate_existing().first()
            if not slot or slot.country != body.country or slot.withdrawn or slot.reserved_consultation_id or slot.starts_at <= datetime.utcnow():
                raise HTTPException(409, "Este horário já não está disponível. Escolha outro horário publicado.")
        start, end = (slot.starts_at, slot.ends_at) if slot else (None, None)
        ensure_capacity(db, doctor_id=doctor_id, patient_id=patient.id, start=start, end=end)
        from app.services.request_expiry import deadline
        item = Consultation(patient_id=patient.id, triage_session_id=body.triage_session_id,
            specialty=specialty, doctor_id=doctor_id, status="requested", scheduled_at=start,
            scheduled_end_at=end, requested_expires_at=deadline(start), slot_id=slot.id if slot else None, country=body.country,
            timezone=slot.timezone if slot else None, booking_request_key=key, booking_request_digest=digest if key else None)
        db.add(item)
        db.flush()
        if slot:
            table = AppointmentSlot.__table__
            result = db.execute(update(table).where(table.c.id == slot.id, table.c.withdrawn.is_(False),
                table.c.reserved_consultation_id.is_(None)).values(reserved_consultation_id=item.id))
            if result.rowcount != 1:
                raise HTTPException(409, "Este horário acaba de ser reservado. Escolha outro.")
        record_event(db, item, user.id, "consultation_booked", None, "requested")
        from app.services.notifications import consultation_event
        consultation_event(db, item, "booked")
        db.commit()
        db.refresh(item)
        return item, True
    except HTTPException:
        db.rollback()
        raise
    except (IntegrityError, OperationalError):
        db.rollback()
        existing = _replay(db, patient.id, key, digest)
        if existing:
            return existing, False
        raise HTTPException(409, "A disponibilidade mudou. Atualize e tente novamente.") from None
    except Exception:
        db.rollback()
        # A response/refresh failure can follow a successful commit. The same
        # request key recovers it without a second appointment or audit event.
        raise HTTPException(503, "Não foi possível confirmar o pedido. Tente novamente com o mesmo conteúdo e chave.") from None
