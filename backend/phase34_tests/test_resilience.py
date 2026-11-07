"""Phase 34 resilience & DR: clinical features fail closed when a dependency is
down (informational degrades), idempotent-only bounded retries with backoff,
bounded timeouts, a circuit breaker (open→half-open→closed/open), fail-closed
readiness, and DR-plan governance.
"""
from __future__ import annotations

import pytest

from app import resilience as R


# ── Safe degradation ─────────────────────────────────────────────────────────

def test_clinical_feature_fails_closed_when_dependency_down():
    assert R.degraded_response("triage", dependency_down=True) == ("fail_closed", False)
    assert R.clinical_fails_closed("prescribing", True)
    assert not R.clinical_fails_closed("prescribing", False)


def test_informational_feature_degrades():
    verdict, allowed = R.degraded_response("faq", dependency_down=True)
    assert verdict == "degraded_notice" and allowed


def test_no_degradation_when_healthy():
    assert R.degraded_response("triage", dependency_down=False) == ("ok", False)


# ── Retry policy ─────────────────────────────────────────────────────────────

def test_only_idempotent_ops_retried():
    assert R.retry_allowed(1, idempotent=True)
    assert not R.retry_allowed(1, idempotent=False)     # charge/send/prescribe not retried


def test_retry_bounded():
    assert R.retry_allowed(R.MAX_RETRIES, idempotent=True)
    assert not R.retry_allowed(R.MAX_RETRIES + 1, idempotent=True)
    assert not R.retry_allowed(0, idempotent=True)


def test_backoff_grows_and_caps():
    assert R.backoff_seconds(1) == 0.5
    assert R.backoff_seconds(2) == 1.0
    assert R.backoff_seconds(50) == 30.0                # capped


# ── Timeouts ─────────────────────────────────────────────────────────────────

def test_timeout_bounds():
    assert R.timeout_ok(30)
    assert not R.timeout_ok(0)
    assert not R.timeout_ok(R.MAX_TIMEOUT_S + 1)


# ── Circuit breaker ──────────────────────────────────────────────────────────

def test_breaker_opens_after_threshold():
    cb = R.CircuitBreaker(threshold=3, cooldown_s=30)
    assert cb.allows(0)
    for _ in range(3):
        cb.record_failure(now_epoch=0)
    assert cb.state == R.OPEN
    assert not cb.allows(10)                            # within cooldown → shed load


def test_breaker_half_opens_then_closes_on_success():
    cb = R.CircuitBreaker(threshold=2, cooldown_s=30)
    cb.record_failure(0); cb.record_failure(0)
    assert cb.state == R.OPEN
    assert cb.allows(40)                                # cooldown passed → half-open probe
    assert cb.state == R.HALF_OPEN
    cb.record_success()
    assert cb.state == R.CLOSED


def test_breaker_reopens_on_probe_failure():
    cb = R.CircuitBreaker(threshold=1, cooldown_s=10)
    cb.record_failure(0)
    assert cb.state == R.OPEN
    assert cb.allows(20)                                # half-open
    cb.record_failure(20)
    assert cb.state == R.OPEN                           # probe failed → reopen
    assert not cb.allows(21)


# ── Readiness ────────────────────────────────────────────────────────────────

def test_readiness_fail_closed():
    assert not R.readiness_ok({})                       # no checks → not ready
    assert not R.readiness_ok({"db": True, "cache": False})
    assert R.readiness_ok({"db": True, "cache": True})


# ── DR plan governance ───────────────────────────────────────────────────────

def test_dr_plan_requires_all():
    ok, reasons = R.dr_plan_ok(R.DRPlan())
    assert not ok and len(reasons) >= 4
    good = R.DRPlan(rpo_seconds=3600, rto_seconds=14400, failover_tested=True,
                    runbook_exists=True, backups_ok=True, multi_zone_or_region=True)
    assert R.dr_plan_ok(good)[0]


def test_untested_failover_fails():
    p = R.DRPlan(rpo_seconds=60, rto_seconds=60, failover_tested=False,
                 runbook_exists=True, backups_ok=True)
    ok, reasons = R.dr_plan_ok(p)
    assert not ok and any("drilled" in r for r in reasons)
