"""
Doctors Router — Doctor profile, availability, and verification.
"""
import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserProfile
from app.health_models import Doctor, DoctorAvailability
from app.health_schemas import (
    DoctorCreate, DoctorUpdate, DoctorOut, DoctorPublic,
    DoctorVerifyRequest, AvailabilitySlot, AvailabilityOut, RoleEnum,
)
from app.rbac import (
    require_verified_doctor, get_doctor_for_user,
    require_admin_or_support, log_health_audit,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/doctors", tags=["doctors"])


# ── Public ──

@router.get("/", response_model=List[DoctorPublic])
def list_verified_doctors(
    specialty: str = Query(None),
    db: Session = Depends(get_db),
):
    """List verified doctors (public). Optional specialty filter."""
    q = db.query(Doctor).filter(Doctor.verification_status == "verified")
    if specialty:
        q = q.filter(Doctor.specialization == specialty)
    return q.all()


# ── Doctor self-management ──

@router.post("/profile", response_model=DoctorOut)
def create_doctor_profile(
    body: DoctorCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register as a doctor (pending verification)."""
    existing = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Perfil de médico já existe.")

    if user.role not in (RoleEnum.DOCTOR, RoleEnum.ADMIN):
        user.role = RoleEnum.DOCTOR
        db.add(user)

    doctor = Doctor(
        user_id=user.id,
        license_number=body.license_number,
        specialization=body.specialization,
        bio=body.bio,
        verification_status="pending",
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.get("/me", response_model=DoctorOut)
def get_my_doctor_profile(doctor: Doctor = Depends(get_doctor_for_user)):
    """Get the current doctor's profile."""
    return doctor


@router.patch("/me", response_model=DoctorOut)
def update_my_doctor_profile(
    body: DoctorUpdate,
    doctor: Doctor = Depends(get_doctor_for_user),
    db: Session = Depends(get_db),
):
    """Update the current doctor's profile."""
    if body.specialization is not None:
        doctor.specialization = body.specialization
    if body.bio is not None:
        doctor.bio = body.bio
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


# ── Availability ──

@router.get("/me/availability", response_model=List[AvailabilityOut])
def get_my_availability(
    doctor: Doctor = Depends(get_doctor_for_user),
    db: Session = Depends(get_db),
):
    """Get the current doctor's availability slots."""
    return db.query(DoctorAvailability).filter(
        DoctorAvailability.doctor_id == doctor.id
    ).all()


@router.post("/me/availability", response_model=AvailabilityOut)
def add_availability_slot(
    body: AvailabilitySlot,
    doctor: Doctor = Depends(get_doctor_for_user),
    db: Session = Depends(get_db),
):
    """Add an availability slot."""
    slot = DoctorAvailability(
        doctor_id=doctor.id,
        day_of_week=body.day_of_week,
        start_time=body.start_time,
        end_time=body.end_time,
        is_active=body.is_active,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/me/availability/{slot_id}")
def delete_availability_slot(
    slot_id: str,
    doctor: Doctor = Depends(get_doctor_for_user),
    db: Session = Depends(get_db),
):
    """Delete an availability slot."""
    slot = db.query(DoctorAvailability).filter(
        DoctorAvailability.id == slot_id,
        DoctorAvailability.doctor_id == doctor.id,
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot não encontrado.")
    db.delete(slot)
    db.commit()
    return {"detail": "Slot removido."}


# ── Admin verification ──

@router.get("/pending", response_model=List[DoctorOut],
            dependencies=[Depends(require_admin_or_support)])
def list_pending_doctors(db: Session = Depends(get_db)):
    """List doctors pending verification (admin only)."""
    return db.query(Doctor).filter(Doctor.verification_status == "pending").all()


@router.post("/{doctor_id}/verify", response_model=DoctorOut,
             dependencies=[Depends(require_admin_or_support)])
def verify_doctor(
    doctor_id: str,
    body: DoctorVerifyRequest,
    user: User = Depends(require_admin_or_support),
    db: Session = Depends(get_db),
):
    """Verify, reject, or suspend a doctor (admin only)."""
    from datetime import datetime
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico não encontrado.")

    action_map = {
        "verify": "verified",
        "reject": "rejected",
        "suspend": "suspended",
    }
    doctor.verification_status = action_map[body.action]
    if body.action == "verify":
        doctor.verified_at = datetime.utcnow()
        doctor.verified_by = user.id
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    log_health_audit(
        db,
        action=f"doctor_{body.action}",
        actor_user_id=user.id,
        resource_type="doctor",
        resource_id=doctor.id,
        metadata={"reason": body.reason},
    )

    return doctor
