from __future__ import annotations
"""Verification-provider webhook receivers.

Each endpoint:

    1. Reads the raw body (needed for signature verification).
    2. Asks the appropriate provider adapter to verify the signature.
       Invalid → 401. This deliberately does not reveal *why* it failed.
    3. Deduplicates on (provider, event_id) so replays are safe.
    4. Parses the payload into a VerificationResult via the adapter.
    5. Locates the credential dossier by provider_reference (looked up on
       the transition audit trail — the wizard called
       /verification/*/start earlier and recorded the reference).
    6. Records a state transition and updates the credential's status.

All three receivers share ``_process`` — vendor-specific code is confined
to (signature verification, event id extraction, payload parsing) which
live in the adapter class, not here.
"""
import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.health_models import (
    ClinicianCredential,
    VerificationTransition,
    VerificationWebhookEvent,
)
from app.services.verification.base import VerificationResult
from app.services.verification.certn import CertnQualificationProvider
from app.services.verification.state_machine import (
    InvalidTransitionError,
    record_transition,
)
from app.services.verification.sumsub import SumsubIdentityProvider
from app.services.verification.veremark import VeremarkQualificationProvider

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


ENTITY_TYPE = "clinician_credential"


# ── Helpers ─────────────────────────────────────────────────────────────────

def _hash_body(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def _extract_event_id(provider: str, payload: dict, headers: dict) -> str:
    """Best-effort per-provider event id extraction for dedup."""
    if provider == "sumsub":
        return str(payload.get("id") or payload.get("applicantId") or "")
    if provider == "veremark":
        return str(payload.get("event_id") or payload.get("id") or headers.get("X-Veremark-Event-Id", ""))
    if provider == "certn":
        return str(payload.get("event_id") or payload.get("id") or "")
    return ""


def _find_credential_by_ref(db: Session, provider_reference: str) -> Optional[ClinicianCredential]:
    """Find the credential whose earliest transition mentioned this reference.

    We stash the provider reference on the transition's ``evidence_ref``
    field when the wizard first calls ``/verification/*/start``. This lets
    the webhook route the callback without needing a separate provider-
    reference table.
    """
    row = (
        db.query(VerificationTransition)
        .filter(VerificationTransition.evidence_ref == provider_reference)
        .order_by(VerificationTransition.at.desc())
        .first()
    )
    if not row:
        return None
    if row.entity_type != ENTITY_TYPE:
        return None
    return db.query(ClinicianCredential).filter(
        ClinicianCredential.id == row.entity_id
    ).first()


def _process(
    provider_name: str,
    signature_ok: bool,
    payload: dict,
    result: VerificationResult,
    raw_headers: dict,
    db: Session,
) -> dict:
    if not signature_ok:
        # 401 without detail — do not leak whether signature was missing vs wrong.
        raise HTTPException(status_code=401, detail="Unauthorized.")

    event_id = _extract_event_id(provider_name, payload, raw_headers)
    if not event_id:
        # Providers should always give us something; if not we still 200 so
        # they don't infinite-retry, but skip the state change.
        return {"processed": False, "reason": "no_event_id"}

    # Dedup.
    try:
        db.add(VerificationWebhookEvent(
            provider=provider_name,
            event_id=event_id,
            payload_hash=_hash_body(str(payload).encode()),
        ))
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"processed": False, "reason": "duplicate_event", "event_id": event_id}

    credential = _find_credential_by_ref(db, result.provider_reference or "")
    if not credential:
        # Store the dedup row but skip the transition; case may have been
        # deleted or the reference never got persisted (dev issue).
        db.commit()
        return {"processed": False, "reason": "credential_not_found"}

    try:
        record_transition(
            db,
            entity_type=ENTITY_TYPE,
            entity_id=credential.id,
            previous_status=credential.status,
            new_status=result.status.value,
            actor_user_id=None,
            actor_kind="webhook",
            reason_code=f"{provider_name}_webhook",
            provider=provider_name,
            evidence_ref=result.provider_reference,
        )
        credential.status = result.status.value
    except InvalidTransitionError:
        # Provider sent an event that violates the state graph — happens
        # with duplicate or out-of-order deliveries. Still record the dedup.
        pass

    db.commit()
    return {"processed": True, "event_id": event_id, "new_status": result.status.value}


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/sumsub")
async def sumsub_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items()}
    provider = SumsubIdentityProvider()
    payload = await request.json()
    return _process(
        provider_name="sumsub",
        signature_ok=provider.verify_webhook(body, headers),
        payload=payload,
        result=provider.parse_webhook(payload),
        raw_headers=headers,
        db=db,
    )


@router.post("/veremark")
async def veremark_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items()}
    provider = VeremarkQualificationProvider()
    payload = await request.json()
    return _process(
        provider_name="veremark",
        signature_ok=provider.verify_webhook(body, headers),
        payload=payload,
        result=provider.parse_webhook(payload),
        raw_headers=headers,
        db=db,
    )


@router.post("/certn")
async def certn_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    headers = {k: v for k, v in request.headers.items()}
    provider = CertnQualificationProvider()
    payload = await request.json()
    return _process(
        provider_name="certn",
        signature_ok=provider.verify_webhook(body, headers),
        payload=payload,
        result=provider.parse_webhook(payload),
        raw_headers=headers,
        db=db,
    )
