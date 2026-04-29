from __future__ import annotations
"""
Prescription Requests Router
Patient → requests medication renewal from doctor (no consultation needed)
Doctor → reviews patient profile + decides (approve / adjust / consult / exams / reject)

Endpoints:
  POST   /api/v1/prescription-requests              — patient creates request
  GET    /api/v1/doctor/prescription-requests        — doctor lists pending requests
  POST   /api/v1/doctor/prescription-requests/{id}/decide — doctor decides
  GET    /api/v1/prescription-requests               — patient lists own requests
"""
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserProfile
from app.health_models import Patient, Doctor, PrescriptionRequest
from app.health_schemas import (
    PrescriptionRequestCreate,
    PrescriptionRequestDecide,
    PrescriptionRequestOut,
)
from app.routers.notifications import create_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["prescription-requests"])

VALID_ACTIONS = {"approve", "adjust", "consult_requested", "exams_requested", "reject"}


def _enrich(req: PrescriptionRequest, db: Session) -> dict:
    """Attach patient demographics to a request dict."""
    d = {
        "id": req.id,
        "patient_id": req.patient_id,
        "doctor_id": req.doctor_id,
        "medication_name": req.medication_name,
        "dose": req.dose,
        "frequency": req.frequency,
        "reason": req.reason,
        "status": req.status,
        "risk_level": req.risk_level,
        "risk_alert": req.risk_alert,
        "doctor_note": req.doctor_note,
        "adjusted_dose": req.adjusted_dose,
        "adjusted_frequency": req.adjusted_frequency,
        "created_at": req.created_at,
        "decided_at": req.decided_at,
        "patient_name": None,
        "patient_age": None,
        "patient_gender": None,
        "chronic_conditions": [],
        "allergies": [],
    }
    patient = req.patient
    if patient:
        d["patient_gender"] = patient.gender
        try:
            d["chronic_conditions"] = json.loads(patient.chronic_conditions_json or "[]")
            d["allergies"] = json.loads(patient.allergies_json or "[]")
        except Exception:
            pass
        if patient.date_of_birth:
            try:
                dob = datetime.strptime(patient.date_of_birth, "%Y-%m-%d")
                d["patient_age"] = (datetime.utcnow() - dob).days // 365
            except Exception:
                pass
        # get name from user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == patient.user_id).first()
        if profile:
            d["patient_name"] = getattr(profile, "full_name", None) or getattr(profile, "display_name", None)
        if not d["patient_name"]:
            u = db.query(User).filter(User.id == patient.user_id).first()
            if u:
                d["patient_name"] = u.email.split("@")[0]
    return d


# ── Patient creates a request ──────────────────────────────────────────────

@router.post("/api/v1/prescription-requests", response_model=PrescriptionRequestOut, status_code=201)
def create_prescription_request(
    body: PrescriptionRequestCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Patient requests a prescription renewal from a specific doctor."""
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado.")

    doctor = db.query(Doctor).filter(Doctor.id == body.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico não encontrado.")

    req = PrescriptionRequest(
        patient_id=patient.id,
        doctor_id=doctor.id,
        medication_name=body.medication_name,
        dose=body.dose,
        frequency=body.frequency,
        reason=body.reason,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _enrich(req, db)


# ── Patient lists own requests ─────────────────────────────────────────────

@router.get("/api/v1/prescription-requests", response_model=List[PrescriptionRequestOut])
def list_my_prescription_requests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        return []
    reqs = (
        db.query(PrescriptionRequest)
        .filter(PrescriptionRequest.patient_id == patient.id)
        .order_by(PrescriptionRequest.created_at.desc())
        .all()
    )
    return [_enrich(r, db) for r in reqs]


# ── Doctor lists pending requests ─────────────────────────────────────────

@router.get("/api/v1/doctor/prescription-requests", response_model=List[PrescriptionRequestOut])
def list_doctor_prescription_requests(
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Acesso negado.")

    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    q = db.query(PrescriptionRequest).filter(PrescriptionRequest.doctor_id == doctor.id)
    if status:
        q = q.filter(PrescriptionRequest.status == status)
    else:
        q = q.filter(PrescriptionRequest.status == "pending")

    reqs = q.order_by(PrescriptionRequest.created_at.asc()).all()
    return [_enrich(r, db) for r in reqs]


# ── Doctor decides ─────────────────────────────────────────────────────────

@router.post("/api/v1/doctor/prescription-requests/{request_id}/decide", response_model=PrescriptionRequestOut)
def decide_prescription_request(
    request_id: str,
    body: PrescriptionRequestDecide,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Acesso negado.")

    if body.action not in VALID_ACTIONS:
        raise HTTPException(status_code=422, detail=f"Acção inválida. Válidas: {', '.join(VALID_ACTIONS)}")

    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    req = db.query(PrescriptionRequest).filter(
        PrescriptionRequest.id == request_id,
        PrescriptionRequest.doctor_id == doctor.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="Este pedido já foi processado.")

    req.status = body.action
    req.doctor_note = body.doctor_note
    req.adjusted_dose = body.adjusted_dose
    req.adjusted_frequency = body.adjusted_frequency
    req.decided_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    # ── Notify patient ────────────────────────────────────────────────────────
    _action_labels = {
        "approve":           ("Prescrição aprovada",           "success"),
        "adjust":            ("Prescrição com ajuste de dose", "info"),
        "consult_requested": ("Consulta solicitada",           "warning"),
        "exams_requested":   ("Exames solicitados",            "warning"),
        "reject":            ("Prescrição recusada",           "error"),
    }
    label, notif_type = _action_labels.get(body.action, ("Pedido processado", "info"))
    patient_obj = db.query(Patient).filter(Patient.id == req.patient_id).first()
    if patient_obj:
        msg = f"O seu pedido de {req.medication_name} foi processado."
        if body.doctor_note:
            msg += f" Nota: {body.doctor_note}"
        try:
            create_notification(
                db,
                user_id=patient_obj.user_id,
                title=label,
                message=msg,
                type=notif_type,
                entity_type="prescription_request",
                entity_id=req.id,
            )
        except Exception:
            pass  # never block the response

    return _enrich(req, db)
