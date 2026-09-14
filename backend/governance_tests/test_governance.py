"""Phase 2 governance: fail-closed release board, risk acceptance, change
control, and append-only evidence index. Synthetic, deterministic, offline.
"""
from __future__ import annotations

from datetime import date

import pytest

from app import governance as gov


TODAY = date(2026, 9, 14)
FUTURE = "2027-06-01"
PAST = "2026-01-01"

GOV = gov.load_governance()
OWNER = GOV["release_board"]["gate_owner"]
GATE_IDS = GOV["release_board"]["gate_ids"]


def _gate(gate_id: str, env: str = "staging-synthetic", **over):
    base = {
        "status": "APPROVED",
        "approver_person": f"Named Human for {gate_id}",
        "approver_role": OWNER[gate_id],
        "evidence_link": f"https://evidence.example/{gate_id}",
        "evidence_environment": env,
        "expiry_date": FUTURE,
    }
    base.update(over)
    return base


def _submission(env: str = "staging-synthetic", **over):
    sub = {
        "environment": env,
        "open_p0": False,
        "gates": {gid: _gate(gid, env) for gid in GATE_IDS},
    }
    sub.update(over)
    return sub


# ── Self check / structure ───────────────────────────────────────────────────

def test_self_check_passes():
    summary = gov.governance_self_check(GOV)
    assert summary["raci_functions"] == 12
    assert summary["gates"] == 11
    assert summary["roles"] >= 12


def test_default_verdict_is_hold():
    assert GOV["release_board"]["default_verdict"] == "HOLD"


# ── Release board: happy + fail-closed ───────────────────────────────────────

def test_all_approved_returns_go():
    assert gov.release_decision(_submission(), today=TODAY) == "GO"


def test_non_dict_submission_holds():
    assert gov.release_decision(None, today=TODAY) == "HOLD"  # type: ignore[arg-type]


def test_missing_gate_holds():
    sub = _submission()
    del sub["gates"]["security"]
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_open_gate_holds():
    sub = _submission()
    sub["gates"]["privacy_and_legal"] = {"status": "OPEN"}
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_rejected_gate_holds():
    sub = _submission()
    sub["gates"]["clinical_safety"]["status"] = "REJECTED"
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_unknown_status_holds():
    sub = _submission()
    sub["gates"]["security"]["status"] = "MAYBE"
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_open_p0_stops():
    assert gov.release_decision(_submission(open_p0=["R01"]), today=TODAY) == "STOP"
    assert gov.release_decision(_submission(open_p0=True), today=TODAY) == "STOP"


def test_expired_evidence_holds():
    sub = _submission()
    sub["gates"]["credentialing"]["expiry_date"] = PAST
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_environment_mismatch_holds():
    sub = _submission(env="staging-synthetic")
    sub["gates"]["security"]["evidence_environment"] = "production"
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_commit_only_no_human_holds():
    sub = _submission()
    sub["gates"]["security"]["approver_person"] = ""
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_commit_hash_as_evidence_holds():
    sub = _submission()
    sub["gates"]["security"]["evidence_link"] = "d6d9995"  # a bare commit hash is not approval
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_wrong_authority_holds():
    sub = _submission()
    # Finance owner cannot approve the clinical-safety gate.
    sub["gates"]["clinical_safety"]["approver_role"] = "finance_owner"
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_contradictory_marker_holds():
    sub = _submission()
    sub["gates"]["security"]["contradictory"] = True
    assert gov.release_decision(sub, today=TODAY) == "HOLD"


def test_not_applicable_gate_allowed():
    sub = _submission()
    sub["gates"]["commercial"] = {"status": "NOT_APPLICABLE"}
    assert gov.release_decision(sub, today=TODAY) == "GO"


def test_limited_go_requires_scope():
    sub = _submission(requested_verdict="LIMITED_GO")
    assert gov.release_decision(sub, today=TODAY) == "GO"  # no scope → not LIMITED_GO, but all approved → GO
    sub2 = _submission(requested_verdict="LIMITED_GO", limited_scope="one clinic, invited adults, weekday mornings")
    assert gov.release_decision(sub2, today=TODAY) == "LIMITED_GO"


# ── Risk acceptance ──────────────────────────────────────────────────────────

def _acceptance(**over):
    base = {
        "risk_id": "R99",
        "residual_severity": "P2",
        "accepted_by_role": "operations_owner",
        "accepted_by_person": "Named Operations Owner",
        "rationale": "Bounded degraded path with monitoring.",
        "decision_date": "2026-09-14",
        "expiry_date": FUTURE,
        "evidence_link": "https://evidence.example/R99",
        "change_author": "engineering_preparer",
    }
    base.update(over)
    return base


def test_valid_low_impact_acceptance_ok():
    gov.validate_risk_acceptance(_acceptance(), today=TODAY, governance=GOV)


def test_p0_never_acceptable():
    with pytest.raises(gov.GovernanceError):
        gov.validate_risk_acceptance(_acceptance(residual_severity="P0"), today=TODAY, governance=GOV)


def test_missing_field_rejected():
    a = _acceptance()
    del a["expiry_date"]
    with pytest.raises(gov.GovernanceError):
        gov.validate_risk_acceptance(a, today=TODAY, governance=GOV)


def test_expired_acceptance_rejected():
    with pytest.raises(gov.GovernanceError):
        gov.validate_risk_acceptance(_acceptance(expiry_date=PAST), today=TODAY, governance=GOV)


def test_future_decision_rejected():
    with pytest.raises(gov.GovernanceError):
        gov.validate_risk_acceptance(_acceptance(decision_date="2099-01-01"), today=TODAY, governance=GOV)


def test_high_impact_self_approval_rejected():
    # High-impact (P1) accepted by the change author is prohibited.
    a = _acceptance(residual_severity="P1", accepted_by_person="Same Person", change_author="Same Person",
                    accepted_by_role="clinical_safety_lead")
    with pytest.raises(gov.GovernanceError):
        gov.validate_risk_acceptance(a, today=TODAY, governance=GOV)


def test_high_impact_independent_approver_ok():
    a = _acceptance(residual_severity="P1", accepted_by_person="Independent Clinical Lead",
                    change_author="Engineering Preparer", accepted_by_role="clinical_safety_lead")
    gov.validate_risk_acceptance(a, today=TODAY, governance=GOV)


def test_coding_agent_cannot_accept_risk():
    with pytest.raises(gov.GovernanceError):
        gov.validate_risk_acceptance(_acceptance(accepted_by_role="engineering_preparer"),
                                     today=TODAY, governance=GOV)


# ── Change control ───────────────────────────────────────────────────────────

def test_known_category_returns_roles():
    result = gov.required_reviewers("clinical_rules", GOV)
    assert result["required_approver"] == "medical_director"
    assert "clinical_safety_lead" in result["required_reviewers"]


def test_unknown_category_fails_closed():
    with pytest.raises(gov.GovernanceError):
        gov.required_reviewers("something_unlisted", GOV)


# ── Append-only evidence index ───────────────────────────────────────────────

def _record(rid: str, **over):
    base = {
        "id": rid,
        "requirement": "P2-REQ-release-board-fail-closed",
        "code_ref": "backend/app/governance.py::release_decision",
        "test_ref": "backend/governance_tests/test_governance.py",
        "build_digest": "sha256:deadbeef",
        "environment": "local-synthetic",
        "reviewer_role": "engineering_preparer",
        "decision_date": "2026-09-14",
        "status": "prepared",
        "supersedes": None,
    }
    base.update(over)
    return base


def test_evidence_append_and_active():
    idx = gov.EvidenceIndex(GOV)
    idx.append(_record("EV-001"))
    idx.append(_record("EV-002"))
    assert len(idx.active()) == 2


def test_evidence_immutable_id():
    idx = gov.EvidenceIndex(GOV)
    idx.append(_record("EV-001"))
    with pytest.raises(gov.GovernanceError):
        idx.append(_record("EV-001", status="rewritten"))


def test_evidence_supersession():
    idx = gov.EvidenceIndex(GOV)
    idx.append(_record("EV-001"))
    idx.append(_record("EV-002", supersedes="EV-001"))
    active_ids = {r["id"] for r in idx.active()}
    assert active_ids == {"EV-002"}
    assert len(idx.all_records()) == 2  # nothing rewritten


def test_evidence_supersede_unknown_rejected():
    idx = gov.EvidenceIndex(GOV)
    with pytest.raises(gov.GovernanceError):
        idx.append(_record("EV-002", supersedes="EV-404"))


def test_evidence_rejects_secret():
    idx = gov.EvidenceIndex(GOV)
    with pytest.raises(gov.GovernanceError):
        idx.append(_record("EV-SEC", rationale="password=hunter2"))


def test_evidence_rejects_health_data():
    idx = gov.EvidenceIndex(GOV)
    with pytest.raises(gov.GovernanceError):
        idx.append(_record("EV-PHI", requirement="patient diagnosis of hypertension"))


def test_append_only_verifier():
    old = ["a", "b"]
    gov.verify_append_only(old, ["a", "b", "c"])  # extension ok
    with pytest.raises(gov.GovernanceError):
        gov.verify_append_only(old, ["a", "X"])  # rewrite
    with pytest.raises(gov.GovernanceError):
        gov.verify_append_only(old, ["a"])  # shrink


# ── No secrets / health data in packaged governance ──────────────────────────

def test_governance_policy_clean():
    gov.governance_self_check(GOV)
