"""Phase 39 data governance: ROPA validity (health needs a special-category
condition, no indefinite retention), sub-processor DPA requirement, default-deny
cross-border transfers, DSAR deadlines, erasure blocked by clinical retention /
legal hold, and breach-notification triggers.
"""
from __future__ import annotations

import pytest

from app import data_governance as G


def _ropa(**kw):
    base = dict(purpose="teleconsultation", lawful_basis="contract",
                data_categories=frozenset({"identity", "health"}), retention_days=3650,
                special_category_condition="health_care_provision")
    base.update(kw)
    return G.ProcessingActivity(**base)


# ── ROPA ─────────────────────────────────────────────────────────────────────

def test_valid_ropa_entry():
    ok, reasons = G.ropa_entry_valid(_ropa())
    assert ok, reasons


def test_health_data_needs_special_condition():
    ok, reasons = G.ropa_entry_valid(_ropa(special_category_condition=None))
    assert not ok and any("special-category" in r for r in reasons)


def test_no_indefinite_retention():
    ok, reasons = G.ropa_entry_valid(_ropa(retention_days=None))
    assert not ok and any("retention" in r for r in reasons)


def test_unknown_lawful_basis_rejected():
    ok, _ = G.ropa_entry_valid(_ropa(lawful_basis="because"))
    assert not ok


# ── Sub-processors ───────────────────────────────────────────────────────────

def test_subprocessor_needs_dpa():
    assert not G.subprocessor_allowed(G.SubProcessor("VideoCo", "video", dpa_signed=False))
    assert G.subprocessor_allowed(G.SubProcessor("VideoCo", "video", dpa_signed=True))


# ── Transfers ────────────────────────────────────────────────────────────────

def test_domestic_transfer_allowed():
    assert G.transfer_allowed("AO", "AO", mechanism=None)


def test_cross_border_default_deny():
    assert not G.transfer_allowed("US", "AO", mechanism=None)
    assert not G.transfer_allowed("US", "AO", mechanism="handshake")


def test_cross_border_with_valid_mechanism():
    assert G.transfer_allowed("US", "AO", mechanism="scc")
    assert G.transfer_allowed("PT", "AO", mechanism="explicit_consent")


# ── DSAR ─────────────────────────────────────────────────────────────────────

def test_dsar_deadline_and_unknown_type():
    assert G.dsar_deadline_days("access") == G.DSAR_DEADLINE_DAYS
    with pytest.raises(ValueError):
        G.dsar_deadline_days("delete_everything")


def test_erasure_blocked_by_clinical_retention_and_legal_hold():
    # non-clinical, no hold → erasable
    assert G.erasure_allowed(is_clinical_record=False, clinical_retention_active=False, legal_hold=False)
    # clinical record within retention → not erasable
    assert not G.erasure_allowed(is_clinical_record=True, clinical_retention_active=True, legal_hold=False)
    # legal hold overrides everything
    assert not G.erasure_allowed(is_clinical_record=False, clinical_retention_active=False, legal_hold=True)
    # clinical record past retention → erasable
    assert G.erasure_allowed(is_clinical_record=True, clinical_retention_active=False, legal_hold=False)


# ── Breach ───────────────────────────────────────────────────────────────────

def test_breach_notification_trigger():
    assert G.breach_notification_required(involves_personal_data=True, likely_risk_to_individuals=True)
    assert not G.breach_notification_required(involves_personal_data=True, likely_risk_to_individuals=False)
    assert not G.breach_notification_required(involves_personal_data=False, likely_risk_to_individuals=True)
    assert G.breach_deadline_hours() == 72
