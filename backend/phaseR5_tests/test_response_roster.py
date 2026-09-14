"""Phase R5 Response roster: authority holds only within a signed shift with
current credentials + Response privilege + jurisdiction, coverage requires no gap
(fails closed), gaps are reported, and a substitute is the next eligible responder.
"""
from __future__ import annotations

from app import response_roster as R

T0 = 1_000_000
HOUR = 3600


def _slot(**kw):
    base = dict(responder_id="doc-1", profession="doctor", jurisdiction="AO-LUANDA",
                start_epoch=T0, end_epoch=T0 + 4 * HOUR, credentials_current=True,
                response_privileged=True, revoked=False)
    base.update(kw)
    return R.OnCallSlot(**base)


def _roster(slots, **kw):
    base = dict(roster_id="ros-1", jurisdiction="AO-LUANDA", slots=tuple(slots),
                signed_off_by="Ops Owner")
    base.update(kw)
    return R.Roster(**base)


def test_authority_rules():
    s = _slot()
    assert R.responder_authorized(s, T0 + HOUR, "AO-LUANDA")
    assert not R.responder_authorized(s, T0 + 5 * HOUR, "AO-LUANDA")     # outside shift
    assert not R.responder_authorized(_slot(credentials_current=False), T0 + HOUR, "AO-LUANDA")
    assert not R.responder_authorized(_slot(response_privileged=False), T0 + HOUR, "AO-LUANDA")
    assert not R.responder_authorized(_slot(revoked=True), T0 + HOUR, "AO-LUANDA")
    assert not R.responder_authorized(s, T0 + HOUR, "AO-HUAMBO")         # wrong jurisdiction


def test_unsigned_roster_has_no_coverage():
    ros = _roster([_slot()], signed_off_by=None)
    assert not R.coverage_ok(ros, T0, T0 + HOUR)


def test_full_coverage_ok():
    ros = _roster([_slot()])
    assert R.coverage_ok(ros, T0, T0 + 4 * HOUR)


def test_coverage_gap_fails_closed():
    # slot only covers the first 2 hours; window is 4 → gap
    ros = _roster([_slot(end_epoch=T0 + 2 * HOUR)])
    assert not R.coverage_ok(ros, T0, T0 + 4 * HOUR)
    gaps = R.coverage_gaps(ros, T0, T0 + 4 * HOUR)
    assert gaps and all(g >= T0 + 2 * HOUR for g in gaps)


def test_overlapping_slots_close_the_gap():
    a = _slot(responder_id="doc-1", end_epoch=T0 + 2 * HOUR)
    b = _slot(responder_id="doc-2", start_epoch=T0 + 2 * HOUR, end_epoch=T0 + 4 * HOUR)
    ros = _roster([a, b])
    assert R.coverage_ok(ros, T0, T0 + 4 * HOUR)


def test_substitute_is_next_eligible():
    a = _slot(responder_id="doc-1")
    b = _slot(responder_id="doc-2")
    ros = _roster([a, b])
    assert R.substitute_available(ros, T0 + HOUR, primary_id="doc-1") == "doc-2"
    solo = _roster([a])
    assert R.substitute_available(solo, T0 + HOUR, primary_id="doc-1") is None
