"""Staging environment and pre-flight release gate (Phase 40). Domain-pure.

A go/no-go aggregation on top of the Phase 2 governance release board. It fails
closed: production release is NO-GO unless a separate staging environment (with
synthetic data only) has passed, every phase gate is GREEN with no unresolved
external gate, and every required human sign-off is present from a non-agent
holder with separation of duties. The agent can never sign off or self-clear.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# Gate verdicts a phase can carry.
GREEN = "GREEN"                 # done, no external dependency
EXTERNAL = "EXTERNAL"           # complete-with-external-gates (not yet releasable)
RED = "RED"                     # failed
UNKNOWN = "UNKNOWN"             # not assessed → treated as blocking


AGENT_IDENTITIES = frozenset({"agent", "engineering_preparer", "claude", "automation"})

# Human sign-offs required before any clinical production release.
REQUIRED_SIGNOFFS = frozenset({
    "clinical_safety", "legal", "privacy", "security", "accessibility", "operations",
})


# ── Environment isolation ────────────────────────────────────────────────────

@dataclass(frozen=True)
class Environment:
    name: str                       # "staging" | "production"
    database_url: str
    domain: str
    uses_synthetic_data: bool
    credentials_ref: str


def environments_isolated(staging: Environment, production: Environment) -> bool:
    """Staging must not share a database, domain, or credentials with production."""
    if staging.database_url == production.database_url:
        return False
    if staging.domain == production.domain:
        return False
    if staging.credentials_ref == production.credentials_ref:
        return False
    return True


def staging_data_is_synthetic(staging: Environment) -> bool:
    """Staging must carry synthetic data only — never a copy of real records."""
    return staging.uses_synthetic_data is True


# ── Pre-flight aggregation ───────────────────────────────────────────────────

@dataclass(frozen=True)
class SignOff:
    role: str
    approver: str
    is_agent: bool = False


def signoff_valid(s: SignOff) -> bool:
    if s.role not in REQUIRED_SIGNOFFS:
        return False
    if s.is_agent or (s.approver or "").strip().lower() in AGENT_IDENTITIES:
        return False
    return bool(s.approver and s.approver.strip())


def all_signoffs_present(signoffs: list[SignOff]) -> bool:
    valid_roles = {s.role for s in signoffs if signoff_valid(s)}
    return REQUIRED_SIGNOFFS.issubset(valid_roles)


def signoffs_separation_ok(signoffs: list[SignOff]) -> bool:
    """No single person may hold two required sign-offs (separation of duties)."""
    approvers = [s.approver.strip().lower() for s in signoffs if signoff_valid(s)]
    return len(approvers) == len(set(approvers))


@dataclass(frozen=True)
class PreflightResult:
    go: bool
    blocking: tuple = ()


def preflight(gates: dict, staging: Environment, production: Environment,
              signoffs: list[SignOff], release_board_hold: bool) -> PreflightResult:
    """Fail-closed go/no-go. GO requires: the release board is NOT on hold, staging
    is isolated and synthetic, every gate GREEN (EXTERNAL/RED/UNKNOWN block), and
    all required non-agent sign-offs are present with separation of duties."""
    blocking: list[str] = []

    if release_board_hold:
        blocking.append("release board is on HOLD")

    if not environments_isolated(staging, production):
        blocking.append("staging is not isolated from production")
    if not staging_data_is_synthetic(staging):
        blocking.append("staging must use synthetic data only")

    if not gates:
        blocking.append("no phase gates recorded")
    for name, verdict in sorted(gates.items()):
        if verdict != GREEN:
            blocking.append(f"gate {name} is {verdict}")

    if not all_signoffs_present(signoffs):
        missing = REQUIRED_SIGNOFFS - {s.role for s in signoffs if signoff_valid(s)}
        blocking.append(f"missing sign-offs: {sorted(missing)}")
    if not signoffs_separation_ok(signoffs):
        blocking.append("a single approver holds multiple sign-offs")

    return PreflightResult(go=not blocking, blocking=tuple(blocking))
