from __future__ import annotations

"""Audited teleconsultation lifecycle around a configurable video provider."""

import os
import secrets
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    ClinicianCredential,
    Consultation,
    Doctor,
    Patient,
    PatientConsent,
    TeleconsultationParticipant,
    TeleconsultationSession,
)
from app.rbac import log_health_audit


router = APIRouter(prefix="/api/v1/teleconsultations", tags=["teleconsultation"])


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


def _clinician_verified(user: User, db: Session) -> bool:
    if user.role not in ("doctor", "nurse"):
        return False
    credential = db.query(ClinicianCredential).filter(
        ClinicianCredential.user_id == user.id,
        ClinicianCredential.profession == user.role,
        ClinicianCredential.status == "verified",
    ).first()
    return bool(credential)


def _authorized_consultation(user: User, consultation_id: str, db: Session) -> Consultation:
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    if user.role in ("patient", "cliente"):
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or consultation.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Sem acesso a esta teleconsulta.")
        return consultation
    if not _clinician_verified(user, db):
        raise HTTPException(status_code=403, detail="Profissional clínico não verificado.")
    if user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor or consultation.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Consulta não atribuída a este médico.")
    elif consultation.status not in ("requested", "scheduled", "in_progress"):
        raise HTTPException(status_code=403, detail="Enfermagem só pode aceder a episódios ativos.")
    return consultation


def _has_telemedicine_consent(consultation: Consultation, db: Session) -> bool:
    return bool(db.query(PatientConsent.id).filter(
        PatientConsent.patient_id == consultation.patient_id,
        PatientConsent.consent_type == "telemedicine_consent",
    ).first())


def _participant_out(item: TeleconsultationParticipant) -> dict:
    return {
        "id": item.id,
        "user_id": item.user_id,
        "role": item.role,
        "camera_ready": item.camera_ready,
        "microphone_ready": item.microphone_ready,
        "network_quality": item.network_quality,
        "consent_confirmed": item.consent_confirmed,
        "checked_in_at": item.checked_in_at.isoformat() if item.checked_in_at else None,
        "joined_at": item.joined_at.isoformat() if item.joined_at else None,
        "left_at": item.left_at.isoformat() if item.left_at else None,
    }


def _session_out(item: TeleconsultationSession, db: Session) -> dict:
    participants = db.query(TeleconsultationParticipant).filter(
        TeleconsultationParticipant.session_id == item.id,
    ).all()
    ready = {
        "identity_confirmed": item.identity_confirmed,
        "consent_confirmed": item.consent_confirmed,
        "vitals_reviewed": item.vitals_reviewed,
        "medication_reviewed": item.medication_reviewed,
        "clinical_summary_ready": item.clinical_summary_ready,
    }
    return {
        "id": item.id,
        "consultation_id": item.consultation_id,
        "provider": item.provider,
        "provider_mode": item.provider_mode,
        "status": item.status,
        "preflight": ready,
        "preflight_complete": all(ready.values()),
        "preflight_note": item.preflight_note,
        "participants": [_participant_out(row) for row in participants],
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "ended_at": item.ended_at.isoformat() if item.ended_at else None,
        "recording_enabled": False,
        "provider_notice": (
            "Sala piloto. Não utilizar como integração de vídeo certificada em produção."
            if item.provider_mode == "pilot" else
            "Sala gerida pelo fornecedor de teleconsulta configurado."
        ),
    }


def _session(consultation_id: str, db: Session) -> TeleconsultationSession:
    item = db.query(TeleconsultationSession).filter(
        TeleconsultationSession.consultation_id == consultation_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Sala de teleconsulta ainda não preparada.")
    return item


@router.post("/{consultation_id}/prepare", status_code=201)
def prepare_session(
    consultation_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role not in ("doctor", "nurse"):
        raise HTTPException(status_code=403, detail="A preparação requer um profissional clínico.")
    existing = db.query(TeleconsultationSession).filter(
        TeleconsultationSession.consultation_id == consultation.id,
    ).first()
    if existing:
        return _session_out(existing, db)
    base = os.getenv("VIDEO_PROVIDER", "jitsi_pilot").strip() or "jitsi_pilot"
    item = TeleconsultationSession(
        consultation_id=consultation.id,
        room_key=f"KAYA-{secrets.token_urlsafe(24)}",
        provider=base,
        provider_mode="production" if base != "jitsi_pilot" else "pilot",
        consent_confirmed=_has_telemedicine_consent(consultation, db),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    log_health_audit(
        db, "teleconsultation.prepared", user.id, "teleconsultation_session", item.id,
        {"consultation_id": consultation.id, "provider_mode": item.provider_mode}, request,
    )
    return _session_out(item, db)


@router.get("/{consultation_id}")
def get_session(
    consultation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _authorized_consultation(user, consultation_id, db)
    return _session_out(_session(consultation_id, db), db)


@router.post("/{consultation_id}/check-in")
def check_in(
    consultation_id: str,
    body: CheckInRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consultation = _authorized_consultation(user, consultation_id, db)
    session = _session(consultation_id, db)
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Teleconsulta já concluída.")
    if user.role in ("patient", "cliente") and body.consent_confirmed and not _has_telemedicine_consent(consultation, db):
        raise HTTPException(status_code=422, detail="Consentimento de telemedicina não encontrado.")
    participant = db.query(TeleconsultationParticipant).filter(
        TeleconsultationParticipant.session_id == session.id,
        TeleconsultationParticipant.user_id == user.id,
    ).first()
    if not participant:
        participant = TeleconsultationParticipant(
            session_id=session.id,
            user_id=user.id,
            role="patient" if user.role == "cliente" else user.role,
        )
        db.add(participant)
    participant.camera_ready = body.camera_ready
    participant.microphone_ready = body.microphone_ready
    participant.network_quality = body.network_quality
    participant.consent_confirmed = body.consent_confirmed
    participant.checked_in_at = datetime.utcnow()
    if session.status == "scheduled":
        session.status = "waiting"
    db.commit()
    db.refresh(participant)
    log_health_audit(
        db, "teleconsultation.checked_in", user.id, "teleconsultation_session", session.id,
        {"role": participant.role, "camera": body.camera_ready, "microphone": body.microphone_ready},
        request,
    )
    return _session_out(session, db)


@router.put("/{consultation_id}/preflight")
def update_preflight(
    consultation_id: str,
    body: PreflightRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role != "nurse":
        raise HTTPException(status_code=403, detail="Checklist de preparação reservado à enfermagem.")
    if body.consent_confirmed and not _has_telemedicine_consent(consultation, db):
        raise HTTPException(status_code=422, detail="Consentimento de telemedicina não encontrado.")
    session = _session(consultation_id, db)
    for field in (
        "identity_confirmed", "consent_confirmed", "vitals_reviewed",
        "medication_reviewed", "clinical_summary_ready", "preflight_note",
    ):
        setattr(session, field, getattr(body, field))
    db.commit()
    log_health_audit(
        db, "teleconsultation.preflight_updated", user.id, "teleconsultation_session", session.id,
        {"complete": all((
            body.identity_confirmed, body.consent_confirmed, body.vitals_reviewed,
            body.medication_reviewed, body.clinical_summary_ready,
        ))}, request,
    )
    return _session_out(session, db)


@router.post("/{consultation_id}/start")
def start_session(
    consultation_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="A teleconsulta é iniciada pelo médico.")
    session = _session(consultation_id, db)
    preflight_complete = all((
        session.identity_confirmed,
        session.consent_confirmed,
        session.vitals_reviewed,
        session.medication_reviewed,
        session.clinical_summary_ready,
    ))
    if not preflight_complete:
        raise HTTPException(status_code=409, detail="A checklist clínica deve estar completa antes de iniciar.")
    doctor_participant = db.query(TeleconsultationParticipant).filter(
        TeleconsultationParticipant.session_id == session.id,
        TeleconsultationParticipant.user_id == user.id,
    ).first()
    if (
        not doctor_participant
        or not doctor_participant.checked_in_at
        or not doctor_participant.camera_ready
        or not doctor_participant.microphone_ready
    ):
        raise HTTPException(status_code=409, detail="O médico deve concluir o teste do dispositivo e o check-in.")
    session.status = "in_progress"
    session.started_at = session.started_at or datetime.utcnow()
    consultation.status = "in_progress"
    consultation.started_at = consultation.started_at or datetime.utcnow()
    db.commit()
    log_health_audit(db, "teleconsultation.started", user.id, "teleconsultation_session", session.id, request=request)
    return _session_out(session, db)


@router.post("/{consultation_id}/join")
def join_session(
    consultation_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _authorized_consultation(user, consultation_id, db)
    session = _session(consultation_id, db)
    if session.status == "completed":
        raise HTTPException(status_code=409, detail="Teleconsulta já concluída.")
    if session.status != "in_progress":
        raise HTTPException(status_code=409, detail="Aguarde que o médico inicie a teleconsulta.")
    participant = db.query(TeleconsultationParticipant).filter(
        TeleconsultationParticipant.session_id == session.id,
        TeleconsultationParticipant.user_id == user.id,
    ).first()
    if not participant or not participant.checked_in_at:
        raise HTTPException(status_code=409, detail="Faça o check-in e teste o dispositivo antes de entrar.")
    if not participant.camera_ready or not participant.microphone_ready:
        raise HTTPException(status_code=409, detail="Câmara e microfone devem estar prontos.")
    participant.joined_at = datetime.utcnow()
    db.commit()
    video_base = os.getenv("VIDEO_BASE_URL", "https://meet.jit.si").rstrip("/")
    log_health_audit(db, "teleconsultation.joined", user.id, "teleconsultation_session", session.id, {"role": participant.role}, request)
    return {
        "room_url": f"{video_base}/{session.room_key}",
        "provider": session.provider,
        "provider_mode": session.provider_mode,
        "recording_enabled": False,
    }


@router.post("/{consultation_id}/complete")
def complete_session(
    consultation_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consultation = _authorized_consultation(user, consultation_id, db)
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="A teleconsulta é encerrada pelo médico.")
    session = _session(consultation_id, db)
    session.status = "completed"
    session.ended_at = datetime.utcnow()
    consultation.status = "completed"
    consultation.ended_at = consultation.ended_at or datetime.utcnow()
    db.commit()
    log_health_audit(db, "teleconsultation.completed", user.id, "teleconsultation_session", session.id, request=request)
    return _session_out(session, db)
