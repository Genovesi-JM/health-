from __future__ import annotations
"""In-process sandbox providers — deterministic, no network calls.

Used when the app runs without vendor credentials (dev, CI, offline demos).
Behavior is deterministic per reference_id so tests and demos can rely on
the same "verified vs unable_to_verify" answers each run.

CRITICAL: these providers must never issue results that a downstream state
machine would treat as production-live evidence. All results carry
``mode=ProviderMode.MOCK``; the compliance-decision layer must refuse to
final-approve a professional whose evidence is mock-only.
"""

import hashlib
import uuid
from typing import Any

from .base import (
    IdentityApplicant,
    IdentityVerificationProvider,
    ProviderMode,
    QualificationApplicant,
    QualificationVerificationProvider,
    RegistryCheckRequest,
    RegulatoryRegistryProvider,
    VerificationResult,
    VerificationStatus,
)


def _bucket(reference_id: str, buckets: int = 100) -> int:
    """Deterministic 0..buckets-1 bucket for a reference id."""
    h = hashlib.sha256(reference_id.encode("utf-8")).digest()
    return int.from_bytes(h[:4], "big") % buckets


def _fake_ref(prefix: str, reference_id: str) -> str:
    return f"{prefix}-{hashlib.sha256(reference_id.encode()).hexdigest()[:16]}"


# ── Identity ─────────────────────────────────────────────────────────────────

class SandboxIdentityProvider:
    """~90% pass, ~7% action_required, ~3% failed — deterministic by id."""
    name = "sandbox_identity"
    mode = ProviderMode.MOCK

    def start(self, applicant: IdentityApplicant) -> VerificationResult:
        return VerificationResult(
            status=VerificationStatus.ACTION_REQUIRED,
            provider=self.name,
            mode=self.mode,
            provider_reference=_fake_ref("sbx-id", applicant.reference_id),
            action_url=f"https://sandbox.kaya.local/identity/{applicant.reference_id}",
            raw={"applicant_id": applicant.reference_id, "sandbox": True},
        )

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        bucket = _bucket(provider_reference)
        if bucket < 90:
            status = VerificationStatus.COMPLETED
        elif bucket < 97:
            status = VerificationStatus.ACTION_REQUIRED
        else:
            status = VerificationStatus.FAILED
        extracted = {
            "identity_matched": status == VerificationStatus.COMPLETED,
            "liveness_passed": status == VerificationStatus.COMPLETED,
        }
        return VerificationResult(
            status=status,
            provider=self.name,
            mode=self.mode,
            provider_reference=provider_reference,
            extracted=extracted,
            raw={"sandbox": True, "bucket": bucket},
        )

    def verify_webhook(self, raw_body: bytes, headers: dict[str, str]) -> bool:
        # Sandbox accepts a fixed header token so tests can exercise the path.
        return headers.get("X-Sandbox-Token") == "sandbox-ok"

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult:
        ref = str(payload.get("reference_id") or payload.get("id") or uuid.uuid4())
        return self.fetch_status(ref)


# ── Qualification ────────────────────────────────────────────────────────────

class SandboxQualificationProvider:
    name = "sandbox_qualification"
    mode = ProviderMode.MOCK

    def start(self, applicant: QualificationApplicant) -> VerificationResult:
        return VerificationResult(
            status=VerificationStatus.SUBMITTED,
            provider=self.name,
            mode=self.mode,
            provider_reference=_fake_ref("sbx-qual", applicant.reference_id),
            raw={"reference_id": applicant.reference_id, "sandbox": True},
        )

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        bucket = _bucket(provider_reference)
        if bucket < 80:
            status = VerificationStatus.COMPLETED
            extracted = {"education": "verified", "employment": "verified"}
        elif bucket < 92:
            status = VerificationStatus.PARTIALLY_VERIFIED
            extracted = {"education": "verified", "employment": "unable_to_verify"}
        elif bucket < 98:
            status = VerificationStatus.ACTION_REQUIRED
            extracted = {"missing_document": "reference_letter"}
        else:
            status = VerificationStatus.UNABLE_TO_VERIFY
            extracted = {}
        return VerificationResult(
            status=status,
            provider=self.name,
            mode=self.mode,
            provider_reference=provider_reference,
            extracted=extracted,
            raw={"sandbox": True, "bucket": bucket},
        )

    def verify_webhook(self, raw_body: bytes, headers: dict[str, str]) -> bool:
        return headers.get("X-Sandbox-Token") == "sandbox-ok"

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult:
        ref = str(payload.get("reference_id") or payload.get("id") or uuid.uuid4())
        return self.fetch_status(ref)


# ── Regulatory registry ──────────────────────────────────────────────────────

class SandboxRegistryProvider:
    """Sandbox 'registry' — always returns MANUAL_REVIEW.

    Rationale: the spec is explicit that regulatory authorities remain the
    final source of truth, and Kaya must never simulate an official API that
    does not exist. Even in dev, the registry step must therefore drop into
    a manual-review workflow rather than auto-passing.
    """
    name = "sandbox_registry"
    mode = ProviderMode.MOCK

    def check(self, request: RegistryCheckRequest) -> VerificationResult:
        return VerificationResult(
            status=VerificationStatus.MANUAL_REVIEW,
            provider=self.name,
            mode=self.mode,
            provider_reference=_fake_ref("sbx-reg", request.reference_id),
            raw={
                "authority": request.authority,
                "country": request.country,
                "profession": request.profession,
                "message": (
                    "Sandbox mode: no live registry API is invoked. A compliance "
                    "reviewer must confirm this licence via the authority's "
                    "public registry or partnership channel before approval."
                ),
                "sandbox": True,
            },
        )


# Provide runtime_checkable-friendly aliases so `isinstance(x, IdentityVerificationProvider)`
# works even when someone constructs a Sandbox instance without a nominal parent class.
_ID: IdentityVerificationProvider = SandboxIdentityProvider()          # type: ignore[assignment]
_QUAL: QualificationVerificationProvider = SandboxQualificationProvider()  # type: ignore[assignment]
_REG: RegulatoryRegistryProvider = SandboxRegistryProvider()           # type: ignore[assignment]
