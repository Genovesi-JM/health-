"""Resilience and disaster recovery (Phase 34). Domain-pure.

When a dependency fails, the platform degrades SAFELY: clinical features fail
closed (never a guess), retries touch only idempotent operations, a circuit
breaker sheds load instead of hammering a failing service, and readiness is
fail-closed. Disaster-recovery targets (RPO/RTO), a tested failover, and a
runbook are governance the release board must see; running a real DR drill is
owner-bound.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# ── Safe degradation ─────────────────────────────────────────────────────────

# Feature -> is it clinically load-bearing? Clinical features must fail closed
# when a dependency is down; informational ones may degrade to a notice.
CLINICAL_FEATURES = frozenset({
    "triage", "booking", "prescribing", "teleconsultation", "clinical_notes",
    "messaging", "vitals_ingest", "emergency",
})


def degraded_response(feature: str, dependency_down: bool):
    """Return the safe behavior when a dependency is down.

    Clinical feature → refuse (fail closed): no cached/guessed clinical output.
    Informational feature → allow with a degraded notice.
    """
    if not dependency_down:
        return ("ok", False)
    if feature in CLINICAL_FEATURES:
        return ("fail_closed", False)      # refuse, do not serve a stale clinical answer
    return ("degraded_notice", True)       # informational content may continue


def clinical_fails_closed(feature: str, dependency_down: bool) -> bool:
    return feature in CLINICAL_FEATURES and dependency_down


# ── Retry policy (idempotent-only) ───────────────────────────────────────────

MAX_RETRIES = 3


def retry_allowed(attempt: int, idempotent: bool) -> bool:
    """Only idempotent operations are retried, and only within a bounded count.
    A non-idempotent operation (charge, send, prescribe) is never blindly
    retried — it must reconcile the prior outcome first."""
    if not idempotent:
        return False
    return 1 <= attempt <= MAX_RETRIES


def backoff_seconds(attempt: int, base: float = 0.5, cap: float = 30.0) -> float:
    """Exponential backoff with a cap (deterministic; jitter added by the caller)."""
    if attempt < 1:
        return 0.0
    return min(cap, base * (2 ** (attempt - 1)))


# ── Timeouts ─────────────────────────────────────────────────────────────────

MAX_TIMEOUT_S = 60


def timeout_ok(seconds: float) -> bool:
    """Every outbound call must carry a bounded timeout (no unbounded waits)."""
    return 0 < seconds <= MAX_TIMEOUT_S


# ── Circuit breaker ──────────────────────────────────────────────────────────

CLOSED = "closed"
OPEN = "open"
HALF_OPEN = "half_open"


class CircuitBreaker:
    """Sheds load from a failing dependency. Opens after `threshold` consecutive
    failures; after `cooldown` it half-opens to probe; a probe success closes it,
    a probe failure re-opens it."""

    def __init__(self, threshold: int = 5, cooldown_s: int = 30) -> None:
        self.threshold = threshold
        self.cooldown_s = cooldown_s
        self._failures = 0
        self._state = CLOSED
        self._opened_at: Optional[int] = None

    @property
    def state(self) -> str:
        return self._state

    def allows(self, now_epoch: int) -> bool:
        if self._state == OPEN:
            if self._opened_at is not None and now_epoch - self._opened_at >= self.cooldown_s:
                self._state = HALF_OPEN
                return True                 # allow a single probe
            return False
        return True                         # closed or half-open probe

    def record_success(self) -> None:
        self._failures = 0
        self._state = CLOSED
        self._opened_at = None

    def record_failure(self, now_epoch: int) -> None:
        if self._state == HALF_OPEN:
            self._state = OPEN
            self._opened_at = now_epoch
            return
        self._failures += 1
        if self._failures >= self.threshold:
            self._state = OPEN
            self._opened_at = now_epoch


# ── Readiness (fail-closed) ──────────────────────────────────────────────────

def readiness_ok(checks: dict) -> bool:
    """Ready only when every declared check passes. A missing/unknown check is
    treated as failing (fail-closed), never assumed healthy."""
    if not checks:
        return False
    return all(bool(v) for v in checks.values())


# ── DR plan governance ───────────────────────────────────────────────────────

@dataclass(frozen=True)
class DRPlan:
    rpo_seconds: Optional[int] = None
    rto_seconds: Optional[int] = None
    failover_tested: bool = False        # an actual failover drill was run
    runbook_exists: bool = False
    backups_ok: bool = False             # per db_integrity.backup_policy_ok
    multi_zone_or_region: bool = False


def dr_plan_ok(p: DRPlan) -> tuple[bool, tuple]:
    reasons: list[str] = []
    if p.rpo_seconds is None or p.rto_seconds is None:
        reasons.append("RPO and RTO must be set by a named owner")
    if not p.failover_tested:
        reasons.append("failover must be drilled, not assumed")
    if not p.runbook_exists:
        reasons.append("an incident/DR runbook is required")
    if not p.backups_ok:
        reasons.append("a passing backup policy is required")
    return (not reasons, tuple(reasons))


DR_EVIDENCE_REQUIRED = (
    "failover_drill_result",
    "rpo_rto_targets_approved",
    "incident_runbook_signed",
    "multi_zone_or_region_topology",
)
