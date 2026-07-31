from __future__ import annotations
"""Onboarding router — multi-step, resumable, role-specific.

Endpoints
    POST   /api/v1/onboarding/start            create/reset a draft for a role
    GET    /api/v1/onboarding/status           current draft for the caller
    PUT    /api/v1/onboarding/steps/{step}     upsert one step's payload
    POST   /api/v1/onboarding/save             partial autosave (any step)
    POST   /api/v1/onboarding/submit           mark draft submitted (freezes)
    GET    /api/v1/onboarding/review           read-only bundled view

The router owns *persistence and validation of the wizard*, not the domain
records — a submit only flips the draft's status to ``submitted`` and returns
the review payload. A follow-up service (patients / professionals / …) is
responsible for turning the payload into the real profile record. This keeps
the wizard reusable across roles without leaking role-specific business rules.
"""
import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import OnboardingDraft
from app.health_schemas import RoleEnum
from app.models import User

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


def _serialize(draft: OnboardingDraft) -> dict:
    return {
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


def _get_or_404(db: Session, user_id: str, role: Optional[str] = None) -> OnboardingDraft:
    q = db.query(OnboardingDraft).filter(OnboardingDraft.user_id == user_id)
    if role:
        q = q.filter(OnboardingDraft.role == role)
    draft = q.order_by(OnboardingDraft.updated_at.desc()).first()
    if not draft:
        raise HTTPException(status_code=404, detail="No onboarding draft found.")
    return draft


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
        .first()
    )

    if existing and not body.reset:
        if existing.status == "submitted":
            raise HTTPException(status_code=409, detail="Onboarding already submitted for this role.")
        return _serialize(existing)

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
        return _serialize(existing)

    draft = OnboardingDraft(
        user_id=user.id,
        role=role,
        current_step=1,
        total_steps=total,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


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
    return {"draft": _serialize(draft) if draft else None}


@router.put("/steps/{step}")
def update_step(
    step: int,
    body: StepBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save one step's payload and (optionally) mark it complete."""
    if step < 1:
        raise HTTPException(status_code=400, detail="Step must be >= 1.")

    draft = _get_or_404(db, user.id)
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
    return _serialize(draft)


@router.post("/save")
def autosave(
    body: SaveBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Autosave path — writes step data without marking the step complete."""
    draft = _get_or_404(db, user.id)
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Freeze the draft — every required step must be complete.

    A downstream service (out of scope for this router) turns the frozen
    draft into the domain record (patient profile, professional dossier, …).
    """
    draft = _get_or_404(db, user.id)
    if draft.status == "submitted":
        return _serialize(draft)

    completed = set(_load_json(draft.completed_steps_json, []))
    required = set(range(1, draft.total_steps + 1))
    missing = sorted(required - completed)
    if missing:
        raise HTTPException(
            status_code=400,
            detail={"error": "incomplete", "missing_steps": missing},
        )

    draft.status = "submitted"
    draft.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)
    return _serialize(draft)


@router.get("/review")
def review(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bundled read-only view used by the final review screen."""
    draft = _get_or_404(db, user.id)
    return _serialize(draft)
