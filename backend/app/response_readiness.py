"""KAYA Response — readiness board & final gate (Phase R14). Domain-pure.

The consolidated register of every Response-track gate (R0–R13), each mapped to an
accountable owner role and a fail-closed status. Response is READY only when every
gate is signed READY by a named non-agent owner; otherwise it stays DISABLED. The
agent enumerates and enforces; it never marks a gate READY and never activates
Response. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

OPEN = "OPEN"
BLOCKED_EXTERNAL = "BLOCKED_EXTERNAL"
READY = "READY"

AGENT_IDENTITIES = frozenset({"agent", "engineering_preparer", "claude", "automation"})

OWNER_ROLES = frozenset({
    "clinical_safety", "operations", "privacy", "security", "legal",
    "data_controller", "release_board", "accessibility",
})


@dataclass(frozen=True)
class ResponseGate:
    gate_id: str
    phase: str
    title: str
    owner_role: str
    status: str = OPEN
    signed_by: Optional[str] = None


def gate_wellformed(g: ResponseGate) -> tuple[bool, tuple]:
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
            reasons.append("the agent may not sign a Response gate READY")
    return (not reasons, tuple(reasons))


def gate_is_ready(g: ResponseGate) -> bool:
    ok, _ = gate_wellformed(g)
    return ok and g.status == READY


def default_register() -> list[ResponseGate]:
    """Every Response-track gate. All start OPEN — none is READY."""
    return [
        ResponseGate("R0-ACTIVATION", "R0", "Two-person activation gate & kill-switch signed procedure", "release_board", OPEN),
        ResponseGate("R1-SCOPE", "R1", "Signed Response scope with permanent exclusions", "clinical_safety", OPEN),
        ResponseGate("R2-INTAKE", "R2", "Incident intake red-flag list validated/localized", "clinical_safety", OPEN),
        ResponseGate("R3-ROUTING", "R3", "Escalation routing to authorized humans operational", "operations", OPEN),
        ResponseGate("R4-FALLBACK", "R4", "Failed-escalation fallback with supervisor tier", "operations", OPEN),
        ResponseGate("R5-ROSTER", "R5", "Signed on-call roster with gap-free coverage", "operations", OPEN),
        ResponseGate("R6-COMMS", "R6", "Response communication copy reviewed/localized", "clinical_safety", OPEN),
        ResponseGate("R7-GEOGRAPHY", "R7", "Signed coverage map + location-confirmation UX", "operations", OPEN),
        ResponseGate("R8-SLA", "R8", "Signed internal SLA targets (never promised)", "operations", OPEN),
        ResponseGate("R9-AUDIT", "R9", "Tamper-evident incident audit store + retention", "security", OPEN),
        ResponseGate("R10-CONSENT", "R10", "Signed Response ROPA + specific consent document", "data_controller", OPEN),
        ResponseGate("R11-DRILLS", "R11", "Failed-escalation drills passed with zero boundary events", "operations", OPEN),
        ResponseGate("R12-METRICS", "R12", "Zero-boundary-event evidence + R16 comprehension study", "accessibility", OPEN),
        ResponseGate("R13-CEREMONY", "R13", "Two-person activation ceremony run with all gates green", "release_board", OPEN),
    ]


def readiness_summary(register: list[ResponseGate]) -> dict:
    total = len(register)
    ready = sum(1 for g in register if gate_is_ready(g))
    return {
        "total": total,
        "ready": ready,
        "open": sum(1 for g in register if g.status == OPEN),
        "blocked_external": sum(1 for g in register if g.status == BLOCKED_EXTERNAL),
        "response_ready": total > 0 and ready == total,
    }


def response_may_activate(register: list[ResponseGate]) -> bool:
    """Fail-closed final gate: Response may be considered for activation only when
    every gate is READY. Even then, activation still requires the live Phase R13
    two-person ceremony — this board is necessary, not sufficient."""
    return readiness_summary(register)["response_ready"]
