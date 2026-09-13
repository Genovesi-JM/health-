from __future__ import annotations
"""Fail-closed boundary for optional Microsoft Entra Verified ID.

Live HTTP exchange, issuer trust, callback correlation and expiry/revocation
checks are not implemented. Credentials cannot activate this boundary.
Document upload/manual review remain separate, never auto-approved paths.
"""
from typing import Any

from .base import DigitalCredentialRequest, ProviderMode, VerificationResult, VerificationStatus


class EntraVerifiedIdProvider:
    name = "entra_verified_id"

    def __init__(self) -> None:
        self._live = False
        self.mode = ProviderMode.UNAVAILABLE

    def _unavailable(self) -> VerificationResult:
        return VerificationResult(
            status=VerificationStatus.NOT_CONFIGURED,
            provider=self.name,
            mode=self.mode,
            raw={"code": "adapter_not_implemented", "message": (
                "Microsoft Entra Verified ID is not implemented and validated. "
                "Continue with standard document upload and manual review."
            )},
        )

    def create_presentation_request(self, request: DigitalCredentialRequest) -> VerificationResult:
        return self._unavailable()

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        return self._unavailable()

    def verify_webhook(self, raw_body: bytes, headers: dict[str, Any]) -> bool:
        return False

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult:
        # A supplied "verified" field cannot establish a professional credential.
        return self._unavailable()
