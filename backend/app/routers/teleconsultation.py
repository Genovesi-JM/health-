from __future__ import annotations

"""Audited operational video preparation; transport remains disabled.

No provider adapter ships. Environment flags or a base URL cannot manufacture
an approved participant credential or turn an opaque room key into a bearer URL.
Ending a video session is separate from finalizing the clinical record.
"""
import json
import secrets
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    Consultation, Doctor, HealthAuditLog, Patient,
    TeleconsultationParticipant, TeleconsultationSession,
)
from app.services.consultation_lifecycle import displayed_revision, require_displayed_revision, transition
from app.services.consultation_closeout import end_video, require_episode_consent, utc_stamp
from app.services.clinician_access import require_current_clinician
from app.video_boundary import DisabledVideoProvider

router = APIRouter(prefix="/api/v1/teleconsultations", tags=["teleconsultation"])
_PROVIDER = DisabledVideoProvider()
_UNAVAILABLE = "Vídeo indisponível: a integração com um fornecedor aprovado ainda não está ativa. Contacte a equipa para organizar a consulta."


class CheckInRequest(BaseModel):
    camera_ready: bool
    microphone_ready: bool
    network_quality: Literal["poor", "fair", "good", "excellent"]
    consent_confirmed: bool = False


class PreflightRequest(BaseModel):
    identity_confirmed: bool
    consent_confirmed: bool
    vitals_reviewed: bool
    medication_reviewed: bool
    clinical_summary_ready: bool
    preflight_note: Optional[str] = Field(default=None, max_length=4000)


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"


def _commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível confirmar a atualização da sessão. Atualize e tente novamente.") from None


def _clinician_verified(user: User, db: Session) -> bool:
    try:
        require_current_clinician(user, db)
    except HTTPException:
        return False
    return True


def _authorized_consultation(user: User, consultation_id: str, db: Session) -> Consultation:
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(404, "Consulta não encontrada.")
    if user.role in ("patient", "cliente"):
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or consultation.patient_id != patient.id:
            raise HTTPException(403, "Sem acesso a esta teleconsulta.")
        return consultation
    if not _clinician_verified(user, db):
        raise HTTPException(403, "Profissional clínico não verificado.")
    if user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor or consultation.doctor_id != doctor.id:
            raise HTTPException(403, "Consulta não atribuída a este médico.")
    elif consultation.status not in ("scheduled", "in_progress") or not consultation.doctor_id:
        raise HTTPException(403, "Enfermagem só pode preparar episódios aceites e ativos.")
    return consultation


def _lock_active(db: Session, consultation: Consultation) -> None:
    """Serialize session writes with terminal clinical changes on the same row.

    A conditional write works on SQLite too, whose FOR UPDATE is ignored. The
    retained transaction lock prevents cancellation/finalization from racing a
    session update after the active-state check.
    """
    from app.services.appointments import lock_resources
    previous_revision = consultation.reschedule_revision
    lock_resources(db, consultation.doctor_id, consultation.patient_id)
    if consultation.status not in ("scheduled", "in_progress") or not consultation.doctor_id:
        raise HTTPException(409, "A consulta não está aceite e ativa.")
    table = Consultation.__table__
    result = db.execute(update(table).where(
        table.c.id == consultation.id, table.c.status == consultation.status,
        table.c.doctor_id == consultation.doctor_id,
        table.c.reschedule_revision == previous_revision,
    ).values(updated_at=datetime.utcnow()))
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(409, "A consulta foi alterada. Atualize a página.")
    db.refresh(consultation)


def _audit(db: Session, action: str, user: User, session: TeleconsultationSession, **metadata) -> None:
    db.add(HealthAuditLog(actor_user_id=user.id, action=action,
                         resource_type="teleconsultation_session", resource_id=session.id,
                         metadata_json=json.dumps(metadata)))


def _participant_out(item: TeleconsultationParticipant) -> dict:
    return {"id": item.id, "user_id": item.user_id, "role": item.role,
            "camera_ready": item.camera_ready, "microphone_ready": item.microphone_ready,
            "network_quality": item.network_quality, "consent_confirmed": item.consent_confirmed,
            "checked_in_at": utc_stamp(item.checked_in_at), "joined_at": utc_stamp(item.joined_at),
            "left_at": utc_stamp(item.left_at)}


def _session_out(item: TeleconsultationSession, db: Session, user: User) -> dict:
    query = db.query(TeleconsultationParticipant).filter_by(session_id=item.id)
    patient = user.role in ("patient", "cliente")
    if patient:
        query = query.filter(TeleconsultationParticipant.user_id == user.id)
    ready = {name: getattr(item, name) for name in (
        "identity_confirmed", "consent_confirmed", "vitals_reviewed",
        "medication_reviewed", "clinical_summary_ready",
    )}
    result = {
        "id": item.id, "consultation_id": item.consultation_id,
        "reschedule_revision": db.get(Consultation, item.consultation_id).reschedule_revision,
        "provider": "disabled", "provider_mode": "disabled", "status": item.status,
        "preflight": ready, "preflight_complete": all(ready.values()),
        "participants": [_participant_out(row) for row in query.all()],
        "started_at": utc_stamp(item.started_at), "ended_at": utc_stamp(item.ended_at),
        "recording_enabled": False, "provider_notice": _UNAVAILABLE,
    }
    if not patient:
        result["preflight_note"] = item.preflight_note
    return result


def _session(consultation_id: str, db: Session) -> TeleconsultationSession:
    item = db.query(TeleconsultationSession).filter_by(consultation_id=consultation_id).populate_existing().first()
    if not item:
        raise HTTPException(404, "Sala de teleconsulta ainda não preparada.")
    return item


@router.get("/capabilities")
def capabilities(response: Response, user: User = Depends(get_current_user)):
    if user.role not in ("patient", "cliente", "doctor", "nurse"):
        raise HTTPException(403, "Sem acesso a teleconsultas.")
    _private(response)
    return {"enabled": _PROVIDER.health(), "provider": None, "recording_enabled": False, "message": _UNAVAILABLE}


@router.post("/{consultation_id}/prepare", status_code=201)
def prepare_session(consultation_id: str, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role not in ("doctor", "nurse"):
        raise HTTPException(403, "A preparação requer um profissional clínico.")
    _lock_active(db, consultation)
    require_episode_consent(consultation, db)
    existing = db.query(TeleconsultationSession).filter_by(consultation_id=consultation.id).first()
    if existing:
        _private(response)
        return _session_out(existing, db, user)
    item = TeleconsultationSession(
        consultation_id=consultation.id, room_key=f"KAYA-{secrets.token_urlsafe(24)}",
        provider="disabled", provider_mode="disabled", consent_confirmed=True,
    )
    db.add(item)
    db.flush()
    _audit(db, "teleconsultation.prepared", user, item, consultation_id=consultation.id, provider_mode="disabled")
    _commit(db)
    _private(response)
    return _session_out(item, db, user)


@router.get("/{consultation_id}")
def get_session(consultation_id: str, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _authorized_consultation(user, consultation_id, db)
    _private(response)
    session = _session(consultation_id, db)
    result = _session_out(session, db, user)
    _audit(db, "teleconsultation.read", user, session)
    _commit(db)
    return result


@router.post("/{consultation_id}/check-in")
def check_in(consultation_id: str, body: CheckInRequest, response: Response,
             expected_revision: int = Depends(displayed_revision),
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consultation = _authorized_consultation(user, consultation_id, db)
    require_displayed_revision(consultation, expected_revision)
    _lock_active(db, consultation)
    require_displayed_revision(consultation, expected_revision)
    require_episode_consent(consultation, db)
    session = _session(consultation_id, db)
    if session.status == "completed":
        raise HTTPException(409, "Teleconsulta já encerrada.")
    if user.role in ("patient", "cliente") and not body.consent_confirmed:
        raise HTTPException(422, "Confirme o consentimento para esta teleconsulta.")
    participant = db.query(TeleconsultationParticipant).filter_by(session_id=session.id, user_id=user.id).first()
    if not participant:
        participant = TeleconsultationParticipant(session_id=session.id, user_id=user.id,
                                                  role="patient" if user.role == "cliente" else user.role)
        db.add(participant)
    participant.camera_ready = body.camera_ready
    participant.microphone_ready = body.microphone_ready
    participant.network_quality = body.network_quality
    participant.consent_confirmed = body.consent_confirmed
    participant.checked_in_at = datetime.utcnow()
    if session.status == "scheduled":
        session.status = "waiting"
    _audit(db, "teleconsultation.checked_in", user, session, role=participant.role,
           camera=body.camera_ready, microphone=body.microphone_ready)
    _commit(db)
    _private(response)
    return _session_out(session, db, user)


@router.put("/{consultation_id}/preflight")
def update_preflight(consultation_id: str, body: PreflightRequest, response: Response,
                     expected_revision: int = Depends(displayed_revision),
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role != "nurse":
        raise HTTPException(403, "Checklist de preparação reservado à enfermagem.")
    require_displayed_revision(consultation, expected_revision)
    _lock_active(db, consultation)
    require_displayed_revision(consultation, expected_revision)
    require_episode_consent(consultation, db)
    session = _session(consultation_id, db)
    if session.status not in ("scheduled", "waiting"):
        raise HTTPException(409, "A preparação já foi encerrada ou a sessão está em curso.")
    for field in ("identity_confirmed", "consent_confirmed", "vitals_reviewed", "medication_reviewed", "clinical_summary_ready", "preflight_note"):
        setattr(session, field, getattr(body, field))
    _audit(db, "teleconsultation.preflight_updated", user, session, complete=all((
        body.identity_confirmed, body.consent_confirmed, body.vitals_reviewed,
        body.medication_reviewed, body.clinical_summary_ready,
    )))
    _commit(db)
    _private(response)
    return _session_out(session, db, user)


@router.post("/{consultation_id}/start")
def start_session(consultation_id: str, response: Response, expected_revision: int = Depends(displayed_revision),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role != "doctor":
        raise HTTPException(403, "A teleconsulta é iniciada pelo médico.")
    require_displayed_revision(consultation, expected_revision)
    _lock_active(db, consultation)
    require_displayed_revision(consultation, expected_revision)
    require_episode_consent(consultation, db)
    session = _session(consultation_id, db)
    if session.status == "completed":
        raise HTTPException(409, "A sessão de vídeo já foi encerrada.")
    if not all((session.identity_confirmed, session.consent_confirmed, session.vitals_reviewed,
                session.medication_reviewed, session.clinical_summary_ready)):
        raise HTTPException(409, "A checklist clínica deve estar completa antes de iniciar.")
    participant = db.query(TeleconsultationParticipant).filter_by(session_id=session.id, user_id=user.id).first()
    if not participant or not participant.checked_in_at or not participant.camera_ready or not participant.microphone_ready:
        raise HTTPException(409, "O médico deve concluir o teste do dispositivo e o check-in.")
    if session.status == "in_progress":
        _private(response)
        return _session_out(session, db, user)
    transition(db, consultation, actor_id=user.id, action="consultation_video_started",
               allowed_from=("scheduled", "in_progress"), status="in_progress",
               started_at=consultation.started_at or datetime.utcnow())
    session.status = "in_progress"
    session.started_at = session.started_at or datetime.utcnow()
    _audit(db, "teleconsultation.started", user, session)
    _commit(db)
    _private(response)
    return _session_out(session, db, user)


@router.post("/{consultation_id}/join")
def join_session(consultation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consultation = _authorized_consultation(user, consultation_id, db)
    if consultation.status != "in_progress":
        raise HTTPException(409, "A consulta não está em curso.")
    require_episode_consent(consultation, db)
    session = _session(consultation_id, db)
    if session.status != "in_progress":
        raise HTTPException(409, "Aguarde que o médico inicie a teleconsulta.")
    participant = db.query(TeleconsultationParticipant).filter_by(session_id=session.id, user_id=user.id).first()
    if not participant or not participant.checked_in_at or not participant.camera_ready or not participant.microphone_ready:
        raise HTTPException(409, "Faça o check-in e teste a câmara e o microfone antes de entrar.")
    if user.role in ("patient", "cliente") and not participant.consent_confirmed:
        raise HTTPException(409, "Confirme o consentimento para esta teleconsulta.")
    # Fail closed even with VIDEO_ENABLED=true and a supplied base URL. No
    # participant credential is ever issued by the disabled provider adapter.
    raise HTTPException(503, _UNAVAILABLE)


@router.post("/{consultation_id}/complete")
def complete_session(consultation_id: str, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role != "doctor":
        raise HTTPException(403, "A teleconsulta é encerrada pelo médico.")
    session = _session(consultation_id, db)
    if session.status == "completed" and consultation.status in ("in_progress", "completed"):
        _private(response)
        return _session_out(session, db, user)
    _lock_active(db, consultation)
    session = _session(consultation_id, db)
    if consultation.status != "in_progress" or session.status != "in_progress":
        raise HTTPException(409, "A teleconsulta não está em curso.")
    end_video(db, consultation, user.id, datetime.utcnow())
    _commit(db)
    _private(response)
    return _session_out(session, db, user)
