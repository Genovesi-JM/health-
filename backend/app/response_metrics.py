"""KAYA Response — metrics & zero-boundary-event gate (Phase R12). Domain-pure.

PHI-free operational metrics with a hard gate: ANY boundary event in the live
window trips the gate (risk register R15 zero-tolerance). Comprehension of the
non-emergency boundary must meet an aggregate threshold, and no individual is
admitted after a failed critical comprehension check (R16). Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# R16: aggregate comprehension target and the no-individual-admission rule.
COMPREHENSION_AGGREGATE_TARGET = 0.90
MIN_COMPREHENSION_SAMPLE = 10


@dataclass(frozen=True)
class OperationalMetrics:
    total_incidents: int
    acknowledged: int
    resolved: int
    boundary_events: int
    failed_escalations: int


def ack_rate(m: OperationalMetrics) -> Optional[float]:
    return None if m.total_incidents == 0 else m.acknowledged / m.total_incidents


def resolution_rate(m: OperationalMetrics) -> Optional[float]:
    return None if m.total_incidents == 0 else m.resolved / m.total_incidents


def zero_boundary_gate(m: OperationalMetrics) -> bool:
    """True (gate holds / OK) only when there are zero boundary events AND zero
    failed escalations in the window."""
    return m.boundary_events == 0 and m.failed_escalations == 0


def gate_tripped(m: OperationalMetrics) -> bool:
    return not zero_boundary_gate(m)


# ── Comprehension (R16) ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class ComprehensionStudy:
    sample_size: int
    passed: int                          # people who passed all critical checks
    any_individual_failed_critical: bool # a single failed critical check flag


def comprehension_ready(study: ComprehensionStudy) -> tuple[bool, tuple]:
    """Fail-closed: an adequate sample, an aggregate pass rate at/above target, and
    no admission of an individual who failed a critical check."""
    reasons: list[str] = []
    if study.sample_size < MIN_COMPREHENSION_SAMPLE:
        reasons.append(f"comprehension sample must be at least {MIN_COMPREHENSION_SAMPLE}")
    rate = 0.0 if study.sample_size == 0 else study.passed / study.sample_size
    if rate < COMPREHENSION_AGGREGATE_TARGET:
        reasons.append(f"aggregate comprehension {rate:.2f} below target {COMPREHENSION_AGGREGATE_TARGET}")
    if study.any_individual_failed_critical:
        reasons.append("no individual may be admitted after a failed critical check")
    return (not reasons, tuple(reasons))


def metrics_are_phi_free(field_names: frozenset) -> bool:
    """Operational metrics are aggregate counts only — no per-person identifiers."""
    forbidden = {"reporter_id", "patient_id", "name", "phone", "email", "address"}
    return not (field_names & forbidden)
