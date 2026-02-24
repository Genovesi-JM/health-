from __future__ import annotations
"""
Corporate Router — Corporate account management and KPIs.

Endpoints:
- POST /api/v1/corporate/accounts — Create corporate account
- GET  /api/v1/corporate/accounts/me — Get my corporate account
- POST /api/v1/corporate/enroll — Enroll an employee
- GET  /api/v1/corporate/kpis — Aggregated KPIs (no PII)
"""
import hashlib
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    Patient, CorporateAccount, CorporateMember,
    Consultation, TriageResult, TriageSession, Referral,
)
from app.health_schemas import (
    CorporateAccountCreate, CorporateAccountOut,
    CorporateEnrollRequest, CorporateKPIOut, RoleEnum,
)
from app.rbac import require_corporate, get_corporate_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/corporate", tags=["corporate"])


@router.post("/accounts", response_model=CorporateAccountOut)
def create_corporate_account(
    body: CorporateAccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new corporate account (assigns current user as admin)."""
    existing = db.query(CorporateAccount).filter(
        CorporateAccount.admin_user_id == user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Já tem uma conta corporativa.")

    user.role = RoleEnum.CORPORATE_ADMIN
    db.add(user)

    corp = CorporateAccount(
        company_name=body.company_name,
        tax_id=body.tax_id,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        max_employees=body.max_employees,
        admin_user_id=user.id,
    )
    db.add(corp)
    db.commit()
    db.refresh(corp)
    return corp


@router.get("/accounts/me", response_model=CorporateAccountOut)
def get_my_corporate_account(
    corp: CorporateAccount = Depends(get_corporate_for_user),
):
    """Get the current user's corporate account."""
    return corp


@router.post("/enroll")
def enroll_employee(
    body: CorporateEnrollRequest,
    corp: CorporateAccount = Depends(get_corporate_for_user),
    db: Session = Depends(get_db),
):
    """Enroll a patient as a corporate member."""
    # Check capacity
    current_count = db.query(CorporateMember).filter(
        CorporateMember.corporate_id == corp.id,
        CorporateMember.is_active == True,
    ).count()
    if current_count >= corp.max_employees:
        raise HTTPException(status_code=400, detail="Limite de colaboradores atingido.")

    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    existing = db.query(CorporateMember).filter(
        CorporateMember.corporate_id == corp.id,
        CorporateMember.patient_id == body.patient_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Paciente já inscrito.")

    code_hash = None
    if body.employee_code:
        code_hash = hashlib.sha256(body.employee_code.encode()).hexdigest()

    member = CorporateMember(
        corporate_id=corp.id,
        patient_id=body.patient_id,
        employee_code_hash=code_hash,
    )
    db.add(member)
    db.commit()
    return {"detail": "Colaborador inscrito com sucesso."}


@router.get("/kpis", response_model=CorporateKPIOut)
def corporate_kpis(
    corp: CorporateAccount = Depends(get_corporate_for_user),
    db: Session = Depends(get_db),
):
    """Get aggregated KPIs for the corporate account (no PII)."""
    member_patient_ids = [
        m.patient_id for m in
        db.query(CorporateMember).filter(
            CorporateMember.corporate_id == corp.id,
            CorporateMember.is_active == True,
        ).all()
    ]

    employees_covered = len(member_patient_ids)

    # Consultation stats
    if member_patient_ids:
        total_consults = db.query(Consultation).filter(
            Consultation.patient_id.in_(member_patient_ids),
        ).count()

        completed_consults = db.query(Consultation).filter(
            Consultation.patient_id.in_(member_patient_ids),
            Consultation.status == "completed",
        ).count()

        referral_count = db.query(Referral).join(Consultation).filter(
            Consultation.patient_id.in_(member_patient_ids),
        ).count()

        # Triage distribution
        triage_results = (
            db.query(TriageResult.risk_level, func.count(TriageResult.id))
            .join(TriageSession)
            .filter(TriageSession.patient_id.in_(member_patient_ids))
            .group_by(TriageResult.risk_level)
            .all()
        )
        triage_dist = {level: count for level, count in triage_results}

        # Top specialties
        specialty_counts = (
            db.query(Consultation.specialty, func.count(Consultation.id))
            .filter(Consultation.patient_id.in_(member_patient_ids))
            .group_by(Consultation.specialty)
            .order_by(func.count(Consultation.id).desc())
            .limit(5)
            .all()
        )
        top_specs = [{"specialty": s, "count": c} for s, c in specialty_counts]
    else:
        total_consults = 0
        completed_consults = 0
        referral_count = 0
        triage_dist = {}
        top_specs = []

    consults_per_100 = (total_consults / employees_covered * 100) if employees_covered > 0 else 0
    resolution_rate = ((completed_consults - referral_count) / completed_consults * 100) if completed_consults > 0 else 0
    referral_rate = (referral_count / completed_consults * 100) if completed_consults > 0 else 0

    return CorporateKPIOut(
        employees_covered=employees_covered,
        consultations_total=total_consults,
        consultations_per_100=round(consults_per_100, 1),
        triage_distribution=triage_dist,
        resolution_rate=round(max(resolution_rate, 0), 1),
        referral_rate=round(referral_rate, 1),
        top_specialties=top_specs,
    )
