from __future__ import annotations
"""
Patient Medications Router — Self-reported current medications.

Endpoints:
- GET    /api/v1/medications/me                       → patient's own list
- POST   /api/v1/medications                          → create (patient)
- PATCH  /api/v1/medications/{medication_id}          → update (patient/admin)
- DELETE /api/v1/medications/{medication_id}          → delete (patient/admin)
- GET    /api/v1/medications/patient/{patient_id}     → doctor/admin view
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import PatientMedication, Patient
from app.health_schemas import (
    PatientMedicationCreate,
    PatientMedicationUpdate,
    PatientMedicationOut,
    RoleEnum,
)
from app.rbac import get_patient_for_user, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/medications", tags=["medications"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_own_med_or_404(med_id: str, patient_id: str, db: Session) -> PatientMedication:
    med = db.query(PatientMedication).filter_by(id=med_id, patient_id=patient_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    return med


# ── patient: list own medications ────────────────────────────────────────────

@router.get("/me", response_model=List[PatientMedicationOut])
def list_my_medications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = get_patient_for_user(current_user, db)
    return (
        db.query(PatientMedication)
        .filter_by(patient_id=patient.id)
        .order_by(PatientMedication.is_current.desc(), PatientMedication.created_at.desc())
        .all()
    )


# ── patient: create medication ───────────────────────────────────────────────

@router.post("", response_model=PatientMedicationOut, status_code=201)
def create_medication(
    body: PatientMedicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = get_patient_for_user(current_user, db)
    med = PatientMedication(
        patient_id=patient.id,
        medication_name=body.medication_name,
        dosage=body.dosage,
        frequency=body.frequency,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
        reason=body.reason,
        prescribed_by=body.prescribed_by,
        notes=body.notes,
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


# ── patient / admin: update medication ───────────────────────────────────────

@router.patch("/{medication_id}", response_model=PatientMedicationOut)
def update_medication(
    medication_id: str,
    body: PatientMedicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Admin/support can patch any; patients only their own
    if current_user.role in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        med = db.query(PatientMedication).filter_by(id=medication_id).first()
        if not med:
            raise HTTPException(status_code=404, detail="Medication not found")
    else:
        patient = get_patient_for_user(current_user, db)
        med = _get_own_med_or_404(medication_id, patient.id, db)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(med, field, value)

    db.commit()
    db.refresh(med)
    return med


# ── patient / admin: delete medication ───────────────────────────────────────

@router.delete("/{medication_id}", status_code=204)
def delete_medication(
    medication_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        med = db.query(PatientMedication).filter_by(id=medication_id).first()
        if not med:
            raise HTTPException(status_code=404, detail="Medication not found")
    else:
        patient = get_patient_for_user(current_user, db)
        med = _get_own_med_or_404(medication_id, patient.id, db)

    db.delete(med)
    db.commit()


# ── doctor / admin: view any patient's medications ───────────────────────────

@router.get("/patient/{patient_id}", response_model=List[PatientMedicationOut])
def list_patient_medications(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([RoleEnum.DOCTOR, RoleEnum.ADMIN, RoleEnum.SUPPORT])
    ),
):
    patient = db.query(Patient).filter_by(id=patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return (
        db.query(PatientMedication)
        .filter_by(patient_id=patient_id)
        .order_by(PatientMedication.is_current.desc(), PatientMedication.created_at.desc())
        .all()
    )
