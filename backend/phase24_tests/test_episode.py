"""Phase 24 episode: concurrent claim → one owner; scoped queue visibility;
deterministic transitions with actor policy; handoff cannot silently close.
"""
from __future__ import annotations

import pytest

from app import episode as EP


# ── Transitions ──────────────────────────────────────────────────────────────

def test_valid_transition_by_permitted_actor():
    r = EP.can_transition("queued", "claimed", "doctor")
    assert r.ok


def test_impossible_transition_returns_allowed_next():
    r = EP.can_transition("requested", "completed", "doctor")
    assert not r.ok and r.reason == "impossible or stale transition"
    assert "awaiting_review" in r.allowed_next or "triage_incomplete" in r.allowed_next


def test_wrong_actor_denied():
    r = EP.can_transition("queued", "claimed", "patient")
    assert not r.ok and "not permitted" in r.reason


# ── Atomic claim ─────────────────────────────────────────────────────────────

def test_concurrent_claim_one_owner():
    led = EP.ClaimLedger()
    led.claim("ep-1", "doc-1")
    with pytest.raises(EP.ClaimConflict):
        led.claim("ep-1", "doc-2")            # loser
    assert led.owner("ep-1") == "doc-1"


def test_reassign_requires_supervisor():
    led = EP.ClaimLedger()
    led.claim("ep-1", "doc-1")
    with pytest.raises(EP.ClaimConflict):
        led.reassign("ep-1", "doc-2", by_supervisor=False)
    led.reassign("ep-1", "doc-2", by_supervisor=True)
    assert led.owner("ep-1") == "doc-2"


def test_abandoned_claim_released():
    led = EP.ClaimLedger()
    led.claim("ep-1", "doc-1")
    led.release_abandoned("ep-1")
    led.claim("ep-1", "doc-2")
    assert led.owner("ep-1") == "doc-2"


# ── Queue visibility ─────────────────────────────────────────────────────────

def _ctx(**kw):
    base = dict(org_ids=frozenset({"org-1"}), facility_ids=frozenset({"fac-1"}),
                services=frozenset({"primary_care"}), on_shift=True, profession="doctor",
                privileges=frozenset({"clinical_read"}), assigned_episode_ids=frozenset({"ep-1"}))
    base.update(kw)
    return EP.ClinicianQueueContext(**base)


def _ep(**kw):
    base = dict(episode_id="ep-1", org_id="org-1", facility_id="fac-1", service="primary_care")
    base.update(kw)
    return EP.EpisodeRef(**base)


def test_in_scope_episode_visible():
    assert EP.queue_visible(_ep(), _ctx())


def test_cross_org_episode_not_visible():
    assert not EP.queue_visible(_ep(org_id="org-2"), _ctx())


def test_off_shift_sees_nothing():
    assert not EP.queue_visible(_ep(), _ctx(on_shift=False))


def test_wrong_service_not_visible():
    assert not EP.queue_visible(_ep(service="cardiology"), _ctx())


def test_no_browsing_without_privilege():
    assert not EP.queue_visible(_ep(), _ctx(privileges=frozenset()))


def test_after_handoff_only_assigned():
    assert EP.can_view_after_handoff("ep-1", _ctx())
    assert not EP.can_view_after_handoff("ep-9", _ctx())
    assert not EP.can_view_after_handoff("ep-1", _ctx(on_shift=False))


# ── Handoff ──────────────────────────────────────────────────────────────────

def _handoff(**kw):
    base = dict(from_clinician="nurse-1", to_clinician="doc-1", summary="scoped",
                acknowledged=True, unresolved_tasks=(), escalation_open=False)
    base.update(kw)
    return EP.Handoff(**base)


def test_clean_handoff_can_close():
    assert EP.handoff_can_close_episode(_handoff())


def test_unacknowledged_handoff_cannot_close():
    assert not EP.handoff_can_close_episode(_handoff(acknowledged=False))


def test_unresolved_tasks_block_close():
    assert not EP.handoff_can_close_episode(_handoff(unresolved_tasks=("review labs",)))


def test_open_escalation_blocks_close_and_stays_visible():
    assert not EP.handoff_can_close_episode(_handoff(escalation_open=True))
    assert EP.escalation_visible(True)
