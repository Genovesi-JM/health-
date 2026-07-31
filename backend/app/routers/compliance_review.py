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
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.health_models import (
    ClinicianCredential,
    CredentialEvidence,
    CredentialProviderCheck,
    Doctor,
    VerificationTransition,
)
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


# ── Case listing + detail (dashboard) ──────────────────────────────────────

def _last_transition(db: Session, credential_id: str) -> Optional[VerificationTransition]:
    return (
        db.query(VerificationTransition)
        .filter(
            VerificationTransition.entity_type == ENTITY_TYPE,
            VerificationTransition.entity_id == credential_id,
        )
        .order_by(VerificationTransition.at.desc())
        .first()
    )


def _serialize_case_row(credential: ClinicianCredential, latest: Optional[VerificationTransition]) -> dict:
    return {
        "credential_id": credential.id,
        "user_id": credential.user_id,
        "profession": credential.profession,
        "legal_name": credential.legal_name,
        "licence_country": credential.licence_country,
        "licence_number": credential.licence_number,
        "issuing_authority": credential.issuing_authority,
        "status": credential.status,
        "created_at": credential.created_at,
        "updated_at": credential.updated_at,
        "verified_at": credential.verified_at,
        "latest_transition": {
            "new_status": latest.new_status,
            "reason_code": latest.reason_code,
            "actor_kind": latest.actor_kind,
            "at": latest.at,
        } if latest else None,
    }


@router.get("/cases")
def list_cases(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    country: Optional[str] = Query(default=None, description="ISO-2 country code"),
    profession: Optional[str] = Query(default=None, description="doctor | nurse | pharmacist"),
    search: Optional[str] = Query(default=None, description="Free-text search on name / licence"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Paginated compliance queue with filters.

    Returns the newest cases first. Empty ``status`` returns everything so
    reviewers can see fully approved and rejected cases too.
    """
    q = db.query(ClinicianCredential)
    if status_filter:
        # Accept legacy + canonical statuses transparently.
        q = q.filter(ClinicianCredential.status == status_filter)
    if country:
        q = q.filter(func.upper(ClinicianCredential.licence_country) == country.upper())
    if profession:
        q = q.filter(ClinicianCredential.profession == profession.lower())
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            (ClinicianCredential.legal_name.ilike(like))
            | (ClinicianCredential.licence_number.ilike(like))
        )

    total = q.count()
    rows = (
        q.order_by(ClinicianCredential.updated_at.desc())
        .offset(offset).limit(limit).all()
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [_serialize_case_row(c, _last_transition(db, c.id)) for c in rows],
    }


@router.get("/cases/{credential_id}/detail")
def get_case_detail(
    credential_id: str,
    _: User = Depends(require_compliance_reviewer),
    db: Session = Depends(get_db),
):
    """Full drill-down: credential + evidence + provider checks + transitions
    + extracted-vs-entered diff for reviewer decisions."""
    credential = (
        db.query(ClinicianCredential)
        .options(
            joinedload(ClinicianCredential.evidence),
            joinedload(ClinicianCredential.provider_checks),
        )
        .filter(ClinicianCredential.id == credential_id)
        .first()
    )
    if not credential:
        raise HTTPException(404, "Processo não encontrado.")

    # Reviewer needs to compare what the applicant typed vs what the extractor
    # read. Both live on the credential + provider_checks respectively.
    entered = {
        "legal_name": credential.legal_name,
        "licence_number": credential.licence_number,
        "issuing_authority": credential.issuing_authority,
        "licence_expiry_date": credential.licence_expiry_date,
        "diploma_institution": credential.diploma_institution,
        "degree_title": credential.degree_title,
        "graduation_year": credential.graduation_year,
    }
    extracted: dict = {}
    for check in credential.provider_checks or []:
        try:
            data = json.loads(check.extracted_data_json or "{}")
        except (TypeError, ValueError):
            data = {}
        if data:
            extracted[check.provider] = data

    return {
        "credential_id": credential.id,
        "user_id": credential.user_id,
        "profession": credential.profession,
        "status": credential.status,
        "entered": entered,
        "extracted_by_provider": extracted,
        "evidence": [
            {
                "id": e.id, "kind": e.kind, "filename": e.original_filename,
                "content_type": e.content_type, "sha256": e.sha256,
                "uploaded_at": e.created_at,
            }
            for e in (credential.evidence or [])
        ],
        "provider_checks": [
            {
                "id": pc.id, "provider": pc.provider, "check_type": pc.check_type,
                "status": pc.status, "external_id": pc.external_id,
                "launch_url": pc.launch_url, "error_message": pc.error_message,
                "requested_at": pc.requested_at, "completed_at": pc.completed_at,
            }
            for pc in (credential.provider_checks or [])
        ],
        "transitions": [
            {
                "id": r.id, "previous_status": r.previous_status, "new_status": r.new_status,
                "actor_user_id": r.actor_user_id, "actor_kind": r.actor_kind,
                "reason_code": r.reason_code, "reason_text": r.reason_text,
                "reviewer_notes": r.reviewer_notes, "provider": r.provider, "at": r.at,
            }
            for r in history(db, ENTITY_TYPE, credential_id)
        ],
        "allowed_next_statuses": sorted(allowed_next(credential.status)),
    }
