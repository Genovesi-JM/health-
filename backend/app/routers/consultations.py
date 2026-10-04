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
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserProfile
from app.health_models import (
    Patient, Doctor, Consultation, ConsultationNotes, TriageSession, TriageResult, HealthAuditLog,
)
from app.health_schemas import (
    ConsultationBookRequest, ConsultationOut, ConsultationCompleteRequest, ConsultationAmendmentRequest,
    ConsultationCancelRequest, ConsultationQueueItem, ConsultationRescheduleRequest, RoleEnum,
)
from app.rbac import (
    get_patient_for_user,
    require_consents, require_verified_doctor,
)
from app.services.consultation_lifecycle import displayed_revision, record_event, require_displayed_revision, transition
from app.services.clinician_access import require_current_clinician
from app.services.consultation_closeout import finalize_consultation, closeout_result, end_video

from app.services.consultation_pages import consultation_page, history_query, private_page
from app.services.specialties import normalize_specialty
from app.services.request_expiry import annotate_expiry, safely_due_sql
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
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
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

    from app.services.appointment_booking import create_booking
    consultation, _ = create_booking(db, body, patient, user, idempotency_key)

    return annotate_expiry([consultation], db)[0]


@router.post("/api/v1/consultations/{consultation_id}/reschedule", response_model=ConsultationOut)
def reschedule_consultation(
    consultation_id: str, body: ConsultationRescheduleRequest, response: Response,
    patient: Patient = Depends(require_consents), user: User = Depends(get_current_user),
    db: Session = Depends(get_db), idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    from app.services.appointment_rescheduling import reschedule
    consultation = db.query(Consultation).filter_by(id=consultation_id, patient_id=patient.id).first()
    if not consultation:
        raise HTTPException(404, "Consulta não encontrada.")
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return annotate_expiry([reschedule(db, consultation, body, patient, user, idempotency_key)], db)[0]


@router.get("/api/v1/consultations/me/page")
def patient_consultation_page(
    response: Response, view: Literal["all", "upcoming", "past"] = Query("all"),
    status: Optional[str] = Query(None, max_length=40), limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None, max_length=1024),
    patient: Patient = Depends(get_patient_for_user), db: Session = Depends(get_db),
):
    query = history_query(db.query(Consultation).filter(Consultation.patient_id == patient.id), view=view, status=status)
    rows, next_cursor = consultation_page(query, viewer=patient.user_id, owner=patient.id,
        scope="patient-consultations", limit=limit, cursor=cursor, filters={"view": view, "status": status})
    private_page(response)
    return {"items": [ConsultationOut.model_validate(row).model_dump(mode="json") for row in annotate_expiry(rows, db)], "next_cursor": next_cursor}


@router.get("/api/v1/consultations/me", response_model=List[ConsultationOut])
def my_consultations(
    status: Optional[str] = Query(None),
    consultation_id: Optional[str] = Query(None, max_length=36),
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Get the patient's consultation history."""
    q = db.query(Consultation).filter(Consultation.patient_id == patient.id)
    if status:
        q = q.filter(Consultation.status == status)
    if consultation_id:
        q = q.filter(Consultation.id == consultation_id)
    return annotate_expiry(q.order_by(Consultation.created_at.desc()).limit(100).all(), db)


# ═══════════════════════════════════════════════════════════════
# Doctor endpoints
# ═══════════════════════════════════════════════════════════════

def _queue_query(user, db, specialty):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    credential = require_current_clinician(user, db)
    q = db.query(Consultation).filter(
        or_(
            and_(
                Consultation.doctor_id.is_(None),
                Consultation.status == "requested",
                Consultation.specialty.in_((normalize_specialty(doctor.specialization), "clinica_geral")),
                or_(Consultation.country == credential.practice_country, Consultation.country.is_(None)),
            ),
            and_(
                Consultation.doctor_id == doctor.id,
                Consultation.status.in_(("requested", "scheduled", "in_progress")),
            ),
        )
    )
    if specialty:
        # A display filter can narrow access, never expand it to another specialty.
        q = q.filter(Consultation.specialty == normalize_specialty(specialty))

    return q.filter(~safely_due_sql()), doctor


def _patient_names(consultations, db):
    identifiers = {item.patient_id for item in consultations}
    if not identifiers:
        return {}
    return {identifier: name or "Paciente" for identifier, name in db.query(Patient.id, UserProfile.full_name)
        .join(User, User.id == Patient.user_id).outerjoin(UserProfile, UserProfile.user_id == User.id)
        .filter(Patient.id.in_(identifiers)).all()}


def _queue_items(consultations, db):
    items = []
    names = _patient_names(consultations, db)
    for c in annotate_expiry(consultations, db):
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

        items.append(ConsultationQueueItem(
            id=c.id,
            patient_id=c.patient_id,
            patient_name=names.get(c.patient_id, "Paciente"),
            triage_session_id=c.triage_session_id,
            specialty=c.specialty,
            status=c.status,
            requested_expires_at=c.requested_expires_at,
            expired_at=c.expired_at,
            request_expiry_state=c.request_expiry_state,
            risk_level=risk_level,
            chief_complaint=chief_complaint,
            scheduled_at=c.scheduled_at,
            reschedule_revision=c.reschedule_revision,
            timezone=c.timezone,
            scheduled_end_at=c.scheduled_end_at,
            created_at=c.created_at,
        ))
    return items


@router.get("/api/v1/doctor/queue", response_model=List[ConsultationQueueItem])
def doctor_queue(
    specialty: Optional[str] = Query(None), user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    query, _ = _queue_query(user, db, specialty)
    return _queue_items(query.order_by(Consultation.created_at.asc(), Consultation.id.asc()).limit(50).all(), db)


@router.get("/api/v1/doctor/queue/page")
def doctor_queue_page(
    response: Response, specialty: Optional[str] = Query(None, max_length=100),
    limit: int = Query(25, ge=1, le=100), cursor: Optional[str] = Query(None, max_length=1024),
    user: User = Depends(require_verified_doctor), db: Session = Depends(get_db),
):
    query, doctor = _queue_query(user, db, specialty)
    rows, next_cursor = consultation_page(query, viewer=user.id, owner=doctor.id, scope="doctor-queue",
        limit=limit, cursor=cursor, ascending=True, filters={"specialty": normalize_specialty(specialty) if specialty else None})
    private_page(response)
    return {"items": _queue_items(rows, db), "next_cursor": next_cursor}


@router.get("/api/v1/doctor/consultations/page")
def assigned_consultation_page(
    response: Response, view: Literal["all", "upcoming", "past"] = Query("all"),
    status: Optional[str] = Query(None, max_length=40), limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = Query(None, max_length=1024),
    user: User = Depends(require_verified_doctor), db: Session = Depends(get_db),
):
    require_current_clinician(user, db)
    doctor = db.query(Doctor).filter_by(user_id=user.id).first()
    if not doctor:
        raise HTTPException(404, "Perfil de médico não encontrado.")
    query = history_query(db.query(Consultation).filter(Consultation.doctor_id == doctor.id), view=view, status=status)
    rows, next_cursor = consultation_page(query, viewer=user.id, owner=doctor.id, scope="doctor-consultations",
        limit=limit, cursor=cursor, filters={"view": view, "status": status})
    names = _patient_names(rows, db)
    for row in rows:
        row.patient_name = names.get(row.patient_id, "Paciente")
    private_page(response)
    return {"items": [ConsultationOut.model_validate(row).model_dump(mode="json") for row in annotate_expiry(rows, db)], "next_cursor": next_cursor}


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
    return annotate_expiry(q.order_by(Consultation.created_at.desc()).limit(100).all(), db)


@router.post("/api/v1/doctor/queue/{consultation_id}/accept", response_model=ConsultationOut)
def accept_consultation(
    consultation_id: str,
    expected_revision: int = Depends(displayed_revision),
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Accept a consultation from the queue."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        or_(
            Consultation.doctor_id == doctor.id,
            and_(
                Consultation.doctor_id.is_(None),
                Consultation.specialty.in_((normalize_specialty(doctor.specialization), "clinica_geral")),
            ),
        ),
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada ou já aceite.")

    require_displayed_revision(consultation, expected_revision)
    next_status = "scheduled" if consultation.scheduled_at else "in_progress"
    transition(
        db, consultation, actor_id=user.id, action="consultation_accepted",
        allowed_from=("requested",), status=next_status, doctor_id=doctor.id,
        started_at=datetime.utcnow() if next_status == "in_progress" else None,
    )
    db.commit()
    db.refresh(consultation)

    return annotate_expiry([consultation], db)[0]


@router.post("/api/v1/doctor/queue/{consultation_id}/start", response_model=ConsultationOut)
def start_consultation(
    consultation_id: str,
    expected_revision: int = Depends(displayed_revision),
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

    require_displayed_revision(consultation, expected_revision)
    transition(
        db, consultation, actor_id=user.id, action="consultation_started",
        allowed_from=("scheduled",), status="in_progress", started_at=datetime.utcnow(),
    )
    db.commit()
    db.refresh(consultation)

    return annotate_expiry([consultation], db)[0]


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
    try:
        finalize_consultation(db, consultation, body, user)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível confirmar a gravação. Tente novamente com o mesmo conteúdo.") from None

    return annotate_expiry([consultation], db)[0]


@router.post("/api/v1/consultations/{consultation_id}/closeout/amendments")
def amend_consultation_closeout(
    consultation_id: str,
    body: ConsultationAmendmentRequest,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Append an attributed correction without changing the finalized original."""
    from app.services.consultation_amendments import append_amendment
    doctor = db.query(Doctor).filter_by(user_id=user.id).first()
    consultation = db.query(Consultation).filter_by(
        id=consultation_id, doctor_id=doctor.id if doctor else None,
    ).first() if doctor else None
    if consultation is None:
        raise HTTPException(404, "Consulta não encontrada ou não atribuída a si.")
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    try:
        append_amendment(db, consultation, body, user, idempotency_key)
        result = closeout_result(db, consultation, clinician=True)
        db.commit()
        return result
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível confirmar a correção. Repita com a mesma chave e conteúdo.") from None


@router.get("/api/v1/consultations/{consultation_id}/closeout")
def get_consultation_closeout(
    consultation_id: str,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Read only authored patient disclosures; SOAP belongs to the assigned doctor."""
    query = db.query(Consultation).filter(Consultation.id == consultation_id)
    if user.role in ("patient", "cliente"):
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient:
            raise HTTPException(404, "Consulta não encontrada.")
        query = query.filter(Consultation.patient_id == patient.id)
    elif user.role == "doctor":
        require_current_clinician(user, db)
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            raise HTTPException(404, "Consulta não encontrada.")
        query = query.filter(Consultation.doctor_id == doctor.id)
    else:
        raise HTTPException(403, "Sem acesso ao resumo desta consulta.")
    consultation = query.first()
    if not consultation:
        raise HTTPException(404, "Consulta não encontrada.")
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    result = closeout_result(db, consultation, clinician=user.role == "doctor")
    db.add(HealthAuditLog(actor_user_id=user.id, action="consultation_closeout_read",
                          resource_type="consultation", resource_id=consultation.id))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível abrir o resumo. Tente novamente.") from None
    return result


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
    if user.role in (RoleEnum.PATIENT, "cliente"):
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or consultation.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
    elif user.role == RoleEnum.DOCTOR:
        require_current_clinician(user, db)
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor or consultation.doctor_id != doctor.id:
            raise HTTPException(status_code=403, detail="Sem permissão.")
    elif user.role not in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        raise HTTPException(status_code=403, detail="Sem permissão.")

    transition(
        db, consultation, actor_id=user.id, action="consultation_cancelled",
        allowed_from=(("requested", "scheduled") if user.role in (RoleEnum.PATIENT, "cliente")
                      else ("requested", "scheduled", "in_progress")), status="cancelled",
        cancellation_reason=body.reason,
        patient_cancel=user.role in (RoleEnum.PATIENT, "cliente"),
    )
    end_video(db, consultation, user.id, datetime.utcnow())
    db.commit()
    db.refresh(consultation)

    return annotate_expiry([consultation], db)[0]


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
