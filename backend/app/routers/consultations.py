from __future__ import annotations
"""
Consultations Router — Booking, queue, acceptance, and completion.

Patient endpoints:
- POST /api/v1/consultations/book — Book a consultation
- GET  /api/v1/consultations/me — Patient consultation history

Doctor endpoints:
- GET  /api/v1/doctor/queue — Unassigned consultation requests
- GET  /api/v1/doctor/consultations — Doctor's assigned consultations
- POST /api/v1/doctor/queue/{id}/accept — Accept a consultation
- POST /api/v1/consultations/{id}/complete — Complete consultation with notes

Cancel/Reschedule:
- PATCH /api/v1/consultations/{id} — Cancel or update
"""
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    Patient, Doctor, Consultation, ConsultationNotes, TriageSession, TriageResult,
)
from app.health_schemas import (
    ConsultationBookRequest, ConsultationOut, ConsultationCompleteRequest,
    ConsultationCancelRequest, ConsultationQueueItem, RoleEnum,
)
from app.rbac import (
    get_patient_for_user, get_doctor_for_user,
    require_consents, require_verified_doctor,
    log_health_audit,
)

# Canonical specialty codes (match Doctor.specialization). Legacy English UI
# codes and free-text labels are normalised to these so bookings always reach
# the right doctor's queue.
_SPECIALTY_ALIASES = {
    "general": "clinica_geral", "clinica geral": "clinica_geral",
    "cardiology": "cardiologia", "dermatology": "dermatologia",
    "pediatrics": "pediatria", "orthopedics": "ortopedia",
    "neurology": "neurologia", "gynecology": "ginecologia",
    "ophthalmology": "oftalmologia", "psychiatry": "psiquiatria",
    "internal": "medicina_interna", "internal medicine": "medicina_interna",
    "surgery": "cirurgia", "other": "outra",
}


def normalize_specialty(value: Optional[str]) -> str:
    """Map any specialty input to a canonical snake_case code."""
    if not value:
        return "clinica_geral"
    v = value.strip().lower()
    if v in _SPECIALTY_ALIASES:
        return _SPECIALTY_ALIASES[v]
    snake = v.replace(" ", "_")
    return _SPECIALTY_ALIASES.get(snake, snake)
from app.routers.notifications import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(tags=["consultations"])


# ═══════════════════════════════════════════════════════════════
# Patient endpoints
# ═══════════════════════════════════════════════════════════════

@router.post("/api/v1/consultations/book", response_model=ConsultationOut)
def book_consultation(
    body: ConsultationBookRequest,
    patient: Patient = Depends(require_consents),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Book a consultation. Requires all consents to be accepted."""
    # Validate triage reference if provided
    if body.triage_session_id:
        triage = db.query(TriageSession).filter(
            TriageSession.id == body.triage_session_id,
            TriageSession.patient_id == patient.id,
        ).first()
        if not triage:
            raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")

    # If the patient chose a specific doctor + time, assign directly (scheduled);
    # otherwise it goes into the shared queue as a request.
    assigned_doctor_id = None
    status = "requested"
    if body.doctor_id and body.scheduled_at:
        doc = db.query(Doctor).filter(Doctor.id == body.doctor_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Médico não encontrado.")
        if doc.verification_status != "verified":
            raise HTTPException(status_code=400, detail="Este médico ainda não está verificado.")
        assigned_doctor_id = doc.id
        status = "scheduled"

    consultation = Consultation(
        patient_id=patient.id,
        triage_session_id=body.triage_session_id,
        specialty=normalize_specialty(body.specialty),
        doctor_id=assigned_doctor_id,
        status=status,
        scheduled_at=body.scheduled_at,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    log_health_audit(
        db,
        action="consultation_booked",
        actor_user_id=user.id,
        resource_type="consultation",
        resource_id=consultation.id,
    )

    try:
        create_notification(
            db,
            user_id=user.id,
            title="Consulta agendada",
            message=f"A sua consulta de {consultation.specialty.replace('_', ' ')} foi registada com sucesso.",
            type="success",
            entity_type="consultation",
            entity_id=consultation.id,
        )
    except Exception:
        pass

    # If scheduled directly with a doctor, notify that doctor.
    if assigned_doctor_id:
        try:
            doc = db.get(Doctor, assigned_doctor_id)
            if doc:
                create_notification(
                    db, user_id=doc.user_id,
                    title="Nova consulta agendada",
                    message="Um paciente agendou uma consulta consigo.",
                    type="info", entity_type="consultation", entity_id=consultation.id,
                )
        except Exception:
            pass

    return consultation


@router.get("/api/v1/consultations/me", response_model=List[ConsultationOut])
def my_consultations(
    status: Optional[str] = Query(None),
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Get the patient's consultation history."""
    q = db.query(Consultation).filter(Consultation.patient_id == patient.id)
    if status:
        q = q.filter(Consultation.status == status)
    return q.order_by(Consultation.created_at.desc()).limit(100).all()


# ═══════════════════════════════════════════════════════════════
# Doctor endpoints
# ═══════════════════════════════════════════════════════════════

@router.get("/api/v1/doctor/queue", response_model=List[ConsultationQueueItem])
def doctor_queue(
    specialty: Optional[str] = Query(None),
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Get unassigned consultation requests (doctor queue)."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    q = db.query(Consultation).filter(
        Consultation.doctor_id.is_(None),
        Consultation.status == "requested",
    )
    if specialty:
        q = q.filter(Consultation.specialty == specialty)
    elif doctor:
        # Default: filter by doctor's specialization
        q = q.filter(
            or_(
                Consultation.specialty == doctor.specialization,
                Consultation.specialty == "clinica_geral",
            )
        )

    consultations = q.order_by(Consultation.created_at.asc()).limit(50).all()

    items = []
    for c in consultations:
        # Get triage info if available (minimal patient data)
        risk_level = None
        chief_complaint = None
        if c.triage_session_id:
            triage = db.query(TriageSession).filter(
                TriageSession.id == c.triage_session_id
            ).first()
            if triage:
                chief_complaint = triage.chief_complaint
                result = db.query(TriageResult).filter(
                    TriageResult.triage_session_id == triage.id
                ).first()
                if result:
                    risk_level = result.risk_level

        # Resolve patient display name
        patient_name = None
        try:
            pat = db.query(Patient).filter(Patient.id == c.patient_id).first()
            if pat:
                u = db.get(User, pat.user_id)
                if u:
                    patient_name = u.name or u.email.split("@")[0]
        except Exception:
            pass

        items.append(ConsultationQueueItem(
            id=c.id,
            patient_id=c.patient_id,
            patient_name=patient_name,
            specialty=c.specialty,
            status=c.status,
            risk_level=risk_level,
            chief_complaint=chief_complaint,
            scheduled_at=c.scheduled_at,
            created_at=c.created_at,
        ))
    return items


@router.get("/api/v1/doctor/consultations", response_model=List[ConsultationOut])
def doctor_consultations(
    status: Optional[str] = Query(None),
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Get the doctor's assigned consultations."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    q = db.query(Consultation).filter(Consultation.doctor_id == doctor.id)
    if status:
        q = q.filter(Consultation.status == status)
    return q.order_by(Consultation.created_at.desc()).limit(100).all()


@router.post("/api/v1/doctor/queue/{consultation_id}/accept", response_model=ConsultationOut)
def accept_consultation(
    consultation_id: str,
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Accept a consultation from the queue."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        Consultation.status == "requested",
        Consultation.doctor_id.is_(None),
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada ou já aceite.")

    consultation.doctor_id = doctor.id
    consultation.status = "in_progress"
    consultation.started_at = datetime.utcnow()
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    log_health_audit(
        db,
        action="consultation_accepted",
        actor_user_id=user.id,
        resource_type="consultation",
        resource_id=consultation.id,
        metadata={"doctor_id": doctor.id},
    )

    # Notify the patient that a doctor accepted their consultation.
    try:
        pat = db.get(Patient, consultation.patient_id)
        if pat:
            create_notification(
                db, user_id=pat.user_id,
                title="Consulta aceite",
                message="Um médico aceitou a sua consulta. Já pode conversar por mensagem ou vídeo.",
                type="success", entity_type="consultation", entity_id=consultation.id,
            )
    except Exception:
        pass

    return consultation


@router.post("/api/v1/doctor/queue/{consultation_id}/start", response_model=ConsultationOut)
def start_consultation(
    consultation_id: str,
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Start a scheduled consultation (doctor only) — moves status to in_progress."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        Consultation.doctor_id == doctor.id,
        Consultation.status == "scheduled",
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada ou não está no estado agendado.")

    consultation.status = "in_progress"
    consultation.started_at = datetime.utcnow()
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    log_health_audit(
        db,
        action="consultation_started",
        actor_user_id=user.id,
        resource_type="consultation",
        resource_id=consultation.id,
    )

    return consultation


@router.post("/api/v1/consultations/{consultation_id}/complete", response_model=ConsultationOut)
def complete_consultation(
    consultation_id: str,
    body: ConsultationCompleteRequest,
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Complete a consultation with clinical notes (doctor only)."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        Consultation.doctor_id == doctor.id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada ou não atribuída a si.")
    if consultation.status == "completed":
        raise HTTPException(status_code=400, detail="Consulta já completada.")

    # Save notes
    notes = ConsultationNotes(
        consultation_id=consultation.id,
        doctor_id=doctor.id,
        subjective=body.subjective,
        objective=body.objective,
        assessment=body.assessment,
        plan=body.plan,
        outcome=body.outcome,
    )
    db.add(notes)

    consultation.status = "completed"
    consultation.ended_at = datetime.utcnow()
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    log_health_audit(
        db,
        action="consultation_completed",
        actor_user_id=user.id,
        resource_type="consultation",
        resource_id=consultation.id,
    )

    return consultation


@router.patch("/api/v1/consultations/{consultation_id}", response_model=ConsultationOut)
def cancel_consultation(
    consultation_id: str,
    body: ConsultationCancelRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a consultation (patient or doctor)."""
    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")

    # Row-level access check
    if user.role == RoleEnum.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or consultation.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
    elif user.role == RoleEnum.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor or consultation.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
    elif user.role not in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        raise HTTPException(status_code=403, detail="Sem permissão.")

    if consultation.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Consulta não pode ser cancelada.")

    consultation.status = "cancelled"
    consultation.cancellation_reason = body.reason
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    return consultation


# ── Patient review of a completed consultation ───────────────────────────────
from app.health_models import DoctorReview as _DoctorReview  # noqa: E402
from app.health_schemas import ReviewCreate as _ReviewCreate  # noqa: E402


@router.post("/api/v1/consultations/{consultation_id}/review", status_code=201)
def submit_review(
    consultation_id: str,
    body: _ReviewCreate,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Patient rates the doctor after a completed consultation (one per consult)."""
    c = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        Consultation.patient_id == patient.id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    if c.status != "completed":
        raise HTTPException(status_code=400, detail="Só pode avaliar consultas concluídas.")
    if not c.doctor_id:
        raise HTTPException(status_code=400, detail="Consulta sem médico atribuído.")
    existing = db.query(_DoctorReview).filter(_DoctorReview.consultation_id == consultation_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Esta consulta já foi avaliada.")
    review = _DoctorReview(
        doctor_id=c.doctor_id, patient_id=patient.id,
        consultation_id=consultation_id, rating=body.rating, comment=body.comment,
    )
    db.add(review)
    db.commit()

    try:
        doc = db.get(Doctor, c.doctor_id)
        if doc:
            create_notification(
                db, user_id=doc.user_id,
                title="Nova avaliação",
                message=f"Recebeu uma avaliação de {body.rating} estrela{'s' if body.rating != 1 else ''}.",
                type="info", entity_type="consultation", entity_id=consultation_id,
            )
    except Exception:
        pass
    return {"detail": "Avaliação registada. Obrigado!", "id": review.id}
