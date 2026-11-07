"""Phase R3 Response routing: eligibility gating, human-in-the-loop acknowledgement
(delivery != ack), fail-closed fallback when no responder, no auto-dispatch, and
escalation stays open until acknowledged/fallback-owned.
"""
from __future__ import annotations

import pytest

from app import response_routing as R


def _resp(**kw):
    base = dict(responder_id="doc-1", profession="doctor", on_shift=True,
                jurisdictions=frozenset({"AO-LUANDA"}), credentials_current=True)
    base.update(kw)
    return R.Responder(**base)


def test_eligibility_rules():
    assert R.responder_eligible(_resp(), "AO-LUANDA")
    assert not R.responder_eligible(_resp(on_shift=False), "AO-LUANDA")
    assert not R.responder_eligible(_resp(credentials_current=False), "AO-LUANDA")
    assert not R.responder_eligible(_resp(profession="patient"), "AO-LUANDA")
    assert not R.responder_eligible(_resp(), "AO-HUAMBO")     # wrong jurisdiction


def test_route_to_eligible_responder():
    esc = R.route("inc-1", "AO-LUANDA", [_resp()])
    assert esc.delivered and esc.assigned_to == "doc-1"
    assert not esc.acknowledged and not esc.to_fallback


def test_delivery_is_not_acknowledgement():
    esc = R.route("inc-1", "AO-LUANDA", [_resp()])
    assert R.escalation_open(esc)                 # still open until ack
    ack = R.acknowledge(esc, "doc-1")
    assert ack.acknowledged and not R.escalation_open(ack)


def test_only_assigned_may_acknowledge():
    esc = R.route("inc-1", "AO-LUANDA", [_resp()])
    with pytest.raises(R.RoutingError):
        R.acknowledge(esc, "doc-9")


def test_no_responder_fails_closed_to_fallback():
    esc = R.route("inc-1", "AO-LUANDA", [_resp(on_shift=False)])
    assert not esc.delivered and esc.assigned_to is None
    assert esc.to_fallback and R.escalation_open(esc)     # not silently dropped


def test_no_auto_dispatch():
    assert R.auto_dispatch_possible() is False


def test_picks_first_eligible_only():
    unfit = _resp(responder_id="x", credentials_current=False)
    fit = _resp(responder_id="doc-2")
    esc = R.route("inc-1", "AO-LUANDA", [unfit, fit])
    assert esc.assigned_to == "doc-2"
