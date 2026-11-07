"""Phase 23 booking: single-owner capacity, idempotent retries, hold-to-confirm
revalidation, bounded transitions, confirmed-only-after-commit. The PostgreSQL
concurrency proof is a separate BLOCKED_EXTERNAL gate (running Postgres).
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app import booking as B

NOW = datetime(2026, 9, 14, 12, 0, 0)


def _hold(**kw):
    base = dict(hold_id="h1", slot_id="slot-1", owner_id="pat-1", idempotency_key="k1",
                created_at=NOW, quoted_terms={"price": "3500 Kz"})
    base.update(kw)
    return B.Hold(**base)


def _rv(**kw):
    base = dict(credentials_current=True, privilege_granted=True, org_can_operate=True,
                consent_effective=True, service_active=True, age_capacity_ok=True,
                jurisdiction_ok=True)
    base.update(kw)
    return B.ConfirmRevalidation(**base)


# ── Single-owner capacity ────────────────────────────────────────────────────

def test_at_most_one_owner():
    led = B.CapacityLedger()
    led.reserve("slot-1", "pat-1")
    with pytest.raises(B.CapacityConflict):
        led.reserve("slot-1", "pat-2")           # simultaneous second request loses
    led.reserve("slot-1", "pat-1")               # same owner idempotent


def test_release_frees_slot():
    led = B.CapacityLedger()
    led.reserve("slot-1", "pat-1")
    led.release("slot-1", "pat-1")
    led.reserve("slot-1", "pat-2")               # now available
    assert led.owner("slot-1") == "pat-2"


# ── Idempotency ──────────────────────────────────────────────────────────────

def test_idempotent_retry_returns_original_no_duplicate():
    store = B.IdempotencyStore()
    calls = []
    def produce():
        calls.append(1)
        return {"booking_id": "b-1"}
    r1 = store.run("k1", produce)
    r2 = store.run("k1", produce)               # lost-response retry
    assert r1 == r2 == {"booking_id": "b-1"}
    assert len(calls) == 1                       # side effect ran once


# ── Hold-to-confirm revalidation ─────────────────────────────────────────────

def test_confirm_requires_full_revalidation():
    assert B.can_confirm(_hold(), _rv(), NOW)


def test_confirm_denied_on_any_lost_authority():
    for missing in ("credentials_current", "privilege_granted", "org_can_operate",
                    "consent_effective", "service_active", "age_capacity_ok", "jurisdiction_ok"):
        assert not B.can_confirm(_hold(), _rv(**{missing: False}), NOW), missing


def test_confirm_denied_on_expired_hold():
    old = _hold(created_at=NOW - timedelta(minutes=30))
    assert old.expired(NOW)
    assert not B.can_confirm(old, _rv(), NOW)


# ── Transitions & UI ─────────────────────────────────────────────────────────

def test_transitions_bounded():
    assert B.can_transition("hold", "confirmed")
    assert B.can_transition("confirmed", "cancelled")
    assert not B.can_transition("hold", "no_show")       # must confirm first
    assert not B.can_transition("cancelled", "confirmed")  # terminal


def test_ui_not_confirmed_before_commit():
    assert not B.ui_shows_confirmed(transaction_committed=False)
    assert B.ui_shows_confirmed(transaction_committed=True)


def test_reconcile_before_replay():
    assert not B.replay_before_write(external_outcome_known=False)   # do not replay yet
    assert B.replay_before_write(external_outcome_known=True)


def test_conflict_enforcement_is_db_level():
    assert B.CONFLICT_ENFORCEMENT == "database_unique_constraint"
    assert B.POSTGRES_CONCURRENCY_EVIDENCE_REQUIRED is True
