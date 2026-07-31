from __future__ import annotations
"""Sumsub identity + liveness adapter.

Sumsub (sumsub.com) offers document verification, face-match, and liveness
detection. Kaya uses their Applicant-Data API + WebSDK:

  1. ``start()`` calls POST /resources/applicants to register the applicant,
     then POST /resources/accessTokens/sdk to mint a short-lived token the
     frontend uses to boot the WebSDK.
  2. ``fetch_status()`` calls GET /resources/applicants/{id}/status.
  3. Sumsub POSTs webhook events to Kaya on state changes; ``verify_webhook``
     enforces the ``x-payload-digest`` HMAC-SHA256 header.

When ``SUMSUB_APP_TOKEN`` / ``SUMSUB_SECRET_KEY`` are not configured the
adapter **transparently falls back to the sandbox provider** so dev keeps
working. Callers can detect this via the returned ``mode`` field.

References:
    https://developers.sumsub.com/api-reference/
    https://developers.sumsub.com/api-reference/#app-tokens-and-request-signing
"""

import hashlib
import hmac
import json
import time
from typing import Any

import httpx

from app.config import settings

from .base import (
    IdentityApplicant,
    ProviderMode,
    VerificationResult,
    VerificationStatus,
    credentials_missing,
)
from .sandbox import SandboxIdentityProvider


SUMSUB_API_ROOT = "https://api.sumsub.com"


def _sign(secret: str, method: str, path: str, body: bytes, ts: int) -> str:
    """Sumsub request signing: HMAC_SHA256(ts + METHOD + path + body)."""
    msg = f"{ts}{method.upper()}{path}".encode() + body
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


def _map_sumsub_status(payload: dict[str, Any]) -> VerificationStatus:
    """Translate Sumsub review answers into our status vocabulary."""
    review = payload.get("reviewResult") or {}
    answer = str(review.get("reviewAnswer", "")).upper()
    reject_type = str(review.get("reviewRejectType", "")).upper()

    if answer == "GREEN":
        return VerificationStatus.COMPLETED
    if answer == "RED":
        return (
            VerificationStatus.ACTION_REQUIRED
            if reject_type == "RETRY"
            else VerificationStatus.FAILED
        )
    review_status = str(payload.get("reviewStatus", "")).lower()
    if review_status in ("pending", "queued"):
        return VerificationStatus.PROCESSING
    if review_status == "init":
        return VerificationStatus.ACTION_REQUIRED
    return VerificationStatus.PROCESSING


class SumsubIdentityProvider:
    name = "sumsub"

    def __init__(self) -> None:
        if credentials_missing(settings.sumsub_app_token, settings.sumsub_secret_key):
            self._live = False
            self._fallback = SandboxIdentityProvider()
            self.mode = ProviderMode.MOCK
        else:
            self._live = True
            self._fallback = None
            self.mode = ProviderMode.LIVE

    # ── Lifecycle ────────────────────────────────────────────────────────

    def start(self, applicant: IdentityApplicant) -> VerificationResult:
        if not self._live:
            return self._fallback.start(applicant)

        # Register applicant + mint access token.
        try:
            applicant_id = self._create_applicant(applicant)
            token = self._create_access_token(applicant.reference_id)
        except httpx.HTTPError as exc:
            return VerificationResult(
                status=VerificationStatus.FAILED,
                provider=self.name,
                mode=self.mode,
                error_message=str(exc)[:500],
            )

        return VerificationResult(
            status=VerificationStatus.ACTION_REQUIRED,
            provider=self.name,
            mode=self.mode,
            provider_reference=applicant_id,
            action_url=None,  # frontend uses the SDK token; no direct URL.
            raw={"access_token": token, "applicant_id": applicant_id},
        )

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        if not self._live:
            return self._fallback.fetch_status(provider_reference)
        path = f"/resources/applicants/{provider_reference}/one"
        payload = self._signed_get(path)
        return VerificationResult(
            status=_map_sumsub_status(payload),
            provider=self.name,
            mode=self.mode,
            provider_reference=provider_reference,
            extracted=self._pick_info(payload),
            raw=payload,
        )

    # ── Webhooks ─────────────────────────────────────────────────────────

    def verify_webhook(self, raw_body: bytes, headers: dict[str, str]) -> bool:
        if not self._live:
            return self._fallback.verify_webhook(raw_body, headers)
        secret = settings.sumsub_webhook_secret or ""
        if credentials_missing(secret):
            return False
        supplied = headers.get("x-payload-digest") or headers.get("X-Payload-Digest") or ""
        alg = headers.get("x-payload-digest-alg", "HMAC_SHA256_HEX")
        digest_algo = {
            "HMAC_SHA256_HEX": hashlib.sha256,
            "HMAC_SHA1_HEX": hashlib.sha1,
            "HMAC_SHA512_HEX": hashlib.sha512,
        }.get(alg.upper(), hashlib.sha256)
        expected = hmac.new(secret.encode(), raw_body, digest_algo).hexdigest()
        return hmac.compare_digest(expected, supplied)

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult:
        if not self._live:
            return self._fallback.parse_webhook(payload)
        return VerificationResult(
            status=_map_sumsub_status(payload),
            provider=self.name,
            mode=self.mode,
            provider_reference=payload.get("applicantId") or payload.get("externalUserId"),
            extracted=self._pick_info(payload),
            raw=payload,
        )

    # ── Private ──────────────────────────────────────────────────────────

    def _create_applicant(self, applicant: IdentityApplicant) -> str:
        body = json.dumps({
            "externalUserId": applicant.reference_id,
            "email": applicant.email,
            "info": {
                "firstName": applicant.legal_name.split(" ", 1)[0],
                "lastName": applicant.legal_name.rsplit(" ", 1)[-1],
                "dob": applicant.date_of_birth,
                "country": applicant.nationality_country,
            },
        }).encode()
        path = f"/resources/applicants?levelName={settings.sumsub_level_name}"
        response = self._signed_request("POST", path, body)
        return response["id"]

    def _create_access_token(self, external_user_id: str) -> str:
        path = f"/resources/accessTokens?userId={external_user_id}&levelName={settings.sumsub_level_name}"
        response = self._signed_request("POST", path, b"")
        return response["token"]

    def _signed_request(self, method: str, path: str, body: bytes) -> dict[str, Any]:
        ts = int(time.time())
        sig = _sign(settings.sumsub_secret_key or "", method, path, body, ts)
        response = httpx.request(
            method,
            f"{SUMSUB_API_ROOT}{path}",
            headers={
                "X-App-Token": settings.sumsub_app_token or "",
                "X-App-Access-Sig": sig,
                "X-App-Access-Ts": str(ts),
                "Content-Type": "application/json",
            },
            content=body,
            timeout=settings.credential_provider_timeout_seconds,
        )
        response.raise_for_status()
        return response.json()

    def _signed_get(self, path: str) -> dict[str, Any]:
        return self._signed_request("GET", path, b"")

    @staticmethod
    def _pick_info(payload: dict[str, Any]) -> dict[str, Any]:
        info = payload.get("info", {}) if isinstance(payload, dict) else {}
        review = payload.get("reviewResult", {}) if isinstance(payload, dict) else {}
        picked: dict[str, Any] = {}
        for k in ("firstName", "lastName", "dob", "country", "nationality"):
            if info.get(k):
                picked[k] = info[k]
        if review.get("reviewAnswer"):
            picked["review_answer"] = review["reviewAnswer"]
        return picked
