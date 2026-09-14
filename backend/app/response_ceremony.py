"""KAYA Response — activation two-person ceremony & governance (Phase R13).
Domain-pure.

The single choke point that can arm Response. A ceremony proceeds only when EVERY
R-track readiness gate is green AND two distinct, non-agent humans in different
governance roles jointly approve. It composes the Phase R0 activation gate — so a
ceremony's success still produces only a bounded, killable activation. The agent
can never be an approver and can never run the ceremony on its own. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import response_activation

AGENT_IDENTITIES = response_activation.AGENT_IDENTITIES


@dataclass(frozen=True)
class ReadinessGates:
    """Each flag is the signed-off readiness of one R-track concern. All must be
    True — defaults are the safe (not-ready) value."""
    scope_signed: bool = False           # R1
    intake_ready: bool = False           # R2
    routing_ready: bool = False          # R3
    fallback_ready: bool = False         # R4
    roster_coverage_ok: bool = False     # R5
    comms_reviewed: bool = False         # R6
    coverage_map_signed: bool = False    # R7
    sla_targets_signed: bool = False     # R8
    audit_ready: bool = False            # R9
    consent_rop_ready: bool = False      # R10
    drills_ready: bool = False           # R11
    zero_boundary_and_comprehension: bool = False  # R12


def gates_all_green(g: ReadinessGates) -> tuple[bool, tuple]:
    missing = tuple(name for name, val in g.__dict__.items() if not val)
    return (not missing, missing)


@dataclass(frozen=True)
class Approver:
    name: str
    governance_role: str                 # e.g. "clinical_safety", "operations"


def approver_valid(a: Approver) -> bool:
    return bool(a.name) and a.name.strip().lower() not in AGENT_IDENTITIES and bool(a.governance_role)


@dataclass(frozen=True)
class CeremonyRequest:
    approver_a: Approver
    approver_b: Approver
    gates: ReadinessGates
    scope_id: str
    scope_approved: bool
    jurisdiction_approved: bool
    window_seconds: int
    at_epoch: int


def ceremony_ok(req: CeremonyRequest) -> tuple[bool, tuple]:
    """Fail-closed: two valid, distinct, different-role human approvers AND all
    readiness gates green AND the Phase R0 activation preconditions."""
    reasons: list[str] = []

    if not approver_valid(req.approver_a) or not approver_valid(req.approver_b):
        reasons.append("two valid non-agent human approvers required")
    else:
        if req.approver_a.name.strip().lower() == req.approver_b.name.strip().lower():
            reasons.append("the two approvers must be distinct people")
        if req.approver_a.governance_role == req.approver_b.governance_role:
            reasons.append("approvers must hold different governance roles (separation of duties)")

    ok_gates, missing = gates_all_green(req.gates)
    if not ok_gates:
        reasons.append(f"readiness gates not green: {list(missing)}")

    # Compose the R0 activation preconditions.
    r0 = response_activation.ActivationRequest(
        approver_a=req.approver_a.name, approver_b=req.approver_b.name,
        scope_id=req.scope_id, scope_approved=req.scope_approved,
        jurisdiction_approved=req.jurisdiction_approved,
        window_seconds=req.window_seconds, requested_at_epoch=req.at_epoch,
    )
    r0_ok, r0_reasons = response_activation.can_activate(r0)
    if not r0_ok:
        reasons.extend(r0_reasons)

    return (not reasons, tuple(reasons))


def run_ceremony(req: CeremonyRequest) -> response_activation.ActivationState:
    """Arm Response ONLY when the ceremony is fully valid; otherwise raise. Returns
    a bounded, killable Phase R0 activation state."""
    ok, reasons = ceremony_ok(req)
    if not ok:
        raise response_activation.ResponseActivationError("; ".join(reasons))
    r0 = response_activation.ActivationRequest(
        approver_a=req.approver_a.name, approver_b=req.approver_b.name,
        scope_id=req.scope_id, scope_approved=req.scope_approved,
        jurisdiction_approved=req.jurisdiction_approved,
        window_seconds=req.window_seconds, requested_at_epoch=req.at_epoch,
    )
    return response_activation.activate(r0)
