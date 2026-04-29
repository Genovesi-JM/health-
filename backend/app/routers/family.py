from __future__ import annotations
"""
Family Members Router — Patient-linked family/dependent profiles.

Endpoints:
- GET    /api/v1/family/me                         → patient's own family list
- POST   /api/v1/family                            → create member
- PATCH  /api/v1/family/{family_member_id}         → update member
- DELETE /api/v1/family/{family_member_id}         → delete member
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import FamilyMember, Patient
from app.health_schemas import (
    FamilyMemberCreate,
    FamilyMemberUpdate,
    FamilyMemberOut,
)
from app.rbac import get_patient_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/family", tags=["family"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_member_or_404(member_id: str, patient_id: str, db: Session) -> FamilyMember:
    m = db.query(FamilyMember).filter_by(id=member_id, owner_patient_id=patient_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Family member not found")
    return m


# ── list ─────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=List[FamilyMemberOut])
def list_family(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = get_patient_for_user(current_user, db)
    return (
        db.query(FamilyMember)
        .filter_by(owner_patient_id=patient.id)
        .order_by(FamilyMember.created_at.asc())
        .all()
    )


# ── create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=FamilyMemberOut, status_code=201)
def create_family_member(
    body: FamilyMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = get_patient_for_user(current_user, db)
    member = FamilyMember(
        owner_patient_id=patient.id,
        full_name=body.full_name,
        relationship=body.relationship,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        phone=body.phone,
        email=body.email,
        is_minor=body.is_minor,
        emergency_contact=body.emergency_contact,
        notes=body.notes,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


# ── update ────────────────────────────────────────────────────────────────────

@router.patch("/{family_member_id}", response_model=FamilyMemberOut)
def update_family_member(
    family_member_id: str,
    body: FamilyMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = get_patient_for_user(current_user, db)
    member = _get_member_or_404(family_member_id, patient.id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(member, field, value)
    db.commit()
    db.refresh(member)
    return member


# ── delete ────────────────────────────────────────────────────────────────────

@router.delete("/{family_member_id}", status_code=204)
def delete_family_member(
    family_member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = get_patient_for_user(current_user, db)
    member = _get_member_or_404(family_member_id, patient.id, db)
    db.delete(member)
    db.commit()
