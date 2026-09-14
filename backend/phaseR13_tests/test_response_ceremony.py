"""Phase R13 Response activation ceremony: proceeds only with all gates green and
two distinct non-agent human approvers in different roles; composes the R0
activation preconditions; agent can never approve; running the ceremony yields a
bounded killable activation.
"""
from __future__ import annotations

import pytest

from app import response_ceremony as C
from app import response_activation as A

NOW = 1_000_000


def _all_green():
    return C.ReadinessGates(**{k: True for k in C.ReadinessGates().__dict__})


def _req(**kw):
    base = dict(
        approver_a=C.Approver("Dr A", "clinical_safety"),
        approver_b=C.Approver("Ops B", "operations"),
        gates=_all_green(), scope_id="scope-1", scope_approved=True,
        jurisdiction_approved=True, window_seconds=3600, at_epoch=NOW)
    base.update(kw)
    return C.CeremonyRequest(**base)


def test_all_gates_green_helper():
    ok, missing = C.gates_all_green(_all_green())
    assert ok and not missing
    ok2, missing2 = C.gates_all_green(C.ReadinessGates(scope_signed=True))
    assert not ok2 and "intake_ready" in missing2


def test_valid_ceremony_arms_response():
    ok, reasons = C.ceremony_ok(_req())
    assert ok, reasons
    st = C.run_ceremony(_req())
    assert A.is_active(st, NOW + 10)          # bounded, killable R0 state
    assert not A.is_active(A.kill(st, "On-call"), NOW + 10)


def test_missing_gate_blocks():
    gates = C.ReadinessGates(**{**_all_green().__dict__, "drills_ready": False})
    ok, reasons = C.ceremony_ok(_req(gates=gates))
    assert not ok and any("drills_ready" in r for r in reasons)


def test_agent_cannot_be_approver():
    ok, _ = C.ceremony_ok(_req(approver_a=C.Approver("agent", "clinical_safety")))
    assert not ok
    with pytest.raises(A.ResponseActivationError):
        C.run_ceremony(_req(approver_b=C.Approver("automation", "operations")))


def test_approvers_must_be_distinct_and_different_roles():
    same_person = _req(approver_b=C.Approver("Dr A", "operations"))
    assert not C.ceremony_ok(same_person)[0]
    same_role = _req(approver_b=C.Approver("Ops B", "clinical_safety"))
    ok, reasons = C.ceremony_ok(same_role)
    assert not ok and any("different governance roles" in r for r in reasons)


def test_r0_preconditions_composed():
    # unapproved jurisdiction is an R0 precondition failure surfaced by the ceremony
    ok, reasons = C.ceremony_ok(_req(jurisdiction_approved=False))
    assert not ok
    ok2, _ = C.ceremony_ok(_req(window_seconds=A.MAX_ACTIVATION_WINDOW_S + 1))
    assert not ok2


def test_run_ceremony_raises_when_not_ready():
    gates = C.ReadinessGates()      # nothing green
    with pytest.raises(A.ResponseActivationError):
        C.run_ceremony(_req(gates=gates))
