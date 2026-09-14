"""Phase R14 Response readiness board: well-formed gates, agent can never sign a
gate READY, the default register is complete and starts with nothing READY, the
summary is fail-closed, and response_may_activate only when all gates are READY.
"""
from __future__ import annotations

from app import response_readiness as R


def test_wellformed_and_unknown_role():
    assert R.gate_wellformed(R.ResponseGate("G", "R0", "t", "operations", R.OPEN))[0]
    assert not R.gate_wellformed(R.ResponseGate("G", "R0", "t", "wizard", R.OPEN))[0]


def test_ready_requires_named_non_agent_signer():
    assert not R.gate_wellformed(R.ResponseGate("G", "R0", "t", "operations", R.READY))[0]
    assert not R.gate_wellformed(R.ResponseGate("G", "R0", "t", "operations", R.READY, signed_by="agent"))[0]
    assert R.gate_is_ready(R.ResponseGate("G", "R0", "t", "operations", R.READY, signed_by="Ops Owner"))


def test_default_register_complete_and_nothing_ready():
    reg = R.default_register()
    assert len(reg) == 14                # R0..R13
    for g in reg:
        assert R.gate_wellformed(g)[0]
        assert not R.gate_is_ready(g)


def test_summary_fail_closed():
    reg = R.default_register()
    s = R.readiness_summary(reg)
    assert s["total"] == 14 and s["ready"] == 0
    assert s["response_ready"] is False


def test_response_may_activate_only_when_all_ready():
    reg = R.default_register()
    assert not R.response_may_activate(reg)
    all_ready = [R.ResponseGate(g.gate_id, g.phase, g.title, g.owner_role, R.READY, signed_by="Owner")
                 for g in reg]
    assert R.response_may_activate(all_ready)
    # a single not-ready gate blocks
    all_ready[3] = R.ResponseGate(reg[3].gate_id, reg[3].phase, reg[3].title, reg[3].owner_role, R.OPEN)
    assert not R.response_may_activate(all_ready)
