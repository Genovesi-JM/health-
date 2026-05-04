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
from app.health_models import Patient, Doctor, PrescriptionRequest, StandalonePrescription
from app.health_schemas import (
    PrescriptionRequestCreate,
    PrescriptionRequestDecide,
    PrescriptionRequestOut,
)
from app.routers.notifications import create_notification
from app.rbac import log_health_audit

logger = logging.getLogger(__name__)
router = APIRouter(tags=["prescription-requests"])

# Maps the action submitted by the doctor → the normalized status stored in DB.
# Status vocabulary: pending | approved | adjusted | consult_requested | exams_requested | rejected
ACTION_TO_STATUS: dict[str, str] = {
    "approve":           "approved",
    "adjusted":          "adjusted",   # alias: doctor can POST action=adjusted
    "adjust":            "adjusted",
    "consult_requested": "consult_requested",
    "exams_requested":   "exams_requested",
    "reject":            "rejected",
    "rejected":          "rejected",   # alias
}
VALID_ACTIONS = set(ACTION_TO_STATUS.keys())


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


# ── Risk scoring ─────────────────────────────────────────────────────────────

# Medications that require extra caution
_HIGH_RISK_MEDS = {
    "warfarina", "warfarin", "digoxina", "digoxin", "lítio", "lithium",
    "metotrexato", "methotrexate", "amiodarona", "amiodarone",
    "insulina", "insulin", "morfina", "morphine", "fentanil", "fentanyl",
    "clozapina", "clozapine", "talidomida", "thalidomide",
}


def _calculate_risk(
    patient,
    medication_name: str,
    dose: str | None,
    db,
) -> tuple[str, str | None]:
    """Return (risk_level, risk_alert) for a new prescription request.

    Levels: low | medium | high
    """
    alerts: list[str] = []
    level = "low"

    med_lower = medication_name.lower()

    # 1. High-risk medication list
    for hm in _HIGH_RISK_MEDS:
        if hm in med_lower:
            alerts.append(f"Medicamento de alto risco: {medication_name}.")
            level = "high"
            break

    # 2. Allergy match
    try:
        allergies: list[str] = json.loads(patient.allergies_json or "[]")
        for allergy in allergies:
            if allergy.lower() in med_lower or med_lower in allergy.lower():
                alerts.append(f"ATENÇÃO: Possível alergia a '{allergy}' — revisar antes de aprovar.")
                level = "high"
    except Exception:
        pass

    # 3. Duplicate active medication check
    try:
        from app.health_models import PatientMedication
        active_meds = (
            db.query(PatientMedication.medication_name)
            .filter_by(patient_id=patient.id, is_current=True)
            .all()
        )
        for (active_name,) in active_meds:
            if active_name and active_name.lower() in med_lower:
                alerts.append(f"Duplicado potencial: paciente já toma '{active_name}'.")
                if level == "low":
                    level = "medium"
    except Exception:
        pass

    # 4. Chronic conditions risk flags
    try:
        conditions: list[str] = json.loads(patient.chronic_conditions_json or "[]")
        cond_str = " ".join(conditions).lower()
        if "insuficiência renal" in cond_str or "renal" in cond_str:
            alerts.append("Atenção: insuficiência renal — ajustar dose conforme função renal.")
            if level == "low":
                level = "medium"
        if "insuficiência cardíaca" in cond_str or "cardíaca" in cond_str:
            alerts.append("Atenção: insuficiência cardíaca — monitorizar interações cardíacas.")
            if level == "low":
                level = "medium"
        if "gravidez" in cond_str or "grávida" in cond_str or "pregnancy" in cond_str:
            alerts.append("ATENÇÃO: Paciente grávida — verificar segurança na gravidez.")
            level = "high"
        if "diabetes" in cond_str and "insulina" in med_lower:
            alerts.append("Paciente diabético recebendo insulina — monitorizar glicemia.")
            if level == "low":
                level = "medium"
    except Exception:
        pass

    # 5. Age-related risk (>75 years)
    try:
        if patient.date_of_birth:
            dob = datetime.strptime(patient.date_of_birth, "%Y-%m-%d")
            age = (datetime.utcnow() - dob).days // 365
            if age >= 75:
                alerts.append(f"Paciente idoso ({age} anos) — revisar dose e interações.")
                if level == "low":
                    level = "medium"
    except Exception:
        pass

    alert_text = " | ".join(alerts) if alerts else None
    return level, alert_text


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

    # ── Risk scoring ──────────────────────────────────────────────────────────
    risk_level, risk_alert = _calculate_risk(patient, body.medication_name, body.dose, db)

    req = PrescriptionRequest(
        patient_id=patient.id,
        doctor_id=doctor.id,
        medication_name=body.medication_name,
        dose=body.dose,
        frequency=body.frequency,
        reason=body.reason,
        status="pending",
        risk_level=risk_level,
        risk_alert=risk_alert,
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
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Acesso reservado a médicos.")

    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    q = db.query(PrescriptionRequest).filter(PrescriptionRequest.doctor_id == doctor.id)
    if status and status != "all":
        q = q.filter(PrescriptionRequest.status == status)
    elif not status:
        # Default: show pending requests only when no filter is explicitly provided
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
    # Only doctors may decide prescription requests.
    # Admins must not process clinical requests unless they are explicitly
    # impersonating a doctor (indicated by the X-Impersonate-Doctor header,
    # which is validated separately). Plain admin access is denied here.
    if user.role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Administradores não podem processar pedidos de prescrição directamente. "
                   "Utilize o modo de suporte/impersonalização se for necessário.",
        )
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Acesso negado.")

    if body.action not in VALID_ACTIONS:
        valid_display = sorted({"approve", "adjust", "consult_requested", "exams_requested", "reject"})
        raise HTTPException(status_code=422, detail=f"Acção inválida. Válidas: {', '.join(valid_display)}")

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

    req.status = ACTION_TO_STATUS[body.action]
    req.doctor_note = body.doctor_note
    req.adjusted_dose = body.adjusted_dose
    req.adjusted_frequency = body.adjusted_frequency
    req.decided_at = datetime.utcnow()

    db.commit()
    db.refresh(req)

    # ── Create a formal prescription record when approved or adjusted ─────────
    final_status = req.status
    if final_status in ("approved", "adjusted"):
        try:
            from datetime import timedelta
            sp = StandalonePrescription(
                prescription_request_id=req.id,
                patient_id=req.patient_id,
                doctor_id=req.doctor_id,
                medication_name=req.medication_name,
                dosage=body.adjusted_dose if final_status == "adjusted" else req.dose,
                frequency=body.adjusted_frequency if final_status == "adjusted" else req.frequency,
                instructions=body.doctor_note,
                issue_date=datetime.utcnow(),
                valid_until=datetime.utcnow() + timedelta(days=30),
                pharmacy_status="pending_pharmacy",
            )
            db.add(sp)
            db.commit()
        except Exception as exc:
            logger.error("Failed to create standalone prescription for request %s: %s", req.id, exc)
            db.rollback()

    # ── Audit log ─────────────────────────────────────────────────────────────
    action_label = {
        "approved":          "prescription_request_approved",
        "adjusted":          "prescription_request_adjusted",
        "consult_requested": "prescription_request_consult_requested",
        "exams_requested":   "prescription_request_exams_requested",
        "rejected":          "prescription_request_rejected",
    }.get(final_status, "prescription_request_decided")
    try:
        log_health_audit(
            db,
            action=action_label,
            actor_user_id=user.id,
            resource_type="prescription_request",
            resource_id=req.id,
            metadata={
                "doctor_id": doctor.id,
                "patient_id": req.patient_id,
                "medication": req.medication_name,
                "status": final_status,
            },
        )
    except Exception:
        pass

    # ── Notify patient ────────────────────────────────────────────────────────
    _status_labels = {
        "approved":          ("Prescrição aprovada",           "success"),
        "adjusted":          ("Prescrição com ajuste de dose", "info"),
        "consult_requested": ("Consulta solicitada",           "warning"),
        "exams_requested":   ("Exames solicitados",            "warning"),
        "rejected":          ("Prescrição recusada",           "error"),
    }
    label, notif_type = _status_labels.get(req.status, ("Pedido processado", "info"))
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
