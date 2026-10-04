"""Current professional authority, checked independently of cached profile flags."""
from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.health_models import ClinicianCredential, Doctor
from app.models import User


def licence_is_current(credential: ClinicianCredential) -> bool:
    """Use the expiry scanner's day-of-expiry rule, without waiting for a scan."""
    if not credential.licence_expiry_date:
        return True
    try:
        return date.fromisoformat(credential.licence_expiry_date) > date.today()
    except (TypeError, ValueError):
        return False


def require_current_clinician(user: User, db: Session) -> ClinicianCredential:
    if not user.is_active or user.role not in ("doctor", "nurse"):
        raise HTTPException(403, "Acesso restrito a profissionais clínicos.")
    credential = db.query(ClinicianCredential).filter(
        ClinicianCredential.user_id == user.id,
        ClinicianCredential.profession == user.role,
    ).first()
    status = credential.status if credential else "not_started"
    if credential and status == "verified" and not licence_is_current(credential):
        status = "expired"
    if status == "verified" and user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor or doctor.verification_status != "verified":
            status = doctor.verification_status if doctor else "not_started"
    if status != "verified":
        raise HTTPException(403, detail={
            "code": "credential_verification_required",
            "message": "Conclua a verificação profissional antes de aceder a funções clínicas.",
            "status": status,
        })
    return credential


def require_doctor_profile_access(user: User, db: Session) -> None:
    """Allow onboarding profile edits while keeping withdrawn authority blocked."""
    credential = db.query(ClinicianCredential).filter(
        ClinicianCredential.user_id == user.id,
        ClinicianCredential.profession == "doctor",
    ).first()
    if (
        not credential
        or credential.status in ("verified", "suspended", "revoked", "expired")
        or not licence_is_current(credential)
    ):
        require_current_clinician(user, db)
