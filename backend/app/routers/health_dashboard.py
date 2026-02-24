from __future__ import annotations
"""
Health Dashboard Router — KPIs and admin dashboard.

Replaces GeoVision dashboard KPIs with health platform metrics.

Endpoints:
- GET /api/v1/dashboard/health — Health KPIs (admin/doctor)
- GET /api/v1/dashboard/admin — Admin dashboard
"""
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    Patient, Doctor, Consultation, ConsultationNotes,
    TriageSession, TriageResult, Referral,
    HealthPayment, HealthAuditLog,
)
from app.health_schemas import (
    HealthKPIResponse, AdminDashboardResponse, PatientDashboardKPIs, RoleEnum,
)
from app.rbac import require_admin_or_support

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


# ── Patient-level KPIs (any authenticated user) ──

@router.get("/kpis", response_model=PatientDashboardKPIs)
def patient_kpis(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lightweight KPIs for the patient/user dashboard."""
    from datetime import date as _date
    today_start = datetime.combine(_date.today(), datetime.min.time())

    total_triage = db.query(TriageSession).count()
    total_consultations = db.query(Consultation).count()
    total_patients = db.query(Patient).count()
    total_doctors = db.query(Doctor).filter(Doctor.verification_status == "verified").count()
    consultations_today = db.query(Consultation).filter(
        Consultation.created_at >= today_start,
    ).count()

    avg_score_row = db.query(func.avg(TriageResult.score)).scalar()
    avg_score = round(float(avg_score_row), 1) if avg_score_row else None

    return PatientDashboardKPIs(
        total_triage_sessions=total_triage,
        total_consultations=total_consultations,
        total_patients=total_patients,
        total_doctors=total_doctors,
        consultations_today=consultations_today,
        avg_triage_score=avg_score,
    )


@router.get("/health", response_model=HealthKPIResponse)
def health_kpis(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get platform-wide health KPIs (admin, doctor, or support)."""
    if user.role not in (RoleEnum.ADMIN, RoleEnum.SUPPORT, RoleEnum.DOCTOR):
        raise HTTPException(status_code=403, detail="Acesso restrito.")

    since = datetime.utcnow() - timedelta(days=days)

    total_consultations = db.query(Consultation).filter(
        Consultation.created_at >= since,
    ).count()

    # Triage distribution
    triage_results = (
        db.query(TriageResult.risk_level, func.count(TriageResult.id))
        .join(TriageSession)
        .filter(TriageSession.created_at >= since)
        .group_by(TriageResult.risk_level)
        .all()
    )
    triage_dist = {level: count for level, count in triage_results}

    # Resolution and referral rates
    completed = db.query(Consultation).filter(
        Consultation.status == "completed",
        Consultation.created_at >= since,
    ).count()

    referral_count = db.query(Referral).join(Consultation).filter(
        Consultation.created_at >= since,
    ).count()

    resolution_rate = ((completed - referral_count) / completed * 100) if completed > 0 else 0
    referral_rate = (referral_count / completed * 100) if completed > 0 else 0

    # Avg time to accept (scheduled_at - created_at for accepted consults)
    # Simplified: use started_at - created_at
    from sqlalchemy import extract
    accepted_consults = (
        db.query(Consultation)
        .filter(
            Consultation.started_at.isnot(None),
            Consultation.created_at >= since,
        )
        .all()
    )
    if accepted_consults:
        total_minutes = sum(
            (c.started_at - c.created_at).total_seconds() / 60
            for c in accepted_consults
        )
        avg_accept = total_minutes / len(accepted_consults)
    else:
        avg_accept = None

    # Revenue
    revenue = db.query(func.sum(HealthPayment.amount)).filter(
        HealthPayment.status == "paid",
        HealthPayment.created_at >= since,
    ).scalar()

    return HealthKPIResponse(
        total_consultations=total_consultations,
        triage_distribution=triage_dist,
        resolution_rate=round(max(resolution_rate, 0), 1),
        referral_rate=round(referral_rate, 1),
        avg_time_to_accept_minutes=round(avg_accept, 1) if avg_accept else None,
        revenue_monthly=float(revenue) / 100 if revenue else None,  # centavos to AOA
    )


@router.get("/admin", response_model=AdminDashboardResponse)
def admin_dashboard(
    user: User = Depends(require_admin_or_support),
    db: Session = Depends(get_db),
):
    """Get admin dashboard metrics."""
    pending_verifications = db.query(Doctor).filter(
        Doctor.verification_status == "pending",
    ).count()

    # Flagged triage sessions (URGENT results)
    flagged = db.query(TriageResult).filter(
        TriageResult.risk_level == "URGENT",
    ).count()

    total_audit = db.query(HealthAuditLog).count()
    total_consultations = db.query(Consultation).count()
    total_patients = db.query(Patient).count()
    total_doctors = db.query(Doctor).count()

    # Revenue this month
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue = db.query(func.sum(HealthPayment.amount)).filter(
        HealthPayment.status == "paid",
        HealthPayment.created_at >= month_start,
    ).scalar()

    return AdminDashboardResponse(
        pending_verifications=pending_verifications,
        flagged_triage_sessions=flagged,
        total_audit_events=total_audit,
        total_consultations=total_consultations,
        total_patients=total_patients,
        total_doctors=total_doctors,
        revenue_this_month=float(revenue) / 100 if revenue else None,
    )
