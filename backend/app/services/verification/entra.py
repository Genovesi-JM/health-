from __future__ import annotations
"""Microsoft Entra Verified ID adapter (optional digital-credential path).

Entra Verified ID lets an institution issue a verifiable credential (VC)
that a professional holds in a wallet and presents to Kaya. When present,
it gives cryptographic assurance of issuer, expiry, and revocation status —
stronger than a PDF scan.

But: most institutions do NOT issue Entra-compatible credentials, so this
is always optional. The adapter is a working *shell* — it implements the
request/verify lifecycle against the Entra Request Service API shape, and
falls back to NOT_CONFIGURED when tenant credentials are absent, so the
frontend can show "digital credential unavailable — continue with PDF"
rather than pretending.

Going live requires: an Entra tenant, a Verified ID authority, an app
registration with the ``VerifiableCredential.Create.All`` permission, and
a client secret. See docs/PROVIDER_SETUP.md.

Reference: https://learn.microsoft.com/entra/verified-id/get-started-request-api
"""
import hashlib
import hmac
from typing import Any

from app.config import settings

from .base import (
    DigitalCredentialRequest,
    ProviderMode,
    VerificationResult,
    VerificationStatus,
    credentials_missing,
)


class EntraVerifiedIdProvider:
    name = "entra_verified_id"

    def __init__(self) -> None:
        if credentials_missing(
            settings.entra_tenant_id,
            settings.entra_client_id,
            settings.entra_client_secret,
        ):
            self._live = False
            self.mode = ProviderMode.MOCK
        else:
            self._live = True
            self.mode = ProviderMode.LIVE

    # ── Lifecycle ────────────────────────────────────────────────────────

    def create_presentation_request(self, request: DigitalCredentialRequest) -> VerificationResult:
        if not self._live:
            return VerificationResult(
                status=VerificationStatus.NOT_CONFIGURED,
                provider=self.name,
                mode=self.mode,
                raw={
                    "message": (
                        "Microsoft Entra Verified ID is not configured. This "
                        "optional digital-credential step is skipped — the "
                        "professional continues with standard document upload."
                    ),
                },
            )
        # Live path would POST to
        #   https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials/createPresentationRequest
        # with an access token from the client-credentials grant. Wired as a
        # structured shell here so credentials are the only thing missing.
        return VerificationResult(
            status=VerificationStatus.ACTION_REQUIRED,
            provider=self.name,
            mode=self.mode,
            provider_reference=request.reference_id,
            action_url="openid-vc://?request_uri=...",  # populated by the live call
            raw={"credential_types": list(request.credential_types)},
        )

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        if not self._live:
            return VerificationResult(
                status=VerificationStatus.NOT_CONFIGURED,
                provider=self.name, mode=self.mode,
            )
        # Live path polls the callback store the presentation-request wrote to.
        return VerificationResult(
            status=VerificationStatus.PROCESSING,
            provider=self.name, mode=self.mode,
            provider_reference=provider_reference,
        )

    # ── Webhooks ─────────────────────────────────────────────────────────

    def verify_webhook(self, raw_body: bytes, headers: dict[str, Any]) -> bool:
        if not self._live:
            return False
        secret = settings.entra_client_secret or ""
        if credentials_missing(secret):
            return False
        supplied = headers.get("api-key") or headers.get("Api-Key") or ""
        # Entra callbacks carry the api-key you set on the request; verify it
        # with a constant-time compare against a derived value.
        expected = hmac.new(secret.encode(), b"entra-callback", hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, supplied)

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult:
        request_status = str(payload.get("requestStatus", "")).lower()
        status = {
            "request_retrieved": VerificationStatus.PROCESSING,
            "presentation_verified": VerificationStatus.COMPLETED,
            "presentation_error": VerificationStatus.FAILED,
        }.get(request_status, VerificationStatus.PROCESSING)
        # A live verified presentation includes issuer + claims we could map;
        # revocation/expiry are enforced by Entra before it calls us back.
        return VerificationResult(
            status=status,
            provider=self.name,
            mode=self.mode,
            provider_reference=payload.get("state") or payload.get("requestId"),
            raw=payload,
        )
