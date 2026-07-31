from __future__ import annotations
"""Certn qualification/background adapter — Veremark fallback.

Certn (certn.co) offers education, employment, licence, and criminal-record
checks with a REST API. Kaya uses Certn as an alternative to Veremark for
markets Veremark does not cover (Certn is particularly strong in the
Americas and parts of APAC).

Falls back to the sandbox provider when ``CERTN_API_KEY`` is missing.
"""

import hashlib
import hmac
import json
from typing import Any

import httpx

from app.config import settings

from .base import (
    ProviderMode,
    QualificationApplicant,
    VerificationResult,
    VerificationStatus,
    credentials_missing,
)
from .sandbox import SandboxQualificationProvider


CERTN_ROOT = "https://api.certn.co/hr/v1"


def _map_status(payload: dict[str, Any]) -> VerificationStatus:
    """Certn report status → Kaya status."""
    raw = str(payload.get("report_status") or payload.get("status") or "").lower()
    result = str(payload.get("report_result") or payload.get("result") or "").lower()
    if raw in {"complete", "completed"}:
        if result in {"cleared", "passed"}:
            return VerificationStatus.COMPLETED
        if result in {"consider", "needs_review"}:
            return VerificationStatus.MANUAL_REVIEW
        if result in {"partial"}:
            return VerificationStatus.PARTIALLY_VERIFIED
        return VerificationStatus.FAILED
    if raw in {"pending", "in_progress"}:
        return VerificationStatus.PROCESSING
    if raw in {"awaiting_input", "awaiting_candidate"}:
        return VerificationStatus.ACTION_REQUIRED
    return VerificationStatus.SUBMITTED


class CertnQualificationProvider:
    name = "certn"

    def __init__(self) -> None:
        if credentials_missing(settings.certn_api_key):
            self._live = False
            self._fallback = SandboxQualificationProvider()
            self.mode = ProviderMode.MOCK
        else:
            self._live = True
            self._fallback = None
            self.mode = ProviderMode.LIVE

    def start(self, applicant: QualificationApplicant) -> VerificationResult:
        if not self._live:
            return self._fallback.start(applicant)
        body = {
            "email": applicant.email,
            "first_name": applicant.legal_name.split(" ", 1)[0],
            "last_name": applicant.legal_name.rsplit(" ", 1)[-1],
            "reference_id": applicant.reference_id,
            "education_verification": True,
            "employment_verification": True,
            "professional_licence_verification": True,
            "requested_country": applicant.country_of_practice,
        }
        try:
            payload = self._post("/applications/", body)
        except httpx.HTTPError as exc:
            return VerificationResult(
                status=VerificationStatus.FAILED,
                provider=self.name, mode=self.mode,
                error_message=str(exc)[:500],
            )
        return VerificationResult(
            status=VerificationStatus.SUBMITTED,
            provider=self.name, mode=self.mode,
            provider_reference=str(payload.get("id") or payload.get("application_id")),
            action_url=payload.get("candidate_url"),
            raw=payload,
        )

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        if not self._live:
            return self._fallback.fetch_status(provider_reference)
        payload = self._get(f"/applications/{provider_reference}/")
        return VerificationResult(
            status=_map_status(payload),
            provider=self.name, mode=self.mode,
            provider_reference=provider_reference,
            extracted=self._pick_extract(payload),
            raw=payload,
        )

    def verify_webhook(self, raw_body: bytes, headers: dict[str, str]) -> bool:
        if not self._live:
            return self._fallback.verify_webhook(raw_body, headers)
        secret = settings.certn_webhook_secret or ""
        if credentials_missing(secret):
            return False
        supplied = (
            headers.get("X-Certn-Signature")
            or headers.get("x-certn-signature")
            or ""
        )
        if supplied.startswith("sha256="):
            supplied = supplied[len("sha256="):]
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, supplied)

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult:
        if not self._live:
            return self._fallback.parse_webhook(payload)
        return VerificationResult(
            status=_map_status(payload),
            provider=self.name, mode=self.mode,
            provider_reference=str(payload.get("id") or payload.get("application_id") or ""),
            extracted=self._pick_extract(payload),
            raw=payload,
        )

    # ── Private ──────────────────────────────────────────────────────────

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        r = httpx.post(
            f"{CERTN_ROOT}{path}",
            headers=self._auth_headers(),
            content=json.dumps(body).encode(),
            timeout=settings.credential_provider_timeout_seconds,
        )
        r.raise_for_status()
        return r.json()

    def _get(self, path: str) -> dict[str, Any]:
        r = httpx.get(
            f"{CERTN_ROOT}{path}",
            headers=self._auth_headers(),
            timeout=settings.credential_provider_timeout_seconds,
        )
        r.raise_for_status()
        return r.json()

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Token {settings.certn_api_key or ''}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _pick_extract(payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "report_status": payload.get("report_status"),
            "report_result": payload.get("report_result"),
        }
