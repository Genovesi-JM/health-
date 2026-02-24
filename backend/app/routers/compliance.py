"""
Compliance Router — Patient consent management.

Endpoints:
- POST /api/v1/compliance/consent — Accept a consent type
- GET  /api/v1/compliance/consents — List accepted consents
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, PatientConsent
from app.health_schemas import ConsentRequest, ConsentOut, RoleEnum
from app.rbac import get_patient_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


@router.post("/consent", response_model=ConsentOut)
def accept_consent(
    body: ConsentRequest,
    request: Request,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Accept a consent type (privacy_policy, telemedicine_consent, terms_of_service)."""
    # Check if already accepted
    existing = db.query(PatientConsent).filter(
        PatientConsent.patient_id == patient.id,
        PatientConsent.consent_type == body.consent_type,
    ).first()
    if existing:
        return existing

    ip = None
    ua = None
    if request.client:
        ip = request.client.host
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    ua = (request.headers.get("user-agent") or "")[:500]

    consent = PatientConsent(
        patient_id=patient.id,
        consent_type=body.consent_type,
        ip_address=ip,
        user_agent=ua,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent


@router.get("/consents", response_model=List[ConsentOut])
def list_consents(
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """List all consents accepted by the current patient."""
    return (
        db.query(PatientConsent)
        .filter(PatientConsent.patient_id == patient.id)
        .order_by(PatientConsent.accepted_at.desc())
        .all()
    )
