from __future__ import annotations

"""Cross-role clinical operations: escalation, PEM preparation and revenue."""

import os
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.health_models import (
    CareEscalation,
    ClinicalCareTask,
    ClinicianRevenueEvent,
    Consultation,
    Doctor,
    ElectronicPrescriptionSubmission,
    NursingObservation,
    Patient,
    Prescription,
)
from app.rbac import assert_doctor_can_access_patient, log_health_audit, require_verified_clinician
from app.services.pem_gateway import prepare_payload, public_status


router = APIRouter(prefix="/api/v1/clinical-operations", tags=["clinical-operations"])


class EscalationCreate(BaseModel):
    patient_id: str
    consultation_id: Optional[str] = None
    triage_session_id: Optional[str] = None
    urgency: Literal["routine", "priority", "urgent", "emergency"] = "priority"
    reason: str = Field(min_length=3, max_length=2000)
    clinical_summary: str = Field(min_length=3, max_length=8000)


class NursingObservationCreate(BaseModel):
    patient_id: str
    consultation_id: Optional[str] = None
    observation_type: Literal["assessment", "intervention", "handoff", "follow_up"] = "assessment"
    situation: Optional[str] = Field(default=None, max_length=4000)
    background: Optional[str] = Field(default=None, max_length=4000)
    assessment: str = Field(min_length=3, max_length=8000)
    recommendation: Optional[str] = Field(default=None, max_length=4000)
    patient_response: Optional[str] = Field(default=None, max_length=4000)


class CareTaskCreate(BaseModel):
    patient_id: str
    consultation_id: Optional[str] = None
    assigned_role: Literal["doctor", "nurse"]
    assigned_user_id: Optional[str] = None
    task_type: Literal[
        "reassessment", "monitoring", "patient_contact", "teleconsult_preparation",
        "medication_review", "follow_up", "document_review",
    ] = "follow_up"
    title: str = Field(min_length=3, max_length=300)
    instructions: Optional[str] = Field(default=None, max_length=4000)
    priority: Literal["routine", "priority", "urgent"] = "routine"
    due_at: Optional[datetime] = None


class CareTaskComplete(BaseModel):
    completion_note: Optional[str] = Field(default=None, max_length=4000)


def _escalation_out(item: CareEscalation, db: Session) -> dict:
    patient = db.query(Patient).filter(Patient.id == item.patient_id).first()
    account = db.query(User).filter(User.id == patient.user_id).first() if patient else None
    doctor = db.query(Doctor).filter(Doctor.id == item.assigned_doctor_id).first() if item.assigned_doctor_id else None
    doctor_user = db.query(User).filter(User.id == doctor.user_id).first() if doctor else None
    return {
        "id": item.id,
        "patient_id": item.patient_id,
        "patient_name": (account.email.split("@")[0] if account and account.email else "Paciente"),
        "consultation_id": item.consultation_id,
        "triage_session_id": item.triage_session_id,
        "urgency": item.urgency,
        "reason": item.reason,
        "clinical_summary": item.clinical_summary,
        "status": item.status,
        "assigned_doctor_id": item.assigned_doctor_id,
        "assigned_doctor": doctor.display_name if doctor and doctor.display_name else (
            doctor_user.email.split("@")[0] if doctor_user and doctor_user.email else None
        ),
        "created_at": item.created_at.isoformat(),
        "accepted_at": item.accepted_at.isoformat() if item.accepted_at else None,
        "resolved_at": item.resolved_at.isoformat() if item.resolved_at else None,
    }


def _doctor_for(user: User, db: Session) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil médico não encontrado.")
    return doctor


def _episode_for(patient_id: str, consultation_id: Optional[str], db: Session) -> Consultation:
    query = db.query(Consultation).filter(Consultation.patient_id == patient_id)
    if consultation_id:
        query = query.filter(Consultation.id == consultation_id)
    else:
        query = query.filter(Consultation.status.in_(("requested", "scheduled", "in_progress")))
    consultation = query.order_by(Consultation.created_at.desc()).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Episódio clínico não encontrado.")
    return consultation


def _assert_patient_access(user: User, patient_id: str, db: Session) -> None:
    if user.role == "doctor":
        assert_doctor_can_access_patient(_doctor_for(user, db), patient_id, db)
        return
    active = db.query(Consultation.id).filter(
        Consultation.patient_id == patient_id,
        Consultation.status.in_(("requested", "scheduled", "in_progress")),
    ).first()
    if not active:
        raise HTTPException(status_code=403, detail="Sem episódio de cuidados ativo para enfermagem.")


def _observation_out(item: NursingObservation, db: Session) -> dict:
    author = db.query(User).filter(User.id == item.author_user_id).first()
    return {
        "id": item.id,
        "patient_id": item.patient_id,
        "consultation_id": item.consultation_id,
        "author_user_id": item.author_user_id,
        "author": author.email.split("@")[0] if author and author.email else "Enfermagem",
        "observation_type": item.observation_type,
        "situation": item.situation,
        "background": item.background,
        "assessment": item.assessment,
        "recommendation": item.recommendation,
        "patient_response": item.patient_response,
        "status": item.status,
        "created_at": item.created_at.isoformat(),
        "amended_at": item.amended_at.isoformat() if item.amended_at else None,
    }


def _task_out(item: ClinicalCareTask, db: Session) -> dict:
    creator = db.query(User).filter(User.id == item.created_by_user_id).first()
    assignee = db.query(User).filter(User.id == item.assigned_user_id).first() if item.assigned_user_id else None
    return {
        "id": item.id,
        "patient_id": item.patient_id,
        "consultation_id": item.consultation_id,
        "created_by": creator.email.split("@")[0] if creator and creator.email else "Profissional",
        "assigned_role": item.assigned_role,
        "assigned_user_id": item.assigned_user_id,
        "assigned_to": assignee.email.split("@")[0] if assignee and assignee.email else None,
        "task_type": item.task_type,
        "title": item.title,
        "instructions": item.instructions,
        "priority": item.priority,
        "due_at": item.due_at.isoformat() if item.due_at else None,
        "status": item.status,
        "completion_note": item.completion_note,
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
        "created_at": item.created_at.isoformat(),
    }


@router.post("/escalations", status_code=201)
def create_escalation(
    body: EscalationCreate,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    if user.role != "nurse":
        raise HTTPException(status_code=403, detail="O encaminhamento operacional é iniciado por enfermagem.")
    consultation = (
        db.query(Consultation)
        .filter(
            Consultation.id == body.consultation_id,
            Consultation.patient_id == body.patient_id,
            Consultation.status.in_(("requested", "scheduled", "in_progress")),
        )
        .first()
        if body.consultation_id else
        db.query(Consultation)
        .filter(
            Consultation.patient_id == body.patient_id,
            Consultation.status.in_(("requested", "scheduled", "in_progress")),
        )
        .order_by(Consultation.created_at.desc())
        .first()
    )
    if not consultation:
        raise HTTPException(status_code=403, detail="É necessário um episódio de cuidados ativo.")

    duplicate = db.query(CareEscalation).filter(
        CareEscalation.consultation_id == consultation.id,
        CareEscalation.status.in_(("pending", "accepted")),
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Já existe um encaminhamento clínico ativo.")

    item = CareEscalation(
        patient_id=body.patient_id,
        consultation_id=consultation.id,
        triage_session_id=body.triage_session_id or consultation.triage_session_id,
        created_by_user_id=user.id,
        urgency=body.urgency,
        reason=body.reason.strip(),
        clinical_summary=body.clinical_summary.strip(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    log_health_audit(
        db, "care_escalation.created", user.id, "care_escalation", item.id,
        {"urgency": item.urgency, "patient_id": item.patient_id}, request,
    )
    return _escalation_out(item, db)


@router.get("/escalations")
def list_escalations(
    status: Optional[str] = None,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    query = db.query(CareEscalation)
    if user.role == "nurse":
        query = query.filter(CareEscalation.created_by_user_id == user.id)
    else:
        doctor = _doctor_for(user, db)
        query = query.filter(
            (CareEscalation.assigned_doctor_id.is_(None)) |
            (CareEscalation.assigned_doctor_id == doctor.id)
        )
    if status:
        query = query.filter(CareEscalation.status == status)
    rows = query.order_by(
        CareEscalation.created_at.desc(),
    ).limit(100).all()
    return {"items": [_escalation_out(row, db) for row in rows], "total": len(rows)}


@router.post("/escalations/{escalation_id}/accept")
def accept_escalation(
    escalation_id: str,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="A aceitação requer um médico verificado.")
    doctor = _doctor_for(user, db)
    item = db.query(CareEscalation).filter(CareEscalation.id == escalation_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Encaminhamento não encontrado.")
    if item.status != "pending" or item.assigned_doctor_id not in (None, doctor.id):
        raise HTTPException(status_code=409, detail="Encaminhamento já atribuído ou encerrado.")

    item.status = "accepted"
    item.assigned_doctor_id = doctor.id
    item.accepted_at = datetime.utcnow()
    consultation = db.query(Consultation).filter(Consultation.id == item.consultation_id).first()
    if consultation and consultation.doctor_id is None:
        consultation.doctor_id = doctor.id

    configured_fee = max(0, int(os.getenv("REVENUE_NURSE_ESCALATION_FEE_MINOR", "0") or 0))
    if configured_fee:
        platform_bps = min(10000, max(0, int(os.getenv("REVENUE_PLATFORM_BPS", "2000") or 2000)))
        platform_fee = configured_fee * platform_bps // 10000
        db.add(ClinicianRevenueEvent(
            consultation_id=item.consultation_id,
            escalation_id=item.id,
            clinician_user_id=item.created_by_user_id,
            professional_role="nurse",
            event_type="accepted_clinical_escalation",
            gross_amount=configured_fee,
            currency=os.getenv("REVENUE_CURRENCY", "AOA")[:3].upper(),
            platform_fee_amount=platform_fee,
            professional_amount=configured_fee - platform_fee,
            status="earned",
            earned_at=datetime.utcnow(),
        ))
    db.commit()
    db.refresh(item)
    log_health_audit(
        db, "care_escalation.accepted", user.id, "care_escalation", item.id,
        {"doctor_id": doctor.id, "consultation_id": item.consultation_id}, request,
    )
    return _escalation_out(item, db)


@router.post("/escalations/{escalation_id}/resolve")
def resolve_escalation(
    escalation_id: str,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    item = db.query(CareEscalation).filter(CareEscalation.id == escalation_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Encaminhamento não encontrado.")
    allowed = item.created_by_user_id == user.id
    if user.role == "doctor":
        allowed = item.assigned_doctor_id == _doctor_for(user, db).id
    if not allowed:
        raise HTTPException(status_code=403, detail="Sem acesso a este encaminhamento.")
    if item.status not in ("accepted", "pending"):
        raise HTTPException(status_code=409, detail="Encaminhamento já encerrado.")
    item.status = "resolved"
    item.resolved_at = datetime.utcnow()
    db.commit()
    log_health_audit(db, "care_escalation.resolved", user.id, "care_escalation", item.id, request=request)
    return _escalation_out(item, db)


@router.post("/nursing/observations", status_code=201)
def create_nursing_observation(
    body: NursingObservationCreate,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    if user.role != "nurse":
        raise HTTPException(status_code=403, detail="O registo de enfermagem requer uma enfermeira verificada.")
    _assert_patient_access(user, body.patient_id, db)
    consultation = _episode_for(body.patient_id, body.consultation_id, db)
    if consultation.status not in ("requested", "scheduled", "in_progress"):
        raise HTTPException(status_code=409, detail="O episódio já não aceita novos registos de enfermagem.")
    item = NursingObservation(
        patient_id=body.patient_id,
        consultation_id=consultation.id,
        author_user_id=user.id,
        observation_type=body.observation_type,
        situation=body.situation,
        background=body.background,
        assessment=body.assessment.strip(),
        recommendation=body.recommendation,
        patient_response=body.patient_response,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    log_health_audit(
        db, "nursing_observation.created", user.id, "nursing_observation", item.id,
        {"patient_id": item.patient_id, "consultation_id": item.consultation_id, "type": item.observation_type},
        request,
    )
    return _observation_out(item, db)


@router.get("/patients/{patient_id}/nursing/observations")
def list_nursing_observations(
    patient_id: str,
    consultation_id: Optional[str] = None,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    _assert_patient_access(user, patient_id, db)
    query = db.query(NursingObservation).filter(NursingObservation.patient_id == patient_id)
    if consultation_id:
        query = query.filter(NursingObservation.consultation_id == consultation_id)
    rows = query.order_by(NursingObservation.created_at.desc()).limit(100).all()
    return {"items": [_observation_out(row, db) for row in rows], "total": len(rows)}


@router.post("/care-tasks", status_code=201)
def create_care_task(
    body: CareTaskCreate,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    _assert_patient_access(user, body.patient_id, db)
    consultation = _episode_for(body.patient_id, body.consultation_id, db)
    if body.assigned_user_id:
        assignee = db.query(User).filter(
            User.id == body.assigned_user_id,
            User.role == body.assigned_role,
            User.is_active == True,
        ).first()
        if not assignee:
            raise HTTPException(status_code=422, detail="Profissional atribuído inválido para a função.")
    task = ClinicalCareTask(
        patient_id=body.patient_id,
        consultation_id=consultation.id,
        created_by_user_id=user.id,
        assigned_role=body.assigned_role,
        assigned_user_id=body.assigned_user_id,
        task_type=body.task_type,
        title=body.title.strip(),
        instructions=body.instructions,
        priority=body.priority,
        due_at=body.due_at,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    log_health_audit(
        db, "clinical_care_task.created", user.id, "clinical_care_task", task.id,
        {"patient_id": task.patient_id, "assigned_role": task.assigned_role, "priority": task.priority},
        request,
    )
    return _task_out(task, db)


@router.get("/patients/{patient_id}/care-tasks")
def list_patient_care_tasks(
    patient_id: str,
    status: Optional[str] = None,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    _assert_patient_access(user, patient_id, db)
    query = db.query(ClinicalCareTask).filter(ClinicalCareTask.patient_id == patient_id)
    if status:
        query = query.filter(ClinicalCareTask.status == status)
    rows = query.order_by(
        ClinicalCareTask.status.asc(),
        ClinicalCareTask.due_at.asc(),
        ClinicalCareTask.created_at.desc(),
    ).limit(100).all()
    return {"items": [_task_out(row, db) for row in rows], "total": len(rows)}


@router.get("/care-tasks/me")
def list_my_care_tasks(
    status: Optional[str] = None,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    query = db.query(ClinicalCareTask).filter(
        ClinicalCareTask.assigned_role == user.role,
        (ClinicalCareTask.assigned_user_id.is_(None)) |
        (ClinicalCareTask.assigned_user_id == user.id),
    )
    if status:
        query = query.filter(ClinicalCareTask.status == status)
    rows = query.order_by(
        ClinicalCareTask.due_at.asc(),
        ClinicalCareTask.created_at.desc(),
    ).limit(100).all()
    return {"items": [_task_out(row, db) for row in rows], "total": len(rows)}


@router.post("/care-tasks/{task_id}/complete")
def complete_care_task(
    task_id: str,
    body: CareTaskComplete,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    task = db.query(ClinicalCareTask).filter(ClinicalCareTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarefa clínica não encontrada.")
    _assert_patient_access(user, task.patient_id, db)
    if task.assigned_role != user.role or task.assigned_user_id not in (None, user.id):
        raise HTTPException(status_code=403, detail="Esta tarefa está atribuída a outro profissional.")
    if task.status != "open":
        raise HTTPException(status_code=409, detail="A tarefa já foi encerrada.")
    task.status = "completed"
    task.completed_by_user_id = user.id
    task.completed_at = datetime.utcnow()
    task.completion_note = body.completion_note
    db.commit()
    db.refresh(task)
    log_health_audit(
        db, "clinical_care_task.completed", user.id, "clinical_care_task", task.id,
        {"patient_id": task.patient_id}, request,
    )
    return _task_out(task, db)


@router.get("/integrations/pem/status")
def pem_status(user: User = Depends(require_verified_clinician)):
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="A prescrição eletrónica é exclusiva do médico.")
    return public_status()


@router.post("/prescriptions/{prescription_id}/pem/prepare")
def prepare_pem_submission(
    prescription_id: str,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="A prescrição eletrónica é exclusiva do médico.")
    doctor = _doctor_for(user, db)
    prescription = db.query(Prescription).filter(Prescription.id == prescription_id).first()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescrição não encontrada.")
    consultation = db.query(Consultation).filter(
        Consultation.id == prescription.consultation_id,
        Consultation.doctor_id == doctor.id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=403, detail="Sem acesso clínico à prescrição.")

    existing = db.query(ElectronicPrescriptionSubmission).filter(
        ElectronicPrescriptionSubmission.prescription_id == prescription.id,
        ElectronicPrescriptionSubmission.status.in_(("ready", "not_configured", "submitted", "accepted")),
    ).order_by(ElectronicPrescriptionSubmission.created_at.desc()).first()
    if existing:
        return {
            "id": existing.id, "status": existing.status,
            "payload_hash": existing.payload_hash, "gateway": public_status(),
        }

    _, payload_hash = prepare_payload(
        prescription_id=prescription.id,
        patient_id=consultation.patient_id,
        doctor_id=doctor.id,
    )
    gateway = public_status()
    submission = ElectronicPrescriptionSubmission(
        prescription_id=prescription.id,
        patient_id=consultation.patient_id,
        doctor_id=doctor.id,
        payload_hash=payload_hash,
        status="ready" if gateway["configured"] else "not_configured",
        response_code=None if gateway["configured"] else "PEM_CREDENTIALS_REQUIRED",
        response_message=gateway["message"],
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    log_health_audit(
        db, "pem_submission.prepared", user.id, "electronic_prescription_submission",
        submission.id, {"prescription_id": prescription.id, "status": submission.status}, request,
    )
    return {
        "id": submission.id,
        "status": submission.status,
        "payload_hash": submission.payload_hash,
        "gateway": gateway,
    }


@router.get("/revenue/me")
def my_revenue(
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    rows = db.query(ClinicianRevenueEvent).filter(
        ClinicianRevenueEvent.clinician_user_id == user.id,
    ).order_by(ClinicianRevenueEvent.created_at.desc()).limit(100).all()
    totals: dict[str, dict[str, int]] = {}
    for row in rows:
        bucket = totals.setdefault(row.currency, {"gross": 0, "professional": 0, "platform": 0})
        if row.status in ("earned", "paid"):
            bucket["gross"] += row.gross_amount
            bucket["professional"] += row.professional_amount
            bucket["platform"] += row.platform_fee_amount
    return {
        "totals_by_currency": totals,
        "events": [{
            "id": row.id,
            "event_type": row.event_type,
            "status": row.status,
            "gross_amount": row.gross_amount,
            "professional_amount": row.professional_amount,
            "platform_fee_amount": row.platform_fee_amount,
            "currency": row.currency,
            "created_at": row.created_at.isoformat(),
        } for row in rows],
        "pricing": {
            "nurse_escalation_fee_configured": bool(int(os.getenv("REVENUE_NURSE_ESCALATION_FEE_MINOR", "0") or 0)),
            "platform_share_bps": int(os.getenv("REVENUE_PLATFORM_BPS", "2000") or 2000),
            "note": "Valores reais são definidos por contrato; nenhum preço clínico é inferido pela aplicação.",
        },
    }
