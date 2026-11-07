"""Phase R0 Response activation gate: disabled by default, two distinct human
approvers to arm (agent never), bounded window, fail-closed is_active, and a
single-actor kill-switch. No auto-activation path exists.
"""
from __future__ import annotations

import pytest

from app import response_activation as A

NOW = 1_000_000


def _req(**kw):
    base = dict(approver_a="Dr A", approver_b="Ops B", scope_id="scope-1",
                scope_approved=True, jurisdiction_approved=True,
                window_seconds=3600, requested_at_epoch=NOW)
    base.update(kw)
    return A.ActivationRequest(**base)


def test_disabled_by_default():
    assert not A.is_active(A.DISABLED, NOW)


def test_valid_two_person_activation():
    ok, reasons = A.can_activate(_req())
    assert ok, reasons
    st = A.activate(_req())
    assert A.is_active(st, NOW + 10)


def test_agent_cannot_approve():
    ok, _ = A.can_activate(_req(approver_a="agent"))
    assert not ok
    ok2, _ = A.can_activate(_req(approver_b="automation"))
    assert not ok2


def test_two_approvers_must_be_distinct():
    ok, reasons = A.can_activate(_req(approver_a="Dr A", approver_b="Dr A"))
    assert not ok and any("distinct" in r for r in reasons)


def test_scope_and_jurisdiction_required():
    assert not A.can_activate(_req(scope_approved=False))[0]
    assert not A.can_activate(_req(scope_id=""))[0]
    assert not A.can_activate(_req(jurisdiction_approved=False))[0]


def test_window_bounded():
    assert not A.can_activate(_req(window_seconds=0))[0]
    assert not A.can_activate(_req(window_seconds=A.MAX_ACTIVATION_WINDOW_S + 1))[0]


def test_activate_raises_on_invalid():
    with pytest.raises(A.ResponseActivationError):
        A.activate(_req(approver_a="agent"))


def test_activation_expires():
    st = A.activate(_req(window_seconds=3600))
    assert A.is_active(st, NOW + 100)
    assert not A.is_active(st, NOW + 3600)      # window closed
    assert not A.is_active(st, NOW - 1)         # before start


def test_kill_switch_single_actor():
    st = A.activate(_req())
    assert A.is_active(st, NOW + 10)
    killed = A.kill(st, by="On-call C")
    assert not A.is_active(killed, NOW + 10)
    with pytest.raises(A.ResponseActivationError):
        A.kill(st, by="")


def test_no_auto_activation():
    assert A.auto_activation_possible() is False
