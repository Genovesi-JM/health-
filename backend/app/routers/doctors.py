from __future__ import annotations
"""
Doctors Router — Doctor profile, availability, and verification.
"""
import json
import logging
import re
import unicodedata
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
from app.routers.notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/doctors", tags=["doctors"])


def _json_list(val):
    if not val:
        return []
    try:
        return json.loads(val)
    except Exception:
        return []


# ── Public ──

@router.get("/", response_model=List[DoctorPublic])
def list_verified_doctors(
    specialty: str = Query(None),
    city: str = Query(None),
    consultation_type: str = Query(None),
    db: Session = Depends(get_db),
):
    """List verified doctors (public). Optional filters."""
    q = db.query(Doctor).filter(Doctor.verification_status == "verified")
    if specialty:
        q = q.filter(Doctor.specialization == specialty)
    if city:
        q = q.filter(Doctor.location_city.ilike(f"%{city}%"))
    doctors = q.all()
    result = []
    for d in doctors:
        pub = DoctorPublic.model_validate(d)
        pub.consultation_types = _json_list(d.consultation_types_json)
        pub.languages = _json_list(d.languages_json)
        pub.education = _json_list(d.education_json)
        if consultation_type and consultation_type not in (pub.consultation_types or []):
            continue
        result.append(pub)
    return result


@router.get("/by-slug/{slug}", response_model=DoctorPublic)
def get_doctor_by_slug(slug: str, db: Session = Depends(get_db)):
    """Get a single public doctor profile by slug."""
    doctor = db.query(Doctor).filter(
        Doctor.slug == slug,
        Doctor.verification_status == "verified",
    ).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Médico não encontrado.")
    pub = DoctorPublic.model_validate(doctor)
    pub.consultation_types = _json_list(doctor.consultation_types_json)
    pub.languages = _json_list(doctor.languages_json)
    pub.education = _json_list(doctor.education_json)
    return pub


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
    if body.display_name is not None:
        doctor.display_name = body.display_name
    if body.title is not None:
        doctor.title = body.title
    if body.license_number is not None:
        doctor.license_number = body.license_number
    if body.phone is not None:
        doctor.phone = body.phone
    if body.location_city is not None:
        doctor.location_city = body.location_city
    if body.location_province is not None:
        doctor.location_province = body.location_province
    if body.years_experience is not None:
        doctor.years_experience = body.years_experience
    if body.accepts_new_patients is not None:
        doctor.accepts_new_patients = body.accepts_new_patients
    if body.consultation_types is not None:
        doctor.consultation_types_json = json.dumps(body.consultation_types)
    if body.languages is not None:
        doctor.languages_json = json.dumps(body.languages)
    if body.education is not None:
        doctor.education_json = json.dumps(body.education)
    if body.price_min is not None:
        doctor.price_min = body.price_min
    if body.price_max is not None:
        doctor.price_max = body.price_max
    if body.photo_url is not None:
        doctor.photo_url = body.photo_url

    # Regenerate slug if display_name changed and no slug yet
    if body.display_name and not doctor.slug:
        from app.routers.auth import _unique_slug
        doctor.slug = _unique_slug(db, body.display_name)

    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    out = DoctorOut.model_validate(doctor)
    out.consultation_types = _json_list(doctor.consultation_types_json)
    out.languages = _json_list(doctor.languages_json)
    out.education = _json_list(doctor.education_json)
    return out


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

    # Notify the doctor of the verification outcome
    _ver_labels = {
        "verify":  ("Perfil verificado",  "A sua conta foi verificada. Pode agora receber consultas.", "success"),
        "reject":  ("Verificação recusada", f"A sua verificação foi recusada.{' Motivo: ' + body.reason if body.reason else ''}", "error"),
        "suspend": ("Conta suspensa",     f"A sua conta foi suspensa.{' Motivo: ' + body.reason if body.reason else ''}", "warning"),
    }
    if body.action in _ver_labels:
        title, msg, ntype = _ver_labels[body.action]
        try:
            create_notification(db, user_id=doctor.user_id, title=title, message=msg, type=ntype, entity_type="doctor", entity_id=doctor.id)
        except Exception:
            pass

    return doctor
