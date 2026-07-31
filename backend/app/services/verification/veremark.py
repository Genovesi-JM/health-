from __future__ import annotations
"""Veremark qualification-verification adapter.

Veremark (veremark.com) verifies education, employment history, professional
memberships, licences and references — reachable via a REST API with
per-request Bearer auth and HMAC-SHA256 webhook signatures on the
``X-Veremark-Signature`` header.

Falls back to the sandbox provider when ``VEREMARK_API_KEY`` is missing.
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


VEREMARK_ROOT = "https://api.veremark.com/v1"


def _map_status(payload: dict[str, Any]) -> VerificationStatus:
    """Veremark check-level status → Kaya status."""
    raw = str(payload.get("status", "")).lower()
    verdict = str(payload.get("verdict", "")).lower()
    if raw in {"complete", "completed", "closed"}:
        if verdict in {"passed", "clear", "verified"}:
            return VerificationStatus.COMPLETED
        if verdict in {"partial", "partially_verified"}:
            return VerificationStatus.PARTIALLY_VERIFIED
        if verdict in {"unable_to_verify", "no_response"}:
            return VerificationStatus.UNABLE_TO_VERIFY
        return VerificationStatus.FAILED
    if raw in {"in_progress", "pending", "started"}:
        return VerificationStatus.PROCESSING
    if raw in {"waiting_candidate", "candidate_input_required"}:
        return VerificationStatus.ACTION_REQUIRED
    return VerificationStatus.SUBMITTED


class VeremarkQualificationProvider:
    name = "veremark"

    def __init__(self) -> None:
        if credentials_missing(settings.veremark_api_key):
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
            "reference": applicant.reference_id,
            "candidate": {
                "name": applicant.legal_name,
                "email": applicant.email,
                "country_of_practice": applicant.country_of_practice,
            },
            "checks": [
                {"type": "education", "institution": applicant.institution,
                 "qualification": applicant.degree_title,
                 "year": applicant.graduation_year},
                {"type": "professional_licence",
                 "authority": applicant.issuing_authority,
                 "licence_number": applicant.licence_number},
            ],
        }
        try:
            payload = self._post("/candidates", body)
        except httpx.HTTPError as exc:
            return VerificationResult(
                status=VerificationStatus.FAILED,
                provider=self.name, mode=self.mode,
                error_message=str(exc)[:500],
            )
        return VerificationResult(
            status=VerificationStatus.SUBMITTED,
            provider=self.name, mode=self.mode,
            provider_reference=str(payload.get("id") or payload.get("candidate_id")),
            action_url=payload.get("portal_url"),
            raw=payload,
        )

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        if not self._live:
            return self._fallback.fetch_status(provider_reference)
        payload = self._get(f"/candidates/{provider_reference}")
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
        secret = settings.veremark_webhook_secret or ""
        if credentials_missing(secret):
            return False
        supplied = (
            headers.get("X-Veremark-Signature")
            or headers.get("x-veremark-signature")
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
            provider_reference=str(payload.get("id") or payload.get("reference") or ""),
            extracted=self._pick_extract(payload),
            raw=payload,
        )

    # ── Private ──────────────────────────────────────────────────────────

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        r = httpx.post(
            f"{VEREMARK_ROOT}{path}",
            headers=self._auth_headers(),
            content=json.dumps(body).encode(),
            timeout=settings.credential_provider_timeout_seconds,
        )
        r.raise_for_status()
        return r.json()

    def _get(self, path: str) -> dict[str, Any]:
        r = httpx.get(
            f"{VEREMARK_ROOT}{path}",
            headers=self._auth_headers(),
            timeout=settings.credential_provider_timeout_seconds,
        )
        r.raise_for_status()
        return r.json()

    def _auth_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.veremark_api_key or ''}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _pick_extract(payload: dict[str, Any]) -> dict[str, Any]:
        picked: dict[str, Any] = {}
        for check in payload.get("checks", []) or []:
            ctype = check.get("type")
            verdict = check.get("verdict")
            if ctype and verdict:
                picked[f"{ctype}_verdict"] = verdict
        return picked
