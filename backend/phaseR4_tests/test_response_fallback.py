"""Phase R4 Response fallback: ack-deadline detection, failed-escalation
classification, a failed escalation is a boundary event, and the safe-and-loud
fallback always informs the reporter and never drops the incident.
"""
from __future__ import annotations

from app import response_fallback as F

NOW = 10_000


def test_ack_deadline_exceeded():
    assert not F.ack_deadline_exceeded(NOW - 10, NOW)          # within window
    assert F.ack_deadline_exceeded(NOW - 999, NOW)            # past window
    assert F.ack_deadline_exceeded(None, NOW)                 # never delivered


def test_failed_escalation_classification():
    # not delivered → failed
    assert F.is_failed_escalation(delivered=False, acknowledged=False,
                                  delivered_at_epoch=None, now_epoch=NOW)
    # delivered + acknowledged → not failed
    assert not F.is_failed_escalation(delivered=True, acknowledged=True,
                                      delivered_at_epoch=NOW - 5, now_epoch=NOW)
    # delivered, not acked, past deadline → failed
    assert F.is_failed_escalation(delivered=True, acknowledged=False,
                                  delivered_at_epoch=NOW - 999, now_epoch=NOW)
    # delivered, not acked, within deadline → not failed yet
    assert not F.is_failed_escalation(delivered=True, acknowledged=False,
                                      delivered_at_epoch=NOW - 5, now_epoch=NOW)


def test_failed_escalation_is_boundary_event():
    assert F.is_boundary_event(True)
    assert not F.is_boundary_event(False)


def test_fallback_is_safe_and_loud():
    a = F.handle_failure("inc-1")
    assert a.reporter_emergency_redirect                      # reporter always informed
    assert a.boundary_notice
    assert a.escalate_to_supervisor
    assert a.boundary_event_recorded
    assert a.silently_dropped is False


def test_reporter_always_informed_invariant():
    assert F.reporter_always_informed(F.handle_failure("inc-2"))
