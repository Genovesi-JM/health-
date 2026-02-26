from __future__ import annotations
"""
Triage Router — Digital triage sessions for patients.

Endpoints:
- POST /api/v1/triage/start — Start a new triage session
- POST /api/v1/triage/{id}/answers — Submit answers
- POST /api/v1/triage/{id}/complete — Complete and get result
- GET  /api/v1/triage/history — Patient triage history
"""
import json
import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, TriageSession, TriageAnswer, TriageResult
from app.health_schemas import (
    TriageStartRequest, TriageStartResponse,
    TriageAnswerSubmit, TriageResultOut,
    TriageHistoryItem, RoleEnum,
)
from app.rbac import get_patient_for_user, log_health_audit
from app.services.triage_engine import get_triage_questions, evaluate_triage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/triage", tags=["triage"])


@router.post("/start", response_model=TriageStartResponse)
def start_triage(
    body: TriageStartRequest,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Start a new triage session. Returns triage ID and questions."""
    session = TriageSession(
        patient_id=patient.id,
        status="in_progress",
        chief_complaint=body.chief_complaint,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return TriageStartResponse(
        triage_id=session.id,
        status=session.status,
        questions=get_triage_questions(age_group=body.age_group, category=body.category),
    )


@router.post("/{triage_id}/answers")
def submit_answers(
    triage_id: str,
    body: TriageAnswerSubmit,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Submit answers for a triage session."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Sessão já completada ou expirada.")

    # Store answers
    for answer in body.answers:
        q_key = answer.get("question_key", "")
        a_val = answer.get("answer", "")
        ta = TriageAnswer(
            triage_session_id=triage_id,
            question_key=q_key,
            answer_value=json.dumps(a_val),
        )
        db.add(ta)

    db.commit()
    return {"detail": "Respostas registadas.", "triage_id": triage_id}


@router.post("/{triage_id}/complete", response_model=TriageResultOut)
def complete_triage(
    triage_id: str,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete a triage session and get the risk assessment result."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Sessão já completada.")

    # Collect answers
    answers_rows = db.query(TriageAnswer).filter(
        TriageAnswer.triage_session_id == triage_id,
    ).all()

    answers_dict = {}
    for a in answers_rows:
        try:
            answers_dict[a.question_key] = json.loads(a.answer_value)
        except (json.JSONDecodeError, TypeError):
            answers_dict[a.question_key] = a.answer_value

    # Evaluate
    evaluation = evaluate_triage(answers_dict)

    # Store result
    result = TriageResult(
        triage_session_id=triage_id,
        risk_level=evaluation.risk_level,
        recommended_action=evaluation.recommended_action,
        score=evaluation.score,
        reasoning_json=json.dumps(evaluation.reasoning),
    )
    db.add(result)

    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.add(session)
    db.commit()
    db.refresh(result)

    # Audit log for urgent results
    if evaluation.risk_level == "URGENT":
        log_health_audit(
            db,
            action="triage_urgent_flag",
            actor_user_id=user.id,
            resource_type="triage_session",
            resource_id=triage_id,
            metadata={"risk_level": evaluation.risk_level, "score": evaluation.score},
        )

    return TriageResultOut(
        triage_id=triage_id,
        risk_level=evaluation.risk_level,
        recommended_action=evaluation.recommended_action,
        score=evaluation.score,
        reasoning=evaluation.reasoning,
    )


@router.get("/history", response_model=List[TriageHistoryItem])
def triage_history(
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Get the patient's triage history."""
    sessions = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient.id)
        .order_by(TriageSession.created_at.desc())
        .limit(50)
        .all()
    )
    items = []
    for s in sessions:
        result = db.query(TriageResult).filter(
            TriageResult.triage_session_id == s.id
        ).first()
        items.append(TriageHistoryItem(
            id=s.id,
            status=s.status,
            chief_complaint=s.chief_complaint,
            risk_level=result.risk_level if result else None,
            recommended_action=result.recommended_action if result else None,
            created_at=s.created_at,
            completed_at=s.completed_at,
        ))
    return items
