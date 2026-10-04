from __future__ import annotations
"""Onboarding router — multi-step, resumable, role-specific.

Endpoints
    POST   /api/v1/onboarding/start            create/reset a draft for a role
    GET    /api/v1/onboarding/status           current draft for the caller
    PUT    /api/v1/onboarding/steps/{step}     upsert one step's payload
    POST   /api/v1/onboarding/save             partial autosave (any step)
    POST   /api/v1/onboarding/submit           validate and submit (freezes)
    GET    /api/v1/onboarding/review           read-only bundled view

Patient submission materializes its profile and consent evidence atomically.
Other roles retain their existing draft workflow and separate domain services.
"""
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import HealthAuditLog, OnboardingDraft
from app.health_schemas import RoleEnum
from app.models import User
from app.services.patient_onboarding import complete_patient_onboarding

router = APIRouter(prefix="/api/v1/onboarding", tags=["onboarding"])


# ── Role → step count ────────────────────────────────────────────────────────
# Total step counts drive the wizard's progress bar. Role-specific step
# definitions live in the frontend so this stays a thin persistence layer.
ROLE_STEP_COUNTS: dict[str, int] = {
    "patient": 8,
    "caregiver": 6,
    "doctor": 17,
    "nurse": 12,
    "pharmacist": 12,
    "clinic": 6,
    "laboratory": 6,
    "pharmacy_org": 6,
    "health_org": 6,
}


def _validate_role(role: str) -> str:
    if role not in ROLE_STEP_COUNTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown onboarding role. Allowed: {', '.join(ROLE_STEP_COUNTS)}",
        )
    return role


def _load_json(value: str, default: Any) -> Any:
    try:
        return json.loads(value or "")
    except (TypeError, ValueError):
        return default


def _patient_completed(db: Session, draft: OnboardingDraft) -> bool:
    return db.query(HealthAuditLog.id).filter(
        HealthAuditLog.action == "patient_onboarding_completed",
        HealthAuditLog.resource_type == "onboarding_draft",
        HealthAuditLog.resource_id == draft.id,
    ).first() is not None


def _serialize(draft: OnboardingDraft, db: Session) -> dict:
    result = {
        "id": draft.id,
        "role": draft.role,
        "status": draft.status,
        "current_step": draft.current_step,
        "total_steps": draft.total_steps,
        "completed_steps": _load_json(draft.completed_steps_json, []),
        "data": _load_json(draft.data_json, {}),
        "submitted_at": draft.submitted_at,
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
    }
    if draft.role == "patient":
        result["completion_status"] = (
            "complete" if draft.status == "submitted" and _patient_completed(db, draft) else "incomplete"
        )
    return result


def _get_or_404(db: Session, user_id: str, role: Optional[str] = None, *, lock: bool = False) -> OnboardingDraft:
    q = db.query(OnboardingDraft).filter(OnboardingDraft.user_id == user_id)
    if role is not None:
        _validate_role(role)
        q = q.filter(OnboardingDraft.role == role)
    if lock:
        q = q.with_for_update()
    drafts = q.order_by(OnboardingDraft.updated_at.desc()).limit(2).all()
    if not drafts:
        raise HTTPException(status_code=404, detail="No onboarding draft found.")
    if len(drafts) > 1:
        raise HTTPException(status_code=409, detail="Specify the onboarding role to avoid editing another draft.")
    return drafts[0]


# ── Request bodies ──────────────────────────────────────────────────────────

class StartOnboardingBody(BaseModel):
    role: str = Field(..., description="patient | caregiver | doctor | nurse | pharmacist | …")
    reset: bool = Field(False, description="If true, wipe any existing draft for this role.")


class StepBody(BaseModel):
    data: dict = Field(default_factory=dict)
    completed: bool = Field(True, description="Mark step as complete (default true).")


class SaveBody(BaseModel):
    step: int = Field(..., ge=1)
    data: dict = Field(default_factory=dict)


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/start")
def start_onboarding(
    body: StartOnboardingBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a fresh draft (or return the existing one) for role."""
    role = _validate_role(body.role)
    total = ROLE_STEP_COUNTS[role]

    existing = (
        db.query(OnboardingDraft)
        .filter(OnboardingDraft.user_id == user.id, OnboardingDraft.role == role)
        .with_for_update()
        .first()
    )

    if existing and existing.role == "patient" and _patient_completed(db, existing):
        if body.reset:
            raise HTTPException(status_code=409, detail="Use profile settings to update completed patient onboarding.")
        return _serialize(existing, db)

    # Earlier versions only froze patient drafts. Resume their answers without
    # treating that old status as evidence of a completed profile or consent.
    if existing and role == "patient" and existing.status == "submitted":
        existing.status = "draft"
        existing.submitted_at = None
        existing.current_step = 1
        db.commit()
        db.refresh(existing)
        return _serialize(existing, db)

    if existing and not body.reset:
        if existing.status == "submitted":
            raise HTTPException(status_code=409, detail="Onboarding already submitted for this role.")
        return _serialize(existing, db)

    if existing and body.reset:
        # Preserve id so downstream references stay stable.
        existing.current_step = 1
        existing.completed_steps_json = "[]"
        existing.data_json = "{}"
        existing.status = "draft"
        existing.submitted_at = None
        existing.total_steps = total
        db.commit()
        db.refresh(existing)
        return _serialize(existing, db)

    draft = OnboardingDraft(
        user_id=user.id,
        role=role,
        current_step=1,
        total_steps=total,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft, db)


@router.get("/status")
def get_status(
    role: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the caller's most recent draft (optionally filtered by role).

    Returns 200 with ``{"draft": null}`` when nothing exists, so the frontend
    can trivially branch on ``"has a draft?"``.
    """
    if role:
        _validate_role(role)
    q = db.query(OnboardingDraft).filter(OnboardingDraft.user_id == user.id)
    if role:
        q = q.filter(OnboardingDraft.role == role)
    draft = q.order_by(OnboardingDraft.updated_at.desc()).first()
    return {"draft": _serialize(draft, db) if draft else None}


@router.put("/steps/{step}")
def update_step(
    step: int,
    body: StepBody,
    role: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save one step's payload and (optionally) mark it complete."""
    if step < 1:
        raise HTTPException(status_code=400, detail="Step must be >= 1.")

    draft = _get_or_404(db, user.id, role, lock=True)
    if draft.status == "submitted":
        raise HTTPException(status_code=409, detail="Cannot edit a submitted onboarding.")
    if step > draft.total_steps:
        raise HTTPException(
            status_code=400,
            detail=f"Step {step} exceeds total steps ({draft.total_steps}).",
        )

    data = _load_json(draft.data_json, {})
    data[str(step)] = body.data
    draft.data_json = json.dumps(data)

    completed = _load_json(draft.completed_steps_json, [])
    if body.completed and step not in completed:
        completed.append(step)
        draft.completed_steps_json = json.dumps(sorted(completed))

    # Advance the current step marker (bounded).
    if body.completed:
        draft.current_step = min(step + 1, draft.total_steps)

    db.commit()
    db.refresh(draft)
    return _serialize(draft, db)


@router.post("/save")
def autosave(
    body: SaveBody,
    role: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Autosave path — writes step data without marking the step complete."""
    draft = _get_or_404(db, user.id, role, lock=True)
    if draft.status == "submitted":
        raise HTTPException(status_code=409, detail="Cannot autosave a submitted onboarding.")
    if body.step < 1 or body.step > draft.total_steps:
        raise HTTPException(status_code=400, detail="Step out of range.")

    data = _load_json(draft.data_json, {})
    data[str(body.step)] = {**data.get(str(body.step), {}), **body.data}
    draft.data_json = json.dumps(data)
    db.commit()
    return {"saved": True, "updated_at": draft.updated_at}


@router.post("/submit")
def submit_onboarding(
    request: Request,
    role: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit all steps, materializing patient data in the same transaction."""
    draft = _get_or_404(db, user.id, role, lock=True)
    if draft.status == "submitted" and (draft.role != "patient" or _patient_completed(db, draft)):
        return _serialize(draft, db)

    markers = _load_json(draft.completed_steps_json, [])
    if not isinstance(markers, list) or any(type(step) is not int for step in markers):
        raise HTTPException(400, detail="Invalid onboarding progress.")
    completed = set(markers)
    required = set(range(1, draft.total_steps + 1))
    missing = sorted(required - completed)
    if missing:
        raise HTTPException(
            status_code=400,
            detail={"error": "incomplete", "missing_steps": missing},
        )

    try:
        if draft.role == "patient":
            complete_patient_onboarding(db, user, draft, request)
        draft.status = "submitted"
        draft.submitted_at = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(draft)
    return _serialize(draft, db)


@router.get("/review")
def review(
    role: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bundled read-only view used by the final review screen."""
    draft = _get_or_404(db, user.id, role)
    return _serialize(draft, db)
