"""KAYA Response — failed-escalation handling & fallback (Phase R4). Domain-pure.

When an escalation cannot reach or be acknowledged by a responder, the system
fails SAFE and LOUD: the reporter is always re-shown the emergency redirect and
boundary notice (never left waiting on a silent promise), the incident is escalated
to a secondary/supervisor tier, and a *boundary event* is recorded. A failed
escalation is a zero-tolerance boundary event (risk register R15) — it is never
absorbed silently.

Composes the Phase 21 emergency guidance and the Phase R3 escalation. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import emergency
from . import response_scope

# A responder must acknowledge within this window or the escalation is failed.
DEFAULT_ACK_DEADLINE_S = 120


def ack_deadline_exceeded(delivered_at_epoch: Optional[int], now_epoch: int,
                          deadline_s: int = DEFAULT_ACK_DEADLINE_S) -> bool:
    """True when a delivered escalation was not acknowledged within the window."""
    if delivered_at_epoch is None:
        return True                       # never delivered → already failed
    return now_epoch - delivered_at_epoch > deadline_s


@dataclass(frozen=True)
class FallbackAction:
    incident_id: str
    reporter_emergency_redirect: str      # always shown to the reporter
    boundary_notice: str
    escalate_to_supervisor: bool
    boundary_event_recorded: bool
    silently_dropped: bool                # MUST always be False


def is_failed_escalation(delivered: bool, acknowledged: bool,
                         delivered_at_epoch: Optional[int], now_epoch: int,
                         deadline_s: int = DEFAULT_ACK_DEADLINE_S) -> bool:
    """A failed escalation = not delivered, or delivered but not acknowledged in
    time, or handed to fallback."""
    if not delivered:
        return True
    if acknowledged:
        return False
    return ack_deadline_exceeded(delivered_at_epoch, now_epoch, deadline_s)


def is_boundary_event(failed: bool) -> bool:
    """A failed escalation is a boundary event (R15 zero-tolerance metric)."""
    return failed


def handle_failure(incident_id: str) -> FallbackAction:
    """The safe-and-loud fallback. Always re-shows the emergency redirect and the
    boundary notice to the reporter, escalates to a supervisor tier, records a
    boundary event, and NEVER drops the incident."""
    return FallbackAction(
        incident_id=incident_id,
        reporter_emergency_redirect=emergency.get_emergency_guidance(None, "pt", ()),
        boundary_notice=response_scope.boundary_notice(),
        escalate_to_supervisor=True,
        boundary_event_recorded=True,
        silently_dropped=False,
    )


def reporter_always_informed(action: FallbackAction) -> bool:
    """Invariant: the reporter is always given emergency guidance on a failure."""
    return bool(action.reporter_emergency_redirect) and not action.silently_dropped
