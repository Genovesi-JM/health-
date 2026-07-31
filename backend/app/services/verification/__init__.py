from __future__ import annotations
"""Verification provider registry + config-driven selectors.

Application code should always go through these getters instead of
instantiating a specific vendor's class. That way we can:

    * Swap providers via a single env var (``IDENTITY_PROVIDER=persona``).
    * Force-sandbox everything for staging demos (``KAYA_VERIFICATION_MODE=sandbox``).
    * Add a new vendor by registering it below — the rest of the code
      never learns the vendor's name.
"""

from typing import Callable

from app.config import settings

from .base import (
    DocumentIntelligenceProvider,
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
from .certn import CertnQualificationProvider
from .manual_registry import ManualRegistryProvider, lookup_authority
from .sandbox import (
    SandboxIdentityProvider,
    SandboxQualificationProvider,
    SandboxRegistryProvider,
)
from .sumsub import SumsubIdentityProvider
from .veremark import VeremarkQualificationProvider


# ── Registry ─────────────────────────────────────────────────────────────────

_IDENTITY_REGISTRY: dict[str, Callable[[], IdentityVerificationProvider]] = {
    "sumsub":  SumsubIdentityProvider,
    "sandbox": SandboxIdentityProvider,
}

_QUALIFICATION_REGISTRY: dict[str, Callable[[], QualificationVerificationProvider]] = {
    "veremark": VeremarkQualificationProvider,
    "certn":    CertnQualificationProvider,
    "sandbox":  SandboxQualificationProvider,
}

_REGISTRY_REGISTRY: dict[str, Callable[[], RegulatoryRegistryProvider]] = {
    "manual":  ManualRegistryProvider,
    "sandbox": SandboxRegistryProvider,
}


# ── Selectors ────────────────────────────────────────────────────────────────

def _sandbox_forced() -> bool:
    return (settings.kaya_verification_mode or "live").lower() == "sandbox"


def get_identity_provider() -> IdentityVerificationProvider:
    if _sandbox_forced():
        return SandboxIdentityProvider()
    factory = _IDENTITY_REGISTRY.get(
        (settings.identity_provider or "sumsub").lower(),
        SandboxIdentityProvider,
    )
    return factory()


def get_qualification_provider() -> QualificationVerificationProvider:
    if _sandbox_forced():
        return SandboxQualificationProvider()
    factory = _QUALIFICATION_REGISTRY.get(
        (settings.qualification_provider or "veremark").lower(),
        SandboxQualificationProvider,
    )
    return factory()


def get_registry_provider() -> RegulatoryRegistryProvider:
    if _sandbox_forced():
        return SandboxRegistryProvider()
    return ManualRegistryProvider()


__all__ = [
    # Interfaces
    "IdentityVerificationProvider",
    "QualificationVerificationProvider",
    "RegulatoryRegistryProvider",
    "DocumentIntelligenceProvider",
    # Value types
    "IdentityApplicant",
    "QualificationApplicant",
    "RegistryCheckRequest",
    "VerificationResult",
    "VerificationStatus",
    "ProviderMode",
    # Selectors
    "get_identity_provider",
    "get_qualification_provider",
    "get_registry_provider",
    # Config helpers
    "lookup_authority",
]
