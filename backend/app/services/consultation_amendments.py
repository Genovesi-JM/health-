"""Append-only clinical corrections with explicit, separate patient disclosure."""
from datetime import datetime
import hmac
import json
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.health_models import Consultation, ConsultationAmendment, ConsultationNotes, HealthAuditLog, Patient
from app.health_schemas import ConsultationAmendmentRequest
from app.models import User
from app.services.appointments import MARKET_ZONES, current_doctor, lock_resources
from app.services.consultation_closeout import (
    _canonical, _display_name, _stored_content, require_episode_consent, utc_stamp, verify_finalization,
)
from app.services.notifications import enqueue_notification

SOAP_FIELDS = ("subjective", "objective", "assessment", "plan")
CORRECTION_FIELDS = (*SOAP_FIELDS, "patient_summary")


def _base_snapshot(notes):
    return {**_stored_content(notes), "follow_up_task_id": notes.follow_up_task_id}


def amendment_digest(row, snapshot):
    return _canonical({
        "id": row.id, "note_id": row.note_id, "revision": row.revision,
        "author_user_id": row.author_user_id, "reason": row.reason,
        "publish_to_patient": row.publish_to_patient, "snapshot": snapshot,
        "previous_digest": row.previous_digest, "request_key": row.request_key,
        "request_digest": row.request_digest, "created_at": utc_stamp(row.created_at),
    })


def verified_history(db: Session, notes: ConsultationNotes):
    verify_finalization(notes)
    previous = notes.finalization_digest
    base = _base_snapshot(notes)
    history = []
    rows = db.query(ConsultationAmendment).filter_by(note_id=notes.id).order_by(ConsultationAmendment.revision).all()
    for revision, row in enumerate(rows, 1):
        try:
            snapshot = json.loads(row.snapshot_json)
            intact = (
                row.revision == revision and row.previous_digest == previous
                and isinstance(snapshot, dict) and set(snapshot) == set(base)
                and all(snapshot[key] == value for key, value in base.items() if key not in CORRECTION_FIELDS)
                and all(isinstance(snapshot[key], str) and snapshot[key].strip() for key in ("assessment", "plan", "patient_summary"))
                and hmac.compare_digest(row.digest, amendment_digest(row, snapshot))
            )
        except (ValueError, TypeError, KeyError):
            intact = False
        if not intact:
            raise HTTPException(409, "O histórico de correções requer verificação clínica.")
        history.append((row, snapshot))
        previous = row.digest
    return history


def effective_clinician_notes(db: Session, consultation: Consultation):
    """Shared reader for authorized clinical histories, including unsigned legacy notes."""
    notes = consultation.notes
    if notes and any((notes.finalized_at, notes.finalized_by_user_id, notes.finalization_digest)):
        history = verified_history(db, notes)
        if history:
            return SimpleNamespace(**history[-1][1])
    return notes


def append_amendment(db: Session, consultation: Consultation, body: ConsultationAmendmentRequest,
                     user: User, key: str | None) -> ConsultationAmendment:
    try:
        request_key = str(UUID(key)) if key else None
    except (ValueError, AttributeError):
        request_key = None
    if request_key is None:
        raise HTTPException(422, "Indique uma chave UUID para guardar ou repetir esta correção.")
    actor_id, doctor_id, patient_id = user.id, consultation.doctor_id, consultation.patient_id
    lock_resources(db, doctor_id, patient_id)
    result = db.execute(update(Consultation.__table__).where(
        Consultation.id == consultation.id, Consultation.doctor_id == doctor_id,
        Consultation.patient_id == patient_id, Consultation.status == "completed",
    ).values(updated_at=Consultation.updated_at))
    if result.rowcount != 1:
        raise HTTPException(409, "A consulta foi alterada. Atualize o registo antes de corrigir.")
    db.refresh(consultation)
    if consultation.country not in MARKET_ZONES:
        raise HTTPException(409, "É necessário rever o país deste registo antes de o corrigir.")
    doctor = current_doctor(db, doctor_id, consultation.country)
    if doctor.user_id != actor_id:
        raise HTTPException(404, "Consulta não encontrada ou não atribuída a si.")
    require_episode_consent(consultation, db)
    notes = db.query(ConsultationNotes).filter_by(consultation_id=consultation.id).first()
    if not notes or not notes.finalized_at:
        raise HTTPException(409, "Apenas um registo finalizado pode receber uma correção.")
    history = verified_history(db, notes)
    content = {key: (getattr(body, key) or "").strip() or None for key in CORRECTION_FIELDS}
    reason = body.reason.strip()
    if not reason or any(not content[key] for key in ("assessment", "plan", "patient_summary")):
        raise HTTPException(422, "Preencha o motivo, a avaliação, o plano e o resumo para o paciente.")
    request_digest = _canonical({**content, "reason": reason, "publish_to_patient": body.publish_to_patient,
                                 "expected_digest": body.expected_digest})
    retry = next((row for row, _ in history if row.request_key == request_key), None)
    if retry:
        if retry.author_user_id == actor_id and hmac.compare_digest(retry.request_digest, request_digest):
            return retry
        raise HTTPException(409, "Esta chave já foi usada com outro conteúdo. Recupere a correção guardada.")
    previous = history[-1][0].digest if history else notes.finalization_digest
    if not hmac.compare_digest(previous, body.expected_digest):
        # Emitted only after the retained chain and request key were checked
        # under the episode lock: this exact key has not committed.
        raise HTTPException(409, detail={
            "code": "amendment_stale_head", "request_key_committed": False,
            "message": "Existe uma correção mais recente. Atualize o registo antes de guardar.",
        })
    snapshot = {**_base_snapshot(notes), **content}
    row = ConsultationAmendment(
        id=str(uuid4()), note_id=notes.id, revision=len(history) + 1, author_user_id=actor_id,
        reason=reason, publish_to_patient=body.publish_to_patient,
        snapshot_json=json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False),
        previous_digest=previous, request_key=request_key, request_digest=request_digest, created_at=datetime.utcnow(),
    )
    row.digest = amendment_digest(row, snapshot)
    db.add(row)
    db.flush()
    db.add(HealthAuditLog(actor_user_id=actor_id, action="consultation_amended", resource_type="consultation",
                          resource_id=consultation.id, metadata_json=json.dumps({
                              "amendment_id": row.id, "revision": row.revision, "published": row.publish_to_patient,
                              "previous_digest": previous, "digest": row.digest,
                          })))
    recipients = {actor_id}
    if row.publish_to_patient:
        patient = db.get(Patient, consultation.patient_id)
        if patient:
            recipients.add(patient.user_id)
    for recipient in sorted(recipients):
        enqueue_notification(db, user_id=recipient, event_key=f"amendment:{row.id}:created",
                             title="Registo da consulta atualizado",
                             message="Existe uma correção no registo. Abra o resumo da consulta para consultar.",
                             entity_type="consultation", entity_id=consultation.id)
    return row


def disclose_amendments(db: Session, notes: ConsultationNotes, output: dict, *, clinician: bool):
    history = verified_history(db, notes)
    published = [{"revision": 0, "patient_summary": notes.patient_summary,
                  "published_at": utc_stamp(notes.finalized_at), "author_name": output["finalized_by_name"]}]
    for row, snapshot in history:
        if row.publish_to_patient:
            published.append({"revision": row.revision, "patient_summary": snapshot["patient_summary"],
                              "published_at": utc_stamp(row.created_at),
                              "author_name": _display_name(db, db.get(User, row.author_user_id))})
    output["published_revision"] = published[-1]["revision"]
    output["published_history"] = published
    if not clinician:
        output["patient_summary"] = published[-1]["patient_summary"]
        return
    output["original"] = {"patient_summary": notes.patient_summary,
                          "notes": {key: getattr(notes, key) for key in SOAP_FIELDS}}
    output["current_revision"] = history[-1][0].revision if history else 0
    output["current_digest"] = history[-1][0].digest if history else notes.finalization_digest
    output["current_is_published"] = history[-1][0].publish_to_patient if history else True
    output["amendments"] = [{
        "id": row.id, "revision": row.revision, "created_at": utc_stamp(row.created_at),
        "author_name": _display_name(db, db.get(User, row.author_user_id)), "reason": row.reason,
        "publish_to_patient": row.publish_to_patient, "digest": row.digest, "previous_digest": row.previous_digest,
        "patient_summary": snapshot["patient_summary"], "notes": {key: snapshot[key] for key in SOAP_FIELDS},
    } for row, snapshot in history]
    if history:
        output["patient_summary"] = history[-1][1]["patient_summary"]
        output["notes"] = {key: history[-1][1][key] for key in SOAP_FIELDS}
