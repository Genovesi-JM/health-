"""KAYA Response — scope & exclusion boundary (Phase R1). Domain-pure.

Defines what Response IS and, far more importantly, what it is NOT. Response is
never a substitute for emergency services, never dispatches an ambulance, never
contacts a hospital, and never guarantees a response time. Capabilities are an
explicit allowlist that is empty by default; a capability is available only when
it is approved for the scope, not on the permanent exclusion list, and Response is
active. An unknown or unsupported jurisdiction exposes information only.

Composes the Phase 21 `emergency` guards. Stdlib-only, importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from . import emergency

# Capabilities that are PERMANENTLY excluded — no scope, flag, or approval can
# ever enable them within KAYA Response.
EXCLUDED_CAPABILITIES = frozenset({
    "ambulance_dispatch", "emergency_dispatch", "hospital_admission",
    "hospital_contact", "police_dispatch", "guaranteed_response_time",
    "override_emergency_services", "triage_override",
})

BOUNDARY_NOTICE = (
    "A KAYA Response NÃO substitui os serviços de emergência, não envia ambulância "
    "nem contacta hospitais, e não garante tempos de resposta. Em emergência, "
    "contacte imediatamente os serviços de emergência locais."
)


@dataclass(frozen=True)
class ResponseScope:
    scope_id: str
    approved_jurisdictions: frozenset          # e.g. {"AO-LUANDA"}
    approved_capabilities: frozenset           # explicit allowlist (never excluded ones)
    signed_off_by: Optional[str] = None        # a named human


def scope_is_valid(scope: ResponseScope) -> tuple[bool, tuple]:
    """A scope must be signed and must not attempt to approve an excluded
    capability."""
    reasons: list[str] = []
    if not scope.scope_id:
        reasons.append("scope id required")
    if not scope.signed_off_by:
        reasons.append("scope must be signed by a named human")
    overreach = scope.approved_capabilities & EXCLUDED_CAPABILITIES
    if overreach:
        reasons.append(f"scope tries to approve excluded capabilities: {sorted(overreach)}")
    return (not reasons, tuple(reasons))


def capability_permitted(scope: ResponseScope, capability: str,
                         jurisdiction: str, response_active: bool) -> bool:
    """Fail-closed: a capability is permitted only when Response is active, the
    capability is explicitly approved for the scope, the jurisdiction is approved,
    and the capability is not permanently excluded."""
    if not response_active:
        return False
    if capability in EXCLUDED_CAPABILITIES:
        return False
    if jurisdiction not in scope.approved_jurisdictions:
        return False
    return capability in scope.approved_capabilities


def jurisdiction_supported(scope: ResponseScope, jurisdiction: Optional[str]) -> bool:
    return bool(jurisdiction) and jurisdiction in scope.approved_jurisdictions


def exposure_for_jurisdiction(scope: ResponseScope, jurisdiction: Optional[str]) -> str:
    """An unknown/unsupported jurisdiction exposes information only."""
    return "capabilities" if jurisdiction_supported(scope, jurisdiction) else "information_only"


def boundary_notice() -> str:
    return BOUNDARY_NOTICE


def content_within_boundary(text: str) -> bool:
    """Response-facing copy must make no external-action or guarantee claim (reuses
    the Phase 21 emergency guards)."""
    return emergency.claims_no_external_action(text)
