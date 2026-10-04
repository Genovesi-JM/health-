"""Atomic clinician finalization and explicitly disclosed patient summaries.

A digest detects content changes; it is not a legal or cryptographic signature.
No update/delete endpoint exists for finalized notes. Legacy unsigned notes are
never silently published or relabelled as finalized.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.health_models import (
    ClinicalCareTask, Consultation, ConsultationNotes, Doctor, HealthAuditLog,
    PatientConsent, TeleconsultationParticipant, TeleconsultationSession,
)
from app.health_schemas import ConsultationCompleteRequest
from app.models import User
from app.services.consultation_lifecycle import transition

TEXT_FIELDS = ("subjective", "objective", "assessment", "plan", "patient_summary", "follow_up_instructions")


def utc_stamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat()


def _canonical(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def _request_content(body: ConsultationCompleteRequest) -> dict:
    return {
        **{field: (getattr(body, field) or "").strip() or None for field in TEXT_FIELDS},
        "outcome": body.outcome,
        "follow_up_required": body.follow_up_required,
        "follow_up_due_at": utc_stamp(body.follow_up_due_at),
    }


def _stored_content(notes: ConsultationNotes) -> dict:
    return {
        **{field: getattr(notes, field) for field in TEXT_FIELDS},
        "outcome": notes.outcome,
        "follow_up_required": notes.follow_up_required,
        "follow_up_due_at": utc_stamp(notes.follow_up_due_at),
    }


def note_digest(notes: ConsultationNotes) -> str:
    return _canonical({
        **_stored_content(notes), "id": notes.id, "consultation_id": notes.consultation_id,
        "doctor_id": notes.doctor_id, "finalized_at": utc_stamp(notes.finalized_at),
        "finalized_by_user_id": notes.finalized_by_user_id,
        "follow_up_task_id": notes.follow_up_task_id,
    })


def verify_finalization(notes: ConsultationNotes) -> None:
    if not notes.finalized_at or not notes.finalized_by_user_id or not notes.finalization_digest or not hmac.compare_digest(notes.finalization_digest, note_digest(notes)):
        raise HTTPException(409, "O registo finalizado requer verificação. Contacte a equipa clínica.")


def require_episode_consent(consultation: Consultation, db: Session) -> None:
    if not db.query(PatientConsent.id).filter(
        PatientConsent.patient_id == consultation.patient_id,
        PatientConsent.consent_type == "telemedicine_consent",
    ).first():
        raise HTTPException(409, "O consentimento de telemedicina deve estar ativo antes de continuar.")


def end_video(db: Session, consultation: Consultation, actor_id: str, now: datetime) -> None:
    """End operational attendance in the caller's clinical transaction."""
    session = db.query(TeleconsultationSession).filter_by(consultation_id=consultation.id).first()
    if not session or session.status == "completed":
        return
    session.status = "completed"
    session.ended_at = now
    db.execute(update(TeleconsultationParticipant).where(
        TeleconsultationParticipant.session_id == session.id,
        TeleconsultationParticipant.joined_at.is_not(None),
        TeleconsultationParticipant.left_at.is_(None),
    ).values(left_at=now))
    db.add(HealthAuditLog(actor_user_id=actor_id, action="teleconsultation.completed",
                          resource_type="teleconsultation_session", resource_id=session.id,
                          metadata_json=json.dumps({"consultation_id": consultation.id})))


def finalize_consultation(db: Session, consultation: Consultation, body: ConsultationCompleteRequest, user: User) -> None:
    request_content = _request_content(body)
    notes = db.query(ConsultationNotes).filter_by(consultation_id=consultation.id).first()
    if consultation.status == "completed" and notes and notes.finalized_at:
        verify_finalization(notes)
        if notes.finalized_by_user_id == user.id and _stored_content(notes) == request_content:
            return  # Acknowledgement lost after commit; return the same immutable result.
        raise HTTPException(409, "A consulta já foi finalizada com outro conteúdo. Consulte o registo guardado.")
    if consultation.status != "in_progress":
        raise HTTPException(409, "O estado da consulta não permite finalizar. Atualize a lista.")
    if notes:
        raise HTTPException(409, "Já existe um registo clínico nesta consulta. É necessária revisão clínica.")
    require_episode_consent(consultation, db)
    if body.outcome is None:
        raise HTTPException(422, "Escolha o resultado clínico da consulta.")
    if body.follow_up_required is None:
        raise HTTPException(422, "Indique explicitamente se é necessário seguimento.")
    for field in ("assessment", "plan", "patient_summary"):
        if not request_content[field]:
            raise HTTPException(422, "Preencha a avaliação, o plano clínico e o resumo para o paciente.")
    if body.outcome == "follow_up" and not body.follow_up_required:
        raise HTTPException(422, "O resultado de acompanhamento requer uma tarefa de seguimento.")
    due_at = body.follow_up_due_at
    if body.follow_up_required:
        if not request_content["follow_up_instructions"] or not due_at or due_at.tzinfo is None or due_at.utcoffset() is None:
            raise HTTPException(422, "Indique as instruções e a data de seguimento com fuso horário.")
        due_at = due_at.astimezone(timezone.utc).replace(tzinfo=None)
        if due_at <= datetime.utcnow():
            raise HTTPException(422, "A data do seguimento deve estar no futuro.")
    elif due_at is not None:
        raise HTTPException(422, "Uma data de seguimento requer uma tarefa de acompanhamento.")

    now = datetime.utcnow()
    transition(db, consultation, actor_id=user.id, action="consultation_completed",
               allowed_from=("in_progress",), status="completed", ended_at=now)
    task = None
    if body.follow_up_required:
        task = ClinicalCareTask(
            patient_id=consultation.patient_id, consultation_id=consultation.id,
            created_by_user_id=user.id, assigned_role="doctor", assigned_user_id=user.id,
            task_type="follow_up", title="Seguimento após consulta",
            instructions=request_content["follow_up_instructions"], priority="routine", due_at=due_at,
        )
        db.add(task)
        db.flush()
        db.add(HealthAuditLog(actor_user_id=user.id, action="clinical_care_task.created",
                             resource_type="clinical_care_task", resource_id=task.id,
                             metadata_json=json.dumps({"consultation_id": consultation.id, "assigned_role": "doctor"})))
    notes = ConsultationNotes(
        consultation_id=consultation.id, doctor_id=consultation.doctor_id,
        **{field: request_content[field] for field in TEXT_FIELDS}, outcome=body.outcome,
        follow_up_required=body.follow_up_required, follow_up_due_at=due_at,
        follow_up_task_id=task.id if task else None, finalized_at=now, finalized_by_user_id=user.id,
    )
    db.add(notes)
    db.flush()
    notes.finalization_digest = note_digest(notes)
    # Persist the disclosure and its exact follow-up link before selecting
    # patient recipients. Notifications still share this uncommitted transaction.
    db.flush()
    from app.services.notifications import consultation_event, task_event
    consultation_event(db, consultation, "closed")
    if task:
        task_event(db, task, "created")
    end_video(db, consultation, user.id, now)
    db.commit()
    db.refresh(consultation)


def _display_name(db: Session, user: User | None) -> str:
    doctor = db.query(Doctor).filter_by(user_id=user.id).first() if user else None
    if doctor and doctor.display_name:
        return doctor.display_name
    if user and user.profile and user.profile.full_name:
        return user.profile.full_name
    return "Médico responsável"


def closeout_result(db: Session, consultation: Consultation, *, clinician: bool) -> dict:
    result = {"consultation_id": consultation.id, "status": consultation.status, "closeout": None}
    notes = db.query(ConsultationNotes).filter_by(consultation_id=consultation.id).first()
    if consultation.status != "completed" or not notes or not notes.finalized_at:
        return result
    verify_finalization(notes)
    author = db.get(User, notes.finalized_by_user_id)
    follow_up = None
    if notes.follow_up_task_id:
        task = db.get(ClinicalCareTask, notes.follow_up_task_id)
        if not task or task.consultation_id != consultation.id or task.patient_id != consultation.patient_id:
            raise HTTPException(409, "O seguimento da consulta requer verificação clínica.")
        assignee = db.get(User, task.assigned_user_id) if task.assigned_user_id else None
        follow_up = {"id": task.id, "assigned_user_id": task.assigned_user_id,
                     "assigned_name": _display_name(db, assignee),
                     "due_at": utc_stamp(task.due_at), "status": task.status}
    result["closeout"] = {
        "patient_summary": notes.patient_summary, "follow_up_instructions": notes.follow_up_instructions,
        "outcome": notes.outcome, "finalized_at": utc_stamp(notes.finalized_at),
        "finalized_by": notes.finalized_by_user_id, "finalized_by_name": _display_name(db, author),
        "follow_up_required": notes.follow_up_required, "follow_up": follow_up,
    }
    if clinician:
        result["closeout"]["notes"] = {field: getattr(notes, field) for field in ("subjective", "objective", "assessment", "plan")}
    return result
