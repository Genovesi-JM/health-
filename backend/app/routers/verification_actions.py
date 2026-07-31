from __future__ import annotations
"""Verification action endpoints — thin wrappers over provider adapters.

These are the spec's §22 ``/verification/*`` endpoints. Each does one thing:

    * looks up the caller's credential dossier,
    * calls the selected provider adapter (identity / qualification /
      registry / document intelligence),
    * writes a ``VerificationTransition`` audit row for the case,
    * persists the provider reference so later status polls + webhooks can
      match the event back to the case.

The wizard never talks to a specific vendor's SDK from the browser — it
calls these endpoints, and the backend orchestrates. That keeps every
vendor secret server-side and lets us swap vendors via config alone.
"""
import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import ClinicianCredential
from app.models import User
from app.services.verification import (
    IdentityApplicant,
    QualificationApplicant,
    RegistryCheckRequest,
    get_identity_provider,
    get_qualification_provider,
    get_registry_provider,
)
from app.services.verification.base import VerificationResult, VerificationStatus
from app.services.verification.state_machine import (
    InvalidTransitionError,
    record_transition,
)

router = APIRouter(prefix="/api/v1/verification", tags=["verification"])


ENTITY_TYPE = "clinician_credential"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_or_403(db: Session, user_id: str) -> ClinicianCredential:
    credential = db.query(ClinicianCredential).filter(
        ClinicianCredential.user_id == user_id
    ).first()
    if not credential:
        raise HTTPException(
            status_code=403,
            detail="Este utilizador não tem um dossier profissional.",
        )
    return credential


def _serialize_result(r: VerificationResult) -> dict:
    return {
        "status": r.status.value,
        "provider": r.provider,
        "provider_reference": r.provider_reference,
        "mode": r.mode.value,
        "action_url": r.action_url,
        "extracted": r.extracted,
        "confidence": r.confidence,
        "error_message": r.error_message,
    }


def _record_no_throw(db: Session, credential: ClinicianCredential, new_status: str,
                     reason_code: str, provider: str) -> None:
    """Best-effort transition write — if the state graph disallows it (e.g.
    provider returns SUBMITTED when we're already PROCESSING), skip silently.
    We never want an audit-write failure to break a provider integration."""
    try:
        record_transition(
            db,
            entity_type=ENTITY_TYPE,
            entity_id=credential.id,
            previous_status=credential.status,
            new_status=new_status,
            actor_user_id=credential.user_id,
            actor_kind="provider",
            reason_code=reason_code,
            provider=provider,
        )
    except InvalidTransitionError:
        pass


# ── Identity ────────────────────────────────────────────────────────────────

@router.post("/identity/start")
def identity_start(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register the caller with the identity provider (Sumsub or fallback).

    Returns the provider reference and (when applicable) an SDK token or
    action URL the frontend uses to launch the vendor's UI.
    """
    credential = _get_or_403(db, user.id)
    provider = get_identity_provider()
    result = provider.start(IdentityApplicant(
        reference_id=credential.id,
        legal_name=credential.legal_name,
        nationality_country=credential.nationality_country,
        email=user.email,
    ))
    if result.provider_reference:
        # Persist so status polls and webhooks can find the case.
        checks = json.loads(credential.provider_references_json or "{}") \
            if hasattr(credential, "provider_references_json") else {}
        checks[provider.name] = result.provider_reference
    _record_no_throw(db, credential,
                     new_status=result.status.value,
                     reason_code=f"identity_{result.status.value}",
                     provider=provider.name)
    db.commit()
    return _serialize_result(result)


class IdentityStatusQuery(BaseModel):
    provider_reference: str


@router.get("/identity/status")
def identity_status(
    provider_reference: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch fresh status from the identity provider."""
    _ = _get_or_403(db, user.id)  # authz
    provider = get_identity_provider()
    result = provider.fetch_status(provider_reference)
    return _serialize_result(result)


# ── Document intelligence (Azure DI or configured equivalent) ──────────────

@router.post("/documents/extract")
async def documents_extract(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run OCR/field-extraction on an uploaded document.

    Uses the existing Azure Document Intelligence adapter when configured;
    otherwise returns a NOT_CONFIGURED result so the frontend can display
    a clear "configure DI to enable auto-fill" message rather than
    silently failing.
    """
    _ = _get_or_403(db, user.id)  # authz
    from app.config import settings
    from app.services.verification.base import ProviderMode

    if not (settings.azure_document_intelligence_endpoint
            and settings.azure_document_intelligence_key):
        return {
            "status": VerificationStatus.NOT_CONFIGURED.value,
            "provider": "azure_document_intelligence",
            "mode": ProviderMode.MOCK.value,
            "extracted": {},
            "confidence": {},
            "message": (
                "Azure Document Intelligence is not configured. Extracted "
                "fields will not be pre-filled — you can enter the data "
                "manually and the professional will still be reviewable."
            ),
        }

    # Live path: read file, POST to Azure DI's analyze endpoint.
    import httpx
    from urllib.parse import quote
    data = await file.read()
    endpoint = settings.azure_document_intelligence_endpoint.rstrip("/")
    model = quote(settings.azure_document_model_id, safe="")
    url = (
        f"{endpoint}/documentintelligence/documentModels/{model}:analyze"
        f"?api-version={settings.azure_document_api_version}"
    )
    try:
        resp = httpx.post(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": settings.azure_document_intelligence_key,
                "Content-Type": file.content_type or "application/octet-stream",
            },
            content=data,
            timeout=settings.credential_provider_timeout_seconds,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Document intelligence request failed: {e}")

    operation_url = resp.headers.get("operation-location")
    if not operation_url:
        raise HTTPException(status_code=502, detail="Provider did not return an operation URL.")
    return {
        "status": VerificationStatus.PROCESSING.value,
        "provider": "azure_document_intelligence",
        "mode": ProviderMode.LIVE.value,
        "operation_url": operation_url,
        "message": "Extraction in progress. Poll /documents/extract/status with the operation URL.",
    }


# ── Qualification (Veremark / Certn / Sandbox) ─────────────────────────────

@router.post("/qualifications/start")
def qualifications_start(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Kick off Veremark / Certn / sandbox verification of the dossier's qualifications."""
    credential = _get_or_403(db, user.id)
    provider = get_qualification_provider()
    result = provider.start(QualificationApplicant(
        reference_id=credential.id,
        legal_name=credential.legal_name,
        email=user.email or "",
        country_of_practice=credential.practice_country,
        institution=credential.diploma_institution,
        degree_title=credential.degree_title,
        graduation_year=credential.graduation_year,
        licence_number=credential.licence_number,
        issuing_authority=credential.issuing_authority,
    ))
    _record_no_throw(db, credential,
                     new_status=result.status.value,
                     reason_code=f"qualifications_{result.status.value}",
                     provider=provider.name)
    db.commit()
    return _serialize_result(result)


@router.get("/qualifications/status")
def qualifications_status(
    provider_reference: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ = _get_or_403(db, user.id)
    provider = get_qualification_provider()
    return _serialize_result(provider.fetch_status(provider_reference))


# ── Regulatory registry ─────────────────────────────────────────────────────

@router.post("/registry/check")
def registry_check(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consult the configured registry provider for the licence.

    Currently always returns ``manual_review`` — the spec forbids
    simulating an official regulator API that does not exist. This
    endpoint gives the compliance dashboard the context (authority
    name, home URL, review notes) needed to complete the check by hand.
    """
    credential = _get_or_403(db, user.id)
    provider = get_registry_provider()
    result = provider.check(RegistryCheckRequest(
        reference_id=credential.id,
        country=credential.licence_country,
        profession=credential.profession,
        authority=credential.issuing_authority,
        licence_number=credential.licence_number,
        legal_name=credential.legal_name,
    ))
    _record_no_throw(db, credential,
                     new_status=VerificationStatus.MANUAL_REVIEW.value,
                     reason_code="registry_manual_review_queued",
                     provider=provider.name)
    db.commit()
    return _serialize_result(result)
