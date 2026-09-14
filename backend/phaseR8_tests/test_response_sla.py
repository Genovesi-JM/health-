"""Phase R8 Response SLA: targets are internal (never a promise), unapproved/unset
targets can't operate, reporter messages make no time promise, and breach/within
detection is internal governance only.
"""
from __future__ import annotations

from app import response_sla as SLA


def _targets(**kw):
    base = dict(ack_target_s=120, resolution_target_s=1800, signed_off_by="Ops Owner")
    base.update(kw)
    return SLA.SLATargets(**base)


def test_targets_require_signature_and_values():
    assert SLA.targets_approved(_targets())
    assert not SLA.targets_approved(_targets(signed_off_by=None))
    assert not SLA.targets_approved(_targets(ack_target_s=None))
    assert not SLA.targets_approved(_targets(resolution_target_s=0))


def test_sla_is_never_a_promise():
    assert SLA.sla_target_is_a_promise() is False


def test_reporter_message_makes_no_time_promise():
    assert SLA.reporter_message_makes_no_time_promise("A clinician will review your message.")
    assert not SLA.reporter_message_makes_no_time_promise("A clinician will respond in 5 minutes.")


def test_ack_within_target():
    t = _targets(ack_target_s=120)
    on_time = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=1100, resolved_at_epoch=None)
    late = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=1300, resolved_at_epoch=None)
    pending = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=None, resolved_at_epoch=None)
    assert SLA.ack_within_target(on_time, t) is True
    assert SLA.ack_within_target(late, t) is False
    assert SLA.ack_within_target(pending, t) is None


def test_resolution_within_target():
    t = _targets(resolution_target_s=1800)
    resolved = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=1050, resolved_at_epoch=2500)
    assert SLA.resolution_within_target(resolved, t) is True
    late = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=1050, resolved_at_epoch=5000)
    assert SLA.resolution_within_target(late, t) is False


def test_breach_detection_internal():
    t = _targets(ack_target_s=120)
    pending = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=None, resolved_at_epoch=None)
    assert not SLA.is_breach(pending, t, now_epoch=1100)     # still within window
    assert SLA.is_breach(pending, t, now_epoch=1300)         # overdue
    late_ack = SLA.Timing(delivered_at_epoch=1000, acknowledged_at_epoch=1300, resolved_at_epoch=None)
    assert SLA.is_breach(late_ack, t, now_epoch=1400)        # acked late
