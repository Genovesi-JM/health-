"""Phase 41 pilot readiness board: well-formed gates, the agent can never sign a
gate READY, the default register is complete and starts with nothing READY, and
the fail-closed roll-up reports overall NOT ready until every gate is signed.
"""
from __future__ import annotations

from app import pilot_readiness as R


def test_wellformed_gate():
    ok, reasons = R.gate_wellformed(R.Gate("G1", 5, "thing", "security", R.OPEN))
    assert ok, reasons


def test_unknown_owner_role_rejected():
    ok, _ = R.gate_wellformed(R.Gate("G1", 5, "thing", "wizard", R.OPEN))
    assert not ok


def test_ready_requires_named_non_agent_signer():
    ok, reasons = R.gate_wellformed(R.Gate("G1", 5, "t", "security", R.READY, signed_by=None))
    assert not ok and any("named signer" in r for r in reasons)
    ok2, reasons2 = R.gate_wellformed(R.Gate("G1", 5, "t", "security", R.READY, signed_by="agent"))
    assert not ok2 and any("may not sign" in r for r in reasons2)
    ok3, _ = R.gate_wellformed(R.Gate("G1", 5, "t", "security", R.READY, signed_by="Security Lead"))
    assert ok3
    assert R.gate_is_ready(R.Gate("G1", 5, "t", "security", R.READY, signed_by="Security Lead"))


def test_default_register_complete_and_nothing_ready():
    reg = R.default_register()
    assert len(reg) >= 15
    for g in reg:
        ok, reasons = R.gate_wellformed(g)
        assert ok, (g.gate_id, reasons)
        assert not R.gate_is_ready(g)          # nothing pre-cleared


def test_summary_fail_closed():
    reg = R.default_register()
    s = R.readiness_summary(reg)
    assert s["total"] == len(reg)
    assert s["ready"] == 0
    assert s["overall_ready"] is False
    assert s["blocked_external"] >= 1


def test_overall_ready_only_when_all_signed():
    reg = [R.Gate("A", 1, "a", "security", R.READY, signed_by="S"),
           R.Gate("B", 2, "b", "legal", R.READY, signed_by="L")]
    assert R.readiness_summary(reg)["overall_ready"] is True
    reg[1] = R.Gate("B", 2, "b", "legal", R.OPEN)
    assert R.readiness_summary(reg)["overall_ready"] is False


def test_owners_needed_lists_roles():
    reg = R.default_register()
    owners = R.owners_needed(reg)
    assert "clinical_safety" in owners and "privacy" in owners and "finance" in owners
