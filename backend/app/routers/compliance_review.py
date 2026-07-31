from __future__ import annotations
"""Compliance-reviewer actions on verification cases.

These endpoints extend the existing ``/api/v1/credentials/admin`` surface
with the spec-mandated reviewer verbs (§13). Every state change goes through
the ``record_transition`` service so nothing escapes audit.

Endpoints
    GET   /api/v1/compliance/cases/{credential_id}/history
    POST  /api/v1/compliance/cases/{credential_id}/request-information
    POST  /api/v1/compliance/cases/{credential_id}/manual-review-complete
    POST  /api/v1/compliance/cases/{credential_id}/suspend
    POST  /api/v1/compliance/cases/{credential_id}/reactivate
    POST  /api/v1/compliance/cases/{credential_id}/revoke

Approve / reject remain on the existing
``POST /api/v1/credentials/admin/{id}/decision`` endpoint for now — that
endpoint has been updated to also write a transition row.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.health_models import ClinicianCredential, Doctor, VerificationTransition
from app.models import User
from app.rbac import require_compliance_reviewer
from app.services.verification.base import VerificationStatus
from app.services.verification.state_machine import (
    InvalidTransitionError,
    allowed_next,
    history,
    record_transition,
)

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


ENTITY_TYPE = "clinician_credential"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_case(db: Session, credential_id: str) -> ClinicianCredential:
    credential = db.query(ClinicianCredential).filter(
        ClinicianCredential.id == credential_id
    ).first()
    if not credential:
        raise HTTPException(404, "Processo não encontrado.")
    return credential


def _sync_doctor_status(db: Session, credential: ClinicianCredential) -> None:
    """Mirror the credential's status onto the Doctor row so RBAC can react."""
    doctor = db.query(Doctor).filter(Doctor.user_id == credential.user_id).first()
    if doctor:
        doctor.verification_status = credential.status
        if credential.status == "verified":
            doctor.verified_at = credential.verified_at
            doctor.verified_by = credential.verified_by


def _apply_transition(
    db: Session,
    credential: ClinicianCredential,
    new_status: str,
    reviewer: User,
    reason_code: Optional[str],
    reason_text: Optional[str],
    reviewer_notes: Optional[str],
) -> dict:
    """Validate + persist a transition + mirror onto Doctor + commit."""
    previous = credential.status
    try:
        transition = record_transition(
            db,
            entity_type=ENTITY_TYPE,
            entity_id=credential.id,
            previous_status=previous,
            new_status=new_status,
            actor_user_id=reviewer.id,
            actor_kind="user",
            reason_code=reason_code,
            reason_text=reason_text,
            reviewer_notes=reviewer_notes,
        )
    except InvalidTransitionError as e:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "invalid_transition",
                "from": e.from_status,
                "to": e.to_status,
                "allowed": sorted(allowed_next(previous)),
            },
        )
    credential.status = new_status
    if new_status == VerificationStatus.COMPLETED.value or new_status == "verified":
        credential.verified_at = datetime.utcnow()
        credential.verified_by = reviewer.id
    _sync_doctor_status(db, credential)
    db.commit()
    return {
        "credential_id": credential.id,
        "previous_status": previous,
        "new_status": new_status,
        "transition_id": transition.transition_id,
        "at": transition.at,
    }


# ── Request bodies ──────────────────────────────────────────────────────────

class RequestInfoBody(BaseModel):
    reason_text: str = Field(..., min_length=3,
        description="Message shown to the applicant explaining what's missing.")
    reviewer_notes: Optional[str] = Field(None,
        description="Internal notes not visible to the applicant.")
    reason_code: Optional[str] = "additional_information_required"


class ManualReviewCompleteBody(BaseModel):
    outcome: str = Field(..., description="verified | rejected | partial | unable_to_verify")
    reason_text: Optional[str] = None
    reviewer_notes: Optional[str] = None


class SuspendBody(BaseModel):
    reason_text: str = Field(..., min_length=3)
    reviewer_notes: Optional[str] = None
    reason_code: Optional[str] = "reviewer_suspension"


class RevokeBody(BaseModel):
    reason_text: str = Field(..., min_length=3)
    reviewer_notes: Optional[str] = None
    reason_code: Optional[str] = "reviewer_revocation"


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/cases/{credential_id}/history")
def get_case_history(
    credential_id: str,
    _: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Full transition history for a single credential dossier."""
    _get_case(db, credential_id)
    rows = history(db, ENTITY_TYPE, credential_id)
    return [
        {
            "id": r.id,
            "previous_status": r.previous_status,
            "new_status": r.new_status,
            "actor_user_id": r.actor_user_id,
            "actor_kind": r.actor_kind,
            "reason_code": r.reason_code,
            "reason_text": r.reason_text,
            "reviewer_notes": r.reviewer_notes,
            "provider": r.provider,
            "evidence_ref": r.evidence_ref,
            "at": r.at,
        }
        for r in rows
    ]


@router.post("/cases/{credential_id}/request-information")
def request_information(
    credential_id: str,
    body: RequestInfoBody,
    reviewer: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Ask the applicant for more documentation."""
    credential = _get_case(db, credential_id)
    return _apply_transition(
        db, credential,
        new_status=VerificationStatus.ACTION_REQUIRED.value,
        reviewer=reviewer,
        reason_code=body.reason_code or "additional_information_required",
        reason_text=body.reason_text,
        reviewer_notes=body.reviewer_notes,
    )


_MANUAL_OUTCOMES = {
    "verified":         VerificationStatus.COMPLETED.value,
    "rejected":         VerificationStatus.FAILED.value,
    "partial":          VerificationStatus.PARTIALLY_VERIFIED.value,
    "unable_to_verify": VerificationStatus.UNABLE_TO_VERIFY.value,
}


@router.post("/cases/{credential_id}/manual-review-complete")
def manual_review_complete(
    credential_id: str,
    body: ManualReviewCompleteBody,
    reviewer: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Record the outcome of a manual registry check.

    Note: this does NOT grant final ``verified`` professional status. It
    completes the *manual-registry* step only. Final approval still goes
    through the existing decision endpoint so all pre-conditions (identity,
    qualification, insurance, agreements) can be re-checked together.
    """
    if body.outcome not in _MANUAL_OUTCOMES:
        raise HTTPException(422, f"outcome must be one of: {', '.join(_MANUAL_OUTCOMES)}")
    credential = _get_case(db, credential_id)
    return _apply_transition(
        db, credential,
        new_status=_MANUAL_OUTCOMES[body.outcome],
        reviewer=reviewer,
        reason_code=f"manual_review_{body.outcome}",
        reason_text=body.reason_text,
        reviewer_notes=body.reviewer_notes,
    )


@router.post("/cases/{credential_id}/suspend")
def suspend_case(
    credential_id: str,
    body: SuspendBody,
    reviewer: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Temporarily suspend an approved professional."""
    credential = _get_case(db, credential_id)
    return _apply_transition(
        db, credential,
        new_status="suspended",
        reviewer=reviewer,
        reason_code=body.reason_code,
        reason_text=body.reason_text,
        reviewer_notes=body.reviewer_notes,
    )


@router.post("/cases/{credential_id}/reactivate")
def reactivate_case(
    credential_id: str,
    reviewer: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Lift a suspension — restores ``completed`` (verified) status."""
    credential = _get_case(db, credential_id)
    return _apply_transition(
        db, credential,
        new_status=VerificationStatus.COMPLETED.value,
        reviewer=reviewer,
        reason_code="reviewer_reactivation",
        reason_text=None,
        reviewer_notes=None,
    )


@router.post("/cases/{credential_id}/revoke")
def revoke_case(
    credential_id: str,
    body: RevokeBody,
    reviewer: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Permanently revoke — terminal state, no forward transitions."""
    credential = _get_case(db, credential_id)
    return _apply_transition(
        db, credential,
        new_status="revoked",
        reviewer=reviewer,
        reason_code=body.reason_code,
        reason_text=body.reason_text,
        reviewer_notes=body.reviewer_notes,
    )
