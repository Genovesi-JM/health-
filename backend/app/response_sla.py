"""KAYA Response — SLA & timing governance (Phase R8). Domain-pure.

Response timing targets are INTERNAL governance thresholds, not promises. They are
measured to review performance and to flag breaches for a named owner; they are
never surfaced to a reporter as an ETA or guarantee. Targets are hypotheses until
a named owner signs them, and Response may not operate against unsigned targets.

Composes the Phase 21 no-promise guard. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import emergency


@dataclass(frozen=True)
class SLATargets:
    ack_target_s: Optional[int]           # internal: time to human acknowledgement
    resolution_target_s: Optional[int]    # internal: time to disposition
    signed_off_by: Optional[str] = None   # a named human


def targets_approved(t: SLATargets) -> bool:
    """Targets are only usable once a named owner signs them and they are set."""
    return (
        bool(t.signed_off_by)
        and t.ack_target_s is not None and t.ack_target_s > 0
        and t.resolution_target_s is not None and t.resolution_target_s > 0
    )


def sla_target_is_a_promise() -> bool:
    """A timing target is NEVER a promise to the reporter. Always False."""
    return False


def reporter_message_makes_no_time_promise(body: str) -> bool:
    """A reporter-facing message must contain no ETA/wait promise (Phase 21 guard)."""
    return emergency.claims_no_external_action(body)


# ── Internal measurement (governance only) ───────────────────────────────────

@dataclass(frozen=True)
class Timing:
    delivered_at_epoch: int
    acknowledged_at_epoch: Optional[int]
    resolved_at_epoch: Optional[int]


def ack_within_target(timing: Timing, t: SLATargets) -> Optional[bool]:
    """None when not yet acknowledged; else whether ack was within the internal
    target."""
    if timing.acknowledged_at_epoch is None:
        return None
    return (timing.acknowledged_at_epoch - timing.delivered_at_epoch) <= (t.ack_target_s or 0)


def resolution_within_target(timing: Timing, t: SLATargets) -> Optional[bool]:
    if timing.resolved_at_epoch is None:
        return None
    return (timing.resolved_at_epoch - timing.delivered_at_epoch) <= (t.resolution_target_s or 0)


def is_breach(timing: Timing, t: SLATargets, now_epoch: int) -> bool:
    """An internal breach: acknowledgement is overdue (or was late). A breach is a
    governance signal for a named owner, not a reporter-facing event."""
    if timing.acknowledged_at_epoch is None:
        return (now_epoch - timing.delivered_at_epoch) > (t.ack_target_s or 0)
    return (timing.acknowledged_at_epoch - timing.delivered_at_epoch) > (t.ack_target_s or 0)
