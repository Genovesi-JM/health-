from __future__ import annotations
"""
Patients Router — Patient profile management and medical info.
"""
import json
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.health_models import Patient
from app.health_schemas import PatientCreate, PatientUpdate, PatientOut, PatientAdminOut, RoleEnum
from app.rbac import require_patient, get_patient_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])


# ── Admin: list all patients ──

@router.get("/", response_model=List[PatientAdminOut])
def list_patients(
    search: Optional[str] = Query(None, description="Filtrar por email ou nome"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all patients (admin only). Joins user table for email."""
    q = db.query(Patient).options(joinedload(Patient.user))

    if search:
        like_term = f"%{search}%"
        q = q.join(User, Patient.user_id == User.id).filter(
            User.email.ilike(like_term)
        )

    patients = q.order_by(Patient.created_at.desc()).offset(skip).limit(limit).all()
    return [_patient_admin_out(p) for p in patients]


@router.get("/{patient_id}", response_model=PatientAdminOut)
def get_patient_detail(
    patient_id: str,
    user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a single patient's full profile (admin only)."""
    patient = (
        db.query(Patient)
        .options(joinedload(Patient.user))
        .filter(Patient.id == patient_id)
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    return _patient_admin_out(patient)


def _patient_admin_out(p: Patient) -> PatientAdminOut:
    return PatientAdminOut(
        id=p.id,
        user_id=p.user_id,
        email=p.user.email if p.user else None,
        name=getattr(p.user, "name", None) if p.user else None,
        is_active=p.user.is_active if p.user else True,
        date_of_birth=p.date_of_birth,
        gender=p.gender,
        blood_type=p.blood_type,
        allergies=json.loads(p.allergies_json or "[]"),
        chronic_conditions=json.loads(p.chronic_conditions_json or "[]"),
        emergency_contact_name=p.emergency_contact_name,
        emergency_contact_phone=p.emergency_contact_phone,
        created_at=p.created_at,
    )


@router.post("/profile", response_model=PatientOut)
def create_patient_profile(
    body: PatientCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a patient profile for the current user."""
    existing = db.query(Patient).filter(Patient.user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Perfil de paciente já existe.")

    # Update user role to patient if not already set
    if user.role not in (RoleEnum.PATIENT, RoleEnum.ADMIN):
        user.role = RoleEnum.PATIENT
        db.add(user)

    patient = Patient(
        user_id=user.id,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        blood_type=body.blood_type,
        allergies_json=json.dumps(body.allergies or []),
        chronic_conditions_json=json.dumps(body.chronic_conditions or []),
        emergency_contact_name=body.emergency_contact_name,
        emergency_contact_phone=body.emergency_contact_phone,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _patient_to_out(patient)


@router.get("/me", response_model=PatientOut)
def get_my_profile(patient: Patient = Depends(get_patient_for_user)):
    """Get the current patient's profile."""
    return _patient_to_out(patient)


@router.patch("/me", response_model=PatientOut)
def update_my_profile(
    body: PatientUpdate,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Update the current patient's profile."""
    if body.date_of_birth is not None:
        patient.date_of_birth = body.date_of_birth
    if body.gender is not None:
        patient.gender = body.gender
    if body.blood_type is not None:
        patient.blood_type = body.blood_type
    if body.allergies is not None:
        patient.allergies_json = json.dumps(body.allergies)
    if body.chronic_conditions is not None:
        patient.chronic_conditions_json = json.dumps(body.chronic_conditions)
    if body.emergency_contact_name is not None:
        patient.emergency_contact_name = body.emergency_contact_name
    if body.emergency_contact_phone is not None:
        patient.emergency_contact_phone = body.emergency_contact_phone

    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _patient_to_out(patient)


def _patient_to_out(p: Patient) -> PatientOut:
    return PatientOut(
        id=p.id,
        user_id=p.user_id,
        date_of_birth=p.date_of_birth,
        gender=p.gender,
        blood_type=p.blood_type,
        allergies=json.loads(p.allergies_json or "[]"),
        chronic_conditions=json.loads(p.chronic_conditions_json or "[]"),
        emergency_contact_name=p.emergency_contact_name,
        emergency_contact_phone=p.emergency_contact_phone,
        created_at=p.created_at,
    )
