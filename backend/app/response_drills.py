"""KAYA Response — drills & readiness evidence (Phase R11). Domain-pure.

Response may not be considered ready without drilled evidence: a minimum number of
recent drills covering the required failure scenarios, every one signed by a named
owner, and — the hard gate — ZERO boundary events across them (risk register R15
is zero-tolerance for failed-escalation/boundary events). Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Failure scenarios every drill programme must exercise.
REQUIRED_SCENARIOS = frozenset({
    "no_responder_available",
    "acknowledgement_timeout",
    "coverage_gap",
    "out_of_area_report",
    "provider_or_channel_down",
})

MIN_DRILLS = len(REQUIRED_SCENARIOS)
DRILL_RECENCY_S = 90 * 24 * 3600         # drills must be within ~90 days


@dataclass(frozen=True)
class DrillRecord:
    scenario: str
    ran_at_epoch: int
    passed: bool
    boundary_events: int
    signed_off_by: Optional[str] = None


def drill_valid(d: DrillRecord) -> bool:
    return (
        d.scenario in REQUIRED_SCENARIOS
        and bool(d.signed_off_by)
        and d.boundary_events >= 0
    )


def scenarios_covered(records: list[DrillRecord]) -> frozenset:
    return frozenset(d.scenario for d in records if drill_valid(d))


def total_boundary_events(records: list[DrillRecord]) -> int:
    return sum(d.boundary_events for d in records)


def drills_ready(records: list[DrillRecord], now_epoch: int) -> tuple[bool, tuple]:
    """Fail-closed readiness. Requires: enough valid drills, all required scenarios
    covered, all recent, every drill passed, and ZERO boundary events total."""
    reasons: list[str] = []
    valid = [d for d in records if drill_valid(d)]
    if len(valid) < MIN_DRILLS:
        reasons.append(f"need at least {MIN_DRILLS} valid drills")

    missing = REQUIRED_SCENARIOS - scenarios_covered(records)
    if missing:
        reasons.append(f"missing scenarios: {sorted(missing)}")

    stale = [d for d in valid if now_epoch - d.ran_at_epoch > DRILL_RECENCY_S]
    if stale:
        reasons.append("some drills are stale (outside recency window)")

    if any(not d.passed for d in valid):
        reasons.append("a drill did not pass")

    be = total_boundary_events(records)
    if be > 0:
        reasons.append(f"boundary events must be zero (found {be})")

    return (not reasons, tuple(reasons))
