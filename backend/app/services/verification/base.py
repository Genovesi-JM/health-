from __future__ import annotations
"""Verification provider interfaces.

Every external verification vendor Kaya integrates with implements one of
these Protocols. The rest of the app talks to these interfaces, so we can
swap Sumsub for Persona (identity), Veremark for Certn (qualifications),
or route to a Sandbox implementation in dev — with zero caller changes.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Protocol, runtime_checkable


# ── Common status vocabulary ─────────────────────────────────────────────────
# Every provider maps its internal states to one of these — the state
# machine (Phase 2b) will consume this vocabulary.

class VerificationStatus(str, Enum):
    NOT_STARTED = "not_started"
    CONSENT_REQUIRED = "consent_required"
    SUBMITTED = "submitted"
    ACTION_REQUIRED = "action_required"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIALLY_VERIFIED = "partially_verified"
    UNABLE_TO_VERIFY = "unable_to_verify"
    FAILED = "failed"
    MANUAL_REVIEW = "manual_review"
    NOT_CONFIGURED = "not_configured"


class ProviderMode(str, Enum):
    """How this provider instance is running right now."""
    LIVE = "live"          # real vendor API, real credentials
    SANDBOX = "sandbox"    # vendor sandbox (fake data, real API)
    MOCK = "mock"          # in-process deterministic simulation


# ── Result / request payloads ────────────────────────────────────────────────

@dataclass(frozen=True)
class VerificationResult:
    """Standard shape returned by every provider call."""
    status: VerificationStatus
    provider: str
    provider_reference: Optional[str] = None
    mode: ProviderMode = ProviderMode.LIVE
    # A URL the user must visit to complete an interactive step (Sumsub SDK,
    # Veremark candidate portal, etc.). Absent for backend-only checks.
    action_url: Optional[str] = None
    # Extracted structured data (dates, names, licence numbers, …).
    extracted: dict[str, Any] = field(default_factory=dict)
    # Confidence per extracted field, 0–1.
    confidence: dict[str, float] = field(default_factory=dict)
    # Free-form provider-specific detail. Never expose to end-users directly.
    raw: dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None

    def is_terminal(self) -> bool:
        return self.status in {
            VerificationStatus.COMPLETED,
            VerificationStatus.FAILED,
            VerificationStatus.UNABLE_TO_VERIFY,
            VerificationStatus.PARTIALLY_VERIFIED,
        }


@dataclass(frozen=True)
class IdentityApplicant:
    reference_id: str
    legal_name: str
    date_of_birth: Optional[str] = None
    nationality_country: Optional[str] = None
    email: Optional[str] = None


@dataclass(frozen=True)
class QualificationApplicant:
    reference_id: str
    legal_name: str
    email: str
    country_of_practice: str
    institution: str
    degree_title: str
    graduation_year: Optional[int]
    licence_number: str
    issuing_authority: str


@dataclass(frozen=True)
class RegistryCheckRequest:
    reference_id: str
    country: str            # ISO-2 (e.g. "AO", "ES")
    profession: str         # "doctor" | "nurse" | "pharmacist"
    authority: str          # human-readable authority name
    licence_number: str
    legal_name: str


# ── Protocol interfaces ──────────────────────────────────────────────────────

@runtime_checkable
class IdentityVerificationProvider(Protocol):
    """Sumsub, Persona, Onfido, Jumio, …"""
    name: str
    mode: ProviderMode

    def start(self, applicant: IdentityApplicant) -> VerificationResult: ...

    def fetch_status(self, provider_reference: str) -> VerificationResult: ...

    def verify_webhook(self, raw_body: bytes, headers: dict[str, str]) -> bool: ...

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult: ...


@runtime_checkable
class QualificationVerificationProvider(Protocol):
    """Veremark, Certn, DataFlow, …"""
    name: str
    mode: ProviderMode

    def start(self, applicant: QualificationApplicant) -> VerificationResult: ...

    def fetch_status(self, provider_reference: str) -> VerificationResult: ...

    def verify_webhook(self, raw_body: bytes, headers: dict[str, str]) -> bool: ...

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult: ...


@runtime_checkable
class RegulatoryRegistryProvider(Protocol):
    """Confirms professional licence with the relevant authority.

    A registry provider that supports an official API returns
    ``VerificationStatus.COMPLETED`` directly; one that does not returns
    ``MANUAL_REVIEW`` after enqueuing a review task.
    """
    name: str
    mode: ProviderMode

    def check(self, request: RegistryCheckRequest) -> VerificationResult: ...


@runtime_checkable
class DocumentIntelligenceProvider(Protocol):
    """Azure AI Document Intelligence and equivalents."""
    name: str
    mode: ProviderMode

    def extract(self, document_bytes: bytes, content_type: str) -> VerificationResult: ...

    def fetch_result(self, operation_id: str) -> VerificationResult: ...


@dataclass(frozen=True)
class DigitalCredentialRequest:
    reference_id: str
    subject_name: str
    credential_types: tuple[str, ...] = ()   # e.g. ("MedicalLicenceCredential",)


@runtime_checkable
class DigitalCredentialProvider(Protocol):
    """Microsoft Entra Verified ID and equivalents.

    Verifies digitally-issued verifiable credentials (VCs) presented from a
    wallet. Only usable when the issuing institution actually issues a
    compatible credential — most PDF diplomas do NOT, so this is always an
    optional path (spec §7 step 8).
    """
    name: str
    mode: ProviderMode

    def create_presentation_request(self, request: DigitalCredentialRequest) -> VerificationResult:
        """Start a presentation request; returns a QR/deep-link URL for the wallet."""
        ...

    def fetch_status(self, provider_reference: str) -> VerificationResult:
        """Poll for the wallet's response + issuer/expiry/revocation validation."""
        ...

    def verify_webhook(self, raw_body: bytes, headers: dict[str, Any]) -> bool: ...

    def parse_webhook(self, payload: dict[str, Any]) -> VerificationResult: ...


# ── Helpers ──────────────────────────────────────────────────────────────────

def credentials_missing(*values: Optional[str]) -> bool:
    """True if any credential is unset or a placeholder."""
    return any(
        not value or value.upper().startswith(("FAKE", "CHANGE_ME", "YOUR_", "XXX", "TODO"))
        for value in values
    )
