"""Role-Based Access Control (RBAC) dependencies for the Health Platform.

Follows the existing deps.py patterns (get_current_user, require_admin)
and extends them with health-specific role checks and row-level access.
"""
from typing import List, Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, Doctor, CorporateAccount, CorporateMember, HealthAuditLog
from app.health_schemas import RoleEnum

import json


# ═══════════════════════════════════════════════════════════════
# Role-based dependency factories
# ═══════════════════════════════════════════════════════════════

def require_roles(allowed_roles: List[str]):
    """Dependency factory that returns a function requiring specific roles.

    Usage:
        @router.get("/...", dependencies=[Depends(require_roles(["admin", "doctor"]))])
    or:
        user: User = Depends(require_roles(["patient"]))
    """
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Acesso negado. Funções permitidas: {', '.join(allowed_roles)}",
            )
        return user
    return _check


def require_patient(user: User = Depends(get_current_user)) -> User:
    """Require the current user to have the 'patient' role."""
    if user.role != RoleEnum.PATIENT:
        raise HTTPException(status_code=403, detail="Acesso restrito a pacientes.")
    return user


def require_doctor(user: User = Depends(get_current_user)) -> User:
    """Require the current user to have the 'doctor' role."""
    if user.role != RoleEnum.DOCTOR:
        raise HTTPException(status_code=403, detail="Acesso restrito a médicos.")
    return user


def require_verified_doctor(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Require the current user to be a verified doctor."""
    if user.role != RoleEnum.DOCTOR:
        raise HTTPException(status_code=403, detail="Acesso restrito a médicos.")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor or doctor.verification_status != "verified":
        raise HTTPException(status_code=403, detail="Médico não verificado.")
    return user


def require_corporate(user: User = Depends(get_current_user)) -> User:
    """Require corporate_admin or corporate_analyst role."""
    if user.role not in (RoleEnum.CORPORATE_ADMIN, RoleEnum.CORPORATE_ANALYST):
        raise HTTPException(status_code=403, detail="Acesso restrito a contas corporativas.")
    return user


def require_admin_or_support(user: User = Depends(get_current_user)) -> User:
    """Require admin or support role."""
    if user.role not in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")
    return user


# ═══════════════════════════════════════════════════════════════
# Row-level access helpers
# ═══════════════════════════════════════════════════════════════

def get_patient_for_user(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Patient:
    """Get the Patient record linked to the current user."""
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Perfil de paciente não encontrado. Complete o registo primeiro.")
    return patient


def get_doctor_for_user(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Doctor:
    """Get the Doctor record linked to the current user."""
    if user.role not in (RoleEnum.DOCTOR, RoleEnum.ADMIN):
        raise HTTPException(status_code=403, detail="Acesso restrito a médicos.")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")
    return doctor


def get_corporate_for_user(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CorporateAccount:
    """Get the CorporateAccount linked to the current user."""
    if user.role not in (RoleEnum.CORPORATE_ADMIN, RoleEnum.CORPORATE_ANALYST, RoleEnum.ADMIN):
        raise HTTPException(status_code=403, detail="Acesso restrito a contas corporativas.")
    corp = db.query(CorporateAccount).filter(CorporateAccount.admin_user_id == user.id).first()
    if not corp:
        raise HTTPException(status_code=404, detail="Conta corporativa não encontrada.")
    return corp


# ═══════════════════════════════════════════════════════════════
# Consent enforcement
# ═══════════════════════════════════════════════════════════════

REQUIRED_CONSENTS = ["privacy_policy", "telemedicine_consent", "terms_of_service"]


def require_consents(
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
) -> Patient:
    """Ensure the patient has accepted all required consents before booking."""
    from app.health_models import PatientConsent
    existing = (
        db.query(PatientConsent.consent_type)
        .filter(PatientConsent.patient_id == patient.id)
        .all()
    )
    accepted = {row[0] for row in existing}
    missing = set(REQUIRED_CONSENTS) - accepted
    if missing:
        raise HTTPException(
            status_code=403,
            detail=f"Consentimentos obrigatórios em falta: {', '.join(sorted(missing))}",
        )
    return patient


# ═══════════════════════════════════════════════════════════════
# Audit logging helper
# ═══════════════════════════════════════════════════════════════

def log_health_audit(
    db: Session,
    action: str,
    actor_user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None,
):
    """Write a health-specific audit log entry."""
    ip = None
    ua = None
    if request:
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
        ua = (request.headers.get("user-agent") or "")[:500]

    entry = HealthAuditLog(
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata_json=json.dumps(metadata, default=str) if metadata else None,
        ip_address=ip,
        user_agent=ua,
    )
    try:
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
