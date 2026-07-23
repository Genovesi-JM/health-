from __future__ import annotations
"""
Consultation Messaging Router — text-based teleconsult between a patient and the
assigned doctor.

- POST /api/v1/consultations/{id}/messages   — send a message
- GET  /api/v1/consultations/{id}/messages   — list thread (marks incoming read)
- GET  /api/v1/doctor/message-threads        — doctor's threads
- GET  /api/v1/patient/message-threads       — patient's threads
"""
import logging
from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    Patient, Doctor, Consultation, ConsultationMessage,
)
from app.health_schemas import MessageCreate, MessageOut, MessageThreadOut

logger = logging.getLogger(__name__)

router = APIRouter(tags=["messages"])


def _access(consultation_id: str, user: User, db: Session) -> Tuple[Consultation, str]:
    """Return (consultation, role) if the user is the owning patient or the
    assigned doctor; else 403/404. role is 'patient' or 'doctor'."""
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if patient and c.patient_id == patient.id:
        return c, "patient"
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if doctor and c.doctor_id == doctor.id:
        return c, "doctor"
    raise HTTPException(status_code=403, detail="Sem acesso a esta conversa.")


def _display_name(user_id: str, db: Session) -> Optional[str]:
    u = db.get(User, user_id)
    if not u:
        return None
    return getattr(u, "name", None) or (u.email.split("@")[0] if u.email else None)


@router.post("/api/v1/consultations/{consultation_id}/messages", response_model=MessageOut, status_code=201)
def send_message(
    consultation_id: str,
    body: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c, role = _access(consultation_id, user, db)
    if c.doctor_id is None:
        raise HTTPException(status_code=400, detail="A consulta ainda não foi aceite por um médico.")
    msg = ConsultationMessage(
        consultation_id=consultation_id,
        sender_role=role,
        sender_user_id=user.id,
        body=body.body.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/api/v1/consultations/{consultation_id}/messages", response_model=List[MessageOut])
def list_messages(
    consultation_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c, role = _access(consultation_id, user, db)
    msgs = (
        db.query(ConsultationMessage)
        .filter(ConsultationMessage.consultation_id == consultation_id)
        .order_by(ConsultationMessage.created_at.asc())
        .all()
    )
    # Mark incoming (from the other party) as read.
    now = datetime.utcnow()
    for m in msgs:
        if m.sender_role != role and m.read_at is None:
            m.read_at = now
            db.add(m)
    db.commit()
    return msgs


def _threads_for(consultation_ids: List[str], viewer_role: str, db: Session) -> List[MessageThreadOut]:
    threads: List[MessageThreadOut] = []
    for cid in consultation_ids:
        c = db.get(Consultation, cid)
        if not c:
            continue
        last = (
            db.query(ConsultationMessage)
            .filter(ConsultationMessage.consultation_id == cid)
            .order_by(ConsultationMessage.created_at.desc())
            .first()
        )
        if not last:
            continue  # only show threads that have messages
        unread = (
            db.query(func.count(ConsultationMessage.id))
            .filter(
                ConsultationMessage.consultation_id == cid,
                ConsultationMessage.sender_role != viewer_role,
                ConsultationMessage.read_at.is_(None),
            )
            .scalar()
        ) or 0
        # counterparty name
        if viewer_role == "doctor":
            pat = db.get(Patient, c.patient_id)
            name = _display_name(pat.user_id, db) if pat else None
        else:
            doc = db.get(Doctor, c.doctor_id) if c.doctor_id else None
            name = (doc.display_name if doc and doc.display_name else
                    (_display_name(doc.user_id, db) if doc else None))
        threads.append(MessageThreadOut(
            consultation_id=cid, specialty=c.specialty, status=c.status,
            counterparty_name=name, last_message=last.body, last_at=last.created_at, unread=unread,
        ))
    threads.sort(key=lambda t: t.last_at or datetime.min, reverse=True)
    return threads


@router.get("/api/v1/doctor/message-threads", response_model=List[MessageThreadOut])
def doctor_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")
    cids = [
        r[0] for r in db.query(Consultation.id)
        .filter(Consultation.doctor_id == doctor.id).all()
    ]
    return _threads_for(cids, "doctor", db)


@router.get("/api/v1/patient/message-threads", response_model=List[MessageThreadOut])
def patient_threads(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado.")
    cids = [
        r[0] for r in db.query(Consultation.id)
        .filter(Consultation.patient_id == patient.id).all()
    ]
    return _threads_for(cids, "patient", db)
