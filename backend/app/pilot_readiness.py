"""Pilot readiness board and named-owner roundup (Phase 41). Domain-pure.

A single, structured register of every external gate produced across Phases 0–40,
each mapped to the accountable owner role and a fail-closed status. Nothing is
READY until a named non-agent owner has signed the evidence; the agent can prepare
and enumerate but never mark a gate READY.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# Statuses a gate can hold.
OPEN = "OPEN"                    # awaiting owner action/evidence
BLOCKED_EXTERNAL = "BLOCKED_EXTERNAL"   # needs an external provider/contract
READY = "READY"                 # a named owner signed the evidence (never set by the agent)

AGENT_IDENTITIES = frozenset({"agent", "engineering_preparer", "claude", "automation"})

OWNER_ROLES = frozenset({
    "clinical_safety", "legal", "privacy", "security", "accessibility",
    "operations", "infrastructure", "data_controller", "product", "finance",
    "release_board",
})


@dataclass(frozen=True)
class Gate:
    gate_id: str
    phase: int
    title: str
    owner_role: str
    status: str = OPEN
    signed_by: Optional[str] = None       # a NAMED human; never the agent


def gate_wellformed(g: Gate) -> tuple[bool, tuple]:
    reasons: list[str] = []
    if not g.gate_id or not g.title:
        reasons.append("gate id and title required")
    if g.owner_role not in OWNER_ROLES:
        reasons.append(f"unknown owner role: {g.owner_role}")
    if g.status not in (OPEN, BLOCKED_EXTERNAL, READY):
        reasons.append(f"invalid status: {g.status}")
    if g.status == READY:
        if not g.signed_by:
            reasons.append("READY requires a named signer")
        elif g.signed_by.strip().lower() in AGENT_IDENTITIES:
            reasons.append("the agent may not sign a gate READY")
    return (not reasons, tuple(reasons))


def gate_is_ready(g: Gate) -> bool:
    ok, _ = gate_wellformed(g)
    return ok and g.status == READY


# ── The register (prepared by the agent; owners must clear it) ────────────────

def default_register() -> list[Gate]:
    """Every external gate raised across the phase work, mapped to its owner role.
    All start OPEN/BLOCKED_EXTERNAL — none is READY."""
    return [
        Gate("G-JURISDICTION", 1, "Signed jurisdiction/operator adoption (Angola/Luanda)", "release_board", OPEN),
        Gate("G-TRIAGE-VALIDATION", 20, "Independent clinical validation of triage rules + multilingual corpus", "clinical_safety", OPEN),
        Gate("G-EMERGENCY", 21, "Emergency exclusion wording + failed-escalation drills", "clinical_safety", OPEN),
        Gate("G-PG-CONCURRENCY", 23, "PostgreSQL booking concurrency evidence under replicas", "infrastructure", BLOCKED_EXTERNAL),
        Gate("G-VIDEO-PROVIDER", 25, "Approved video provider: DPA, region, security, accessibility, retention, clinical fallback", "privacy", BLOCKED_EXTERNAL),
        Gate("G-NOTE-ORM", 26, "Clinical-note sign/lock + amendment ORM adoption; retention schedule", "clinical_safety", OPEN),
        Gate("G-DRUG-KB", 27, "Licensed, validated drug-safety knowledge base + jurisdiction mapping", "clinical_safety", OPEN),
        Gate("G-MSG-REDFLAGS", 28, "Emergency red-flag review/localization + message retention", "clinical_safety", OPEN),
        Gate("G-MALWARE-SCAN", 29, "Malware scanner integration; encryption-at-rest; EXIF/metadata policy", "security", BLOCKED_EXTERNAL),
        Gate("G-AI-DPA", 30, "External-AI DPA + region/transfer + de-identification validation", "privacy", BLOCKED_EXTERNAL),
        Gate("G-VITALS-RANGES", 31, "Validated physiological ranges + critical-alert policy", "clinical_safety", OPEN),
        Gate("G-BACKUPS-DR", 32, "Encrypted offsite PITR backups + tested restore; clinical cascade migration", "infrastructure", BLOCKED_EXTERNAL),
        Gate("G-INFRA-PRIVATE", 33, "Close ACR/Storage/Key Vault public access; network design; secret rotation", "infrastructure", OPEN),
        Gate("G-DR-DRILL", 34, "Failover drill (RPO/RTO) + signed incident runbook + topology", "infrastructure", OPEN),
        Gate("G-SUPPLY-CHAIN", 35, "SBOM + advisory triage + CI SHA-pinning + provenance", "security", OPEN),
        Gate("G-AUDIT-STORE", 36, "Tamper-evident audit store adoption + PII-scrub verification + alerting", "security", OPEN),
        Gate("G-CLIENT-CSP", 37, "R18 token-storage mitigation + strict CSP + comprehension study", "security", OPEN),
        Gate("G-PAYMENTS", 38, "Payment provider DPA/PCI/settlement/refund/tax/currency", "finance", BLOCKED_EXTERNAL),
        Gate("G-ROPA-DPA", 39, "Complete ROPA + signed sub-processor DPAs + DSAR/breach runbooks", "data_controller", OPEN),
        Gate("G-STAGING", 40, "Isolated synthetic staging + gate clearance + six sign-offs", "release_board", OPEN),
    ]


def readiness_summary(register: list[Gate]) -> dict:
    """A fail-closed roll-up: overall readiness is only true when EVERY gate is
    READY (which itself requires a named non-agent signer)."""
    total = len(register)
    ready = sum(1 for g in register if gate_is_ready(g))
    blocked = sum(1 for g in register if g.status == BLOCKED_EXTERNAL)
    open_ = sum(1 for g in register if g.status == OPEN)
    return {
        "total": total,
        "ready": ready,
        "blocked_external": blocked,
        "open": open_,
        "overall_ready": total > 0 and ready == total,
    }


def owners_needed(register: list[Gate]) -> frozenset:
    """The distinct owner roles that must still act (gates not yet READY)."""
    return frozenset(g.owner_role for g in register if not gate_is_ready(g))
