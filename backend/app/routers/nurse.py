from __future__ import annotations
"""
Nurse Router — triage/consultation monitoring for nurses.

Nurses support patients and monitor the incoming queue and triage risk, but do
NOT prescribe, complete consultations, or verify clinicians (doctor/admin only).

- GET /api/v1/nurse/dashboard — counts + recent queue with risk
- GET /api/v1/nurse/queue     — pending requests with triage risk (read-only)
"""
import logging
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, Consultation, TriageSession, TriageResult

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nurse"])


def require_nurse(user: User = Depends(get_current_user)) -> User:
    if user.role != "nurse":
        raise HTTPException(status_code=403, detail="Acesso reservado a enfermeiros.")
    return user


def _patient_name(patient_id: str, db: Session) -> str:
    pat = db.get(Patient, patient_id)
    if not pat:
        return "Paciente"
    u = db.get(User, pat.user_id)
    return (getattr(u, "name", None) or (u.email.split("@")[0] if u and u.email else "Paciente"))


def _queue_items(db: Session, limit: int = 50):
    rows = (
        db.query(Consultation)
        .filter(Consultation.doctor_id.is_(None), Consultation.status == "requested")
        .order_by(Consultation.created_at.asc())
        .limit(limit)
        .all()
    )
    items = []
    for c in rows:
        risk = None
        complaint = None
        if c.triage_session_id:
            tri = db.get(TriageSession, c.triage_session_id)
            if tri:
                complaint = tri.chief_complaint
                res = db.query(TriageResult).filter(TriageResult.triage_session_id == tri.id).first()
                if res:
                    risk = res.risk_level
        items.append({
            "id": c.id,
            "patient": _patient_name(c.patient_id, db),
            "specialty": c.specialty,
            "risk_level": risk,
            "chief_complaint": complaint,
            "created_at": c.created_at,
        })
    return items


@router.get("/api/v1/nurse/queue")
def nurse_queue(user: User = Depends(require_nurse), db: Session = Depends(get_db)):
    return _queue_items(db)


@router.get("/api/v1/nurse/dashboard")
def nurse_dashboard(user: User = Depends(require_nurse), db: Session = Depends(get_db)):
    items = _queue_items(db)
    urgent = sum(1 for i in items if (i["risk_level"] or "").upper() in ("URGENT", "HIGH"))
    today_start = datetime.combine(date.today(), datetime.min.time())
    triages_today = (
        db.query(TriageSession)
        .filter(TriageSession.created_at >= today_start)
        .count()
    )
    return {
        "queue_count": len(items),
        "urgent_count": urgent,
        "triages_today": triages_today,
        "recent": items[:10],
    }
