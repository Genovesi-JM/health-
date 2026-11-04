"""KAYA Response — activation gate & kill-switch (Phase R0). Domain-pure.

The KAYA Response subsystem (any emergency-adjacent capability) is DISABLED by
default and stays disabled unless a two-person activation ceremony arms it for a
bounded window against an approved scope. Arming is hard and symmetric-unsafe:
it takes two distinct named humans, neither of them the agent; deactivation
(kill-switch) is easy and takes a single authorized human, immediately. No flag,
config value, or code path can activate Response on its own, and it never
auto-activates.

This module is stdlib-only and importable without the app. It ships NO emergency
dispatch, hospital contact, or auto-escalation — only the enforced gate.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

AGENT_IDENTITIES = frozenset({"agent", "engineering_preparer", "claude", "automation"})

# The longest an activation may last before it must be re-armed (a dead-man
# window so a forgotten activation cannot linger). 12 hours.
MAX_ACTIVATION_WINDOW_S = 12 * 3600


class ResponseActivationError(Exception):
    """An activation rule was violated (fail-closed)."""


@dataclass(frozen=True)
class ActivationRequest:
    approver_a: str                 # first named human
    approver_b: str                 # second, distinct named human
    scope_id: str                   # a signed Response scope (jurisdiction/clinic/window)
    scope_approved: bool            # the scope itself is approved evidence
    jurisdiction_approved: bool     # the operating jurisdiction is approved
    window_seconds: int             # requested activation window
    requested_at_epoch: int


def _is_human(name: Optional[str]) -> bool:
    return bool(name) and name.strip().lower() not in AGENT_IDENTITIES


def can_activate(req: ActivationRequest) -> tuple[bool, tuple]:
    """Fail-closed: two distinct human approvers, an approved signed scope, an
    approved jurisdiction, and a bounded window. The agent can never be an
    approver."""
    reasons: list[str] = []
    if not _is_human(req.approver_a) or not _is_human(req.approver_b):
        reasons.append("two named human approvers required (agent may not approve)")
    if _is_human(req.approver_a) and _is_human(req.approver_b) and \
            req.approver_a.strip().lower() == req.approver_b.strip().lower():
        reasons.append("the two approvers must be distinct people")
    if not req.scope_id or not req.scope_approved:
        reasons.append("an approved, signed Response scope is required")
    if not req.jurisdiction_approved:
        reasons.append("the operating jurisdiction is not approved")
    if req.window_seconds <= 0 or req.window_seconds > MAX_ACTIVATION_WINDOW_S:
        reasons.append("activation window out of bounds")
    return (not reasons, tuple(reasons))


@dataclass(frozen=True)
class ActivationState:
    active: bool = False
    scope_id: Optional[str] = None
    activated_by: tuple = ()
    activated_at_epoch: int = 0
    expires_at_epoch: int = 0
    killed: bool = False


DISABLED = ActivationState()        # the default: Response is OFF


def activate(req: ActivationRequest) -> ActivationState:
    """Produce an active state ONLY for a valid two-person request; raise
    otherwise. Never called implicitly — activation is an explicit ceremony."""
    ok, reasons = can_activate(req)
    if not ok:
        raise ResponseActivationError("; ".join(reasons))
    return ActivationState(
        active=True, scope_id=req.scope_id,
        activated_by=(req.approver_a, req.approver_b),
        activated_at_epoch=req.requested_at_epoch,
        expires_at_epoch=req.requested_at_epoch + req.window_seconds,
    )


def is_active(state: ActivationState, now_epoch: int) -> bool:
    """Response is active only while armed, un-killed, and within the window.
    Anything ambiguous → inactive (fail-closed)."""
    if not state.active or state.killed:
        return False
    return state.activated_at_epoch <= now_epoch < state.expires_at_epoch


def kill(state: ActivationState, by: str) -> ActivationState:
    """Kill-switch: a single authorized human deactivates immediately. Easy off is
    the safe direction; even the agent's caller may trip it, but the record names
    who."""
    from dataclasses import replace
    if not by or not by.strip():
        raise ResponseActivationError("kill-switch requires a named actor")
    return replace(state, active=False, killed=True)


def auto_activation_possible() -> bool:
    """There is NO automatic activation path. Always False."""
    return False
