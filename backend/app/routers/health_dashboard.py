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
    HealthKPIResponse, AdminDashboardResponse, PatientDashboardKPIs,
    PatientStateResponse, RoleEnum,
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


# ── Patient State (conversion-driven) ──

@router.get("/patient-state", response_model=PatientStateResponse)
def patient_state(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the patient's current funnel state with conversion CTAs."""

    # Find patient record
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        return PatientStateResponse(
            current_state="no_triage",
            state_label="Novo na plataforma",
            next_action="start_triage",
            next_action_label="Iniciar Primeira Triagem",
            next_action_urgency="low",
            triage_count=0,
            consultation_count=0,
            completed_consultations=0,
            pending_consultations=0,
        )

    # Get counts
    triage_count = db.query(TriageSession).filter(
        TriageSession.patient_id == patient.id,
    ).count()
    consultation_count = db.query(Consultation).filter(
        Consultation.patient_id == patient.id,
    ).count()
    completed_consultations = db.query(Consultation).filter(
        Consultation.patient_id == patient.id,
        Consultation.status == "completed",
    ).count()
    pending_consultations = db.query(Consultation).filter(
        Consultation.patient_id == patient.id,
        Consultation.status.in_(["requested", "scheduled", "in_progress"]),
    ).count()

    # Resolution rate
    referral_count = db.query(Referral).join(Consultation).filter(
        Consultation.patient_id == patient.id,
        Consultation.status == "completed",
    ).count()
    resolution_rate = (
        round((completed_consultations - referral_count) / completed_consultations * 100, 1)
        if completed_consultations > 0 else None
    )

    # Latest triage session (with result)
    latest_triage = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient.id)
        .order_by(TriageSession.created_at.desc())
        .first()
    )

    if not latest_triage:
        return PatientStateResponse(
            current_state="no_triage",
            state_label="Sem triagens realizadas",
            next_action="start_triage",
            next_action_label="Iniciar Primeira Triagem",
            next_action_urgency="low",
            triage_count=0,
            consultation_count=consultation_count,
            completed_consultations=completed_consultations,
            pending_consultations=pending_consultations,
            resolution_rate=resolution_rate,
        )

    # Triage in progress?
    if latest_triage.status == "in_progress":
        return PatientStateResponse(
            current_state="triage_in_progress",
            state_label="Triagem em curso",
            last_triage_complaint=latest_triage.chief_complaint,
            last_triage_session_id=latest_triage.id,
            last_triage_date=latest_triage.created_at.isoformat(),
            next_action="complete_triage",
            next_action_label="Completar Triagem",
            next_action_urgency="medium",
            triage_count=triage_count,
            consultation_count=consultation_count,
            completed_consultations=completed_consultations,
            pending_consultations=pending_consultations,
            resolution_rate=resolution_rate,
        )

    # Triage completed — get result
    triage_result = latest_triage.result
    risk = triage_result.risk_level if triage_result else None
    action = triage_result.recommended_action if triage_result else None
    score = float(triage_result.score) if triage_result else None

    # Check if consultation already exists for this triage
    has_consult_for_triage = db.query(Consultation).filter(
        Consultation.triage_session_id == latest_triage.id,
    ).first()

    # If pending consultation exists
    if pending_consultations > 0:
        current_state = "consultation_booked"
        state_label = "Consulta agendada"
        next_action = "none"
        next_action_label = "Aguarde a sua consulta"
        next_action_urgency = "low"
        next_action_deadline = None
    elif has_consult_for_triage and has_consult_for_triage.status == "completed":
        current_state = "consultation_completed"
        state_label = "Caso resolvido"
        next_action = "start_triage"
        next_action_label = "Iniciar Nova Triagem"
        next_action_urgency = "low"
        next_action_deadline = None
    elif risk in ("URGENT", "HIGH"):
        current_state = "triage_completed"
        state_label = "Atenção urgente necessária"
        if action == "ER_NOW":
            next_action = "go_to_er"
            next_action_label = "Procure Atendimento Imediato"
            next_action_urgency = "critical"
            next_action_deadline = "imediato"
        else:
            next_action = "book_consultation"
            next_action_label = "Marcar Consulta Agora"
            next_action_urgency = "high"
            next_action_deadline = "hoje"
    elif risk == "MEDIUM":
        current_state = "triage_completed"
        state_label = "Consulta recomendada"
        next_action = "book_consultation"
        next_action_label = "Marcar Consulta"
        next_action_urgency = "medium"
        next_action_deadline = "24h"
    else:
        # LOW risk
        current_state = "triage_completed"
        state_label = "Autocuidado recomendado"
        next_action = "self_care"
        next_action_label = "Marcar Consulta (Opcional)"
        next_action_urgency = "low"
        next_action_deadline = None

    return PatientStateResponse(
        current_state=current_state,
        state_label=state_label,
        last_triage_risk=risk,
        last_triage_action=action,
        last_triage_complaint=latest_triage.chief_complaint,
        last_triage_score=score,
        last_triage_date=latest_triage.created_at.isoformat(),
        last_triage_session_id=latest_triage.id,
        next_action=next_action,
        next_action_label=next_action_label,
        next_action_urgency=next_action_urgency,
        next_action_deadline=next_action_deadline,
        triage_count=triage_count,
        consultation_count=consultation_count,
        completed_consultations=completed_consultations,
        pending_consultations=pending_consultations,
        resolution_rate=resolution_rate,
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
    """Get admin dashboard metrics with business KPIs."""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)

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

    # Consultations this month
    consultations_this_month = db.query(Consultation).filter(
        Consultation.created_at >= month_start,
    ).count()

    # Resolution rate (completed without referral)
    completed = db.query(Consultation).filter(
        Consultation.status == "completed",
    ).count()
    referral_count = db.query(Referral).join(Consultation).filter(
        Consultation.status == "completed",
    ).count()
    resolution_rate = (
        round((completed - referral_count) / completed * 100, 1)
        if completed > 0 else 0.0
    )

    # Risk distribution
    risk_rows = (
        db.query(TriageResult.risk_level, func.count(TriageResult.id))
        .group_by(TriageResult.risk_level)
        .all()
    )
    risk_distribution = {level: count for level, count in risk_rows}

    # Active patients (with activity in last 30 days)
    active_patients = (
        db.query(func.count(func.distinct(TriageSession.patient_id)))
        .filter(TriageSession.created_at >= thirty_days_ago)
        .scalar() or 0
    )

    # Revenue this month
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
        consultations_this_month=consultations_this_month,
        resolution_rate=resolution_rate,
        risk_distribution=risk_distribution,
        active_patients=active_patients,
    )
