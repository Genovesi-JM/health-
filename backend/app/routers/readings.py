from __future__ import annotations
"""
Device Readings Router — Manual patient health measurements.

Endpoints:
- GET  /api/v1/readings/me                        → patient's own readings
- POST /api/v1/readings                            → create a reading (patient)
- GET  /api/v1/readings/patient/{patient_id}       → doctor/admin view
- DELETE /api/v1/readings/{reading_id}             → patient or admin delete
"""
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import DeviceReading, Patient
from app.health_schemas import (
    DeviceReadingCreate,
    DeviceReadingOut,
    DeviceReadingListOut,
    RoleEnum,
)
from app.rbac import get_patient_for_user, require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/readings", tags=["readings"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _build_reading(patient_id: str, body: DeviceReadingCreate) -> DeviceReading:
    """Map schema → model, defaulting measured_at to now."""
    return DeviceReading(
        patient_id=patient_id,
        reading_type=body.reading_type,
        value=body.value,
        unit=body.unit,
        systolic=body.systolic,
        diastolic=body.diastolic,
        pulse=body.pulse,
        measured_at=body.measured_at or datetime.utcnow(),
        source=body.source or "manual",
        device_brand=body.device_brand,
        device_model=body.device_model,
        notes=body.notes,
    )


def _validate_reading(body: DeviceReadingCreate) -> None:
    """Cross-field validation beyond the Pydantic regex."""
    if body.reading_type == "blood_pressure":
        if body.systolic is None or body.diastolic is None:
            raise HTTPException(
                status_code=422,
                detail="blood_pressure readings require systolic and diastolic values.",
            )
    else:
        if body.value is None:
            raise HTTPException(
                status_code=422,
                detail=f"{body.reading_type} readings require a value.",
            )


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=DeviceReadingListOut)
def list_my_readings(
    reading_type: Optional[str] = Query(default=None, description="Filter by type"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Return paginated readings for the authenticated patient."""
    q = db.query(DeviceReading).filter(DeviceReading.patient_id == patient.id)
    if reading_type:
        q = q.filter(DeviceReading.reading_type == reading_type)
    total = q.count()
    readings = (
        q.order_by(DeviceReading.measured_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return DeviceReadingListOut(total=total, readings=readings)


@router.post("", response_model=DeviceReadingOut, status_code=201)
def create_reading(
    body: DeviceReadingCreate,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Create a new device reading for the authenticated patient."""
    _validate_reading(body)
    reading = _build_reading(patient.id, body)
    db.add(reading)
    db.commit()
    db.refresh(reading)
    logger.info("DeviceReading created id=%s type=%s patient=%s", reading.id, reading.reading_type, patient.id)
    return reading


@router.get("/patient/{patient_id}", response_model=DeviceReadingListOut)
def list_patient_readings(
    patient_id: str,
    reading_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles([RoleEnum.DOCTOR, RoleEnum.ADMIN, RoleEnum.SUPPORT])),
    db: Session = Depends(get_db),
):
    """Doctor/admin endpoint — view any patient's readings."""
    # Verify the patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    q = db.query(DeviceReading).filter(DeviceReading.patient_id == patient_id)
    if reading_type:
        q = q.filter(DeviceReading.reading_type == reading_type)
    total = q.count()
    readings = (
        q.order_by(DeviceReading.measured_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return DeviceReadingListOut(total=total, readings=readings)


@router.delete("/{reading_id}", status_code=204)
def delete_reading(
    reading_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a reading.

    - Patients may only delete their own readings.
    - Admin/support may delete any reading.
    """
    reading = db.get(DeviceReading, reading_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Leitura não encontrada.")

    if user.role in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        # Privileged delete — no ownership check
        pass
    else:
        # Patient must own the reading
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or reading.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Não tem permissão para eliminar esta leitura.")

    db.delete(reading)
    db.commit()
