"""Phase 27 prescribing safety: fail-closed issuance — prescriber authority,
active relationship, allergy/interaction/dose/pregnancy screening with
unknown-inputs-block, controlled-substance restrictions (Schedule I never,
authority + identity + day-supply, refill ceilings), documented overrides only
for overridable blocks, and immutable issued prescriptions.

The reference tables are ILLUSTRATIVE, not clinically validated; these tests
prove the guardrail MECHANISM, not clinical correctness.
"""
from __future__ import annotations

import pytest

from app import prescribing_safety as P


def _prescriber(**kw):
    base = dict(is_clinician=True, prescribing_privilege=True, controlled_authority=False,
                jurisdiction_ok=True, suspended=False)
    base.update(kw)
    return P.PrescriberAuthority(**base)


def _ctx(**kw):
    base = dict(active_consultation=True, relationship_established=True)
    base.update(kw)
    return P.ClinicalContext(**base)


def _profile(**kw):
    base = dict(allergies=frozenset(), allergies_known=True,
                current_med_classes=frozenset(), current_med_names=frozenset(),
                current_meds_known=True, age_years=40, weight_kg=70.0,
                pregnant=False, renal_impairment=False, identity_verified=True)
    base.update(kw)
    return P.PatientSafetyProfile(**base)


def _order(**kw):
    base = dict(name="amoxicillin", drug_classes=frozenset({"penicillin"}),
                schedule=0, dose_mg=500, per_day=3, day_supply=7, quantity=21)
    base.update(kw)
    return P.DrugOrder(**base)


# ── Happy path ───────────────────────────────────────────────────────────────

def test_clean_prescription_allowed():
    d = P.can_issue(_order(), _prescriber(), _profile(), _ctx())
    assert d.allowed, d.reasons


# ── Authority / relationship ─────────────────────────────────────────────────

def test_suspended_prescriber_denied():
    d = P.can_issue(_order(), _prescriber(suspended=True), _profile(), _ctx())
    assert not d.allowed and any("not authorized" in r for r in d.reasons)


def test_no_privilege_denied():
    d = P.can_issue(_order(), _prescriber(prescribing_privilege=False), _profile(), _ctx())
    assert not d.allowed


def test_no_relationship_denied():
    d = P.can_issue(_order(), _prescriber(), _profile(), _ctx(active_consultation=False))
    assert not d.allowed and any("relationship" in r for r in d.reasons)


# ── Unknown inputs BLOCK (fail-closed) ───────────────────────────────────────

def test_unknown_allergy_history_blocks():
    d = P.can_issue(_order(), _prescriber(), _profile(allergies_known=False), _ctx())
    assert not d.allowed and any("allergy history not taken" in r for r in d.reasons)


def test_unknown_med_list_blocks():
    d = P.can_issue(_order(), _prescriber(), _profile(current_meds_known=False), _ctx())
    assert not d.allowed and any("current medication list" in r for r in d.reasons)


def test_unknown_age_blocks():
    d = P.can_issue(_order(), _prescriber(), _profile(age_years=None), _ctx())
    assert not d.allowed and any("age unknown" in r for r in d.reasons)


def test_weight_based_without_weight_blocks():
    d = P.can_issue(_order(weight_based=True), _prescriber(), _profile(weight_kg=None), _ctx())
    assert not d.allowed and any("weight required" in r for r in d.reasons)


# ── Allergy — absolute, never overridable ────────────────────────────────────

def test_allergy_by_name_blocks_and_not_overridable():
    prof = _profile(allergies=frozenset({"amoxicillin"}))
    d = P.can_issue(_order(), _prescriber(), prof, _ctx(), override_reason="patient insists")
    assert not d.allowed and any("allergy" in r for r in d.reasons)


def test_allergy_by_class_blocks():
    prof = _profile(allergies=frozenset({"penicillin"}))
    sr = P.screen(_order(), prof)
    assert sr.blocks and not sr.overridable


# ── Interactions & overrides ─────────────────────────────────────────────────

def test_overridable_major_interaction_requires_documented_override():
    order = _order(name="warfarinish", drug_classes=frozenset({"anticoagulant"}))
    prof = _profile(current_med_classes=frozenset({"nsaid"}))
    # no override → blocked
    d1 = P.can_issue(order, _prescriber(), prof, _ctx())
    assert not d1.allowed
    # documented override by authorized prescriber → allowed
    d2 = P.can_issue(order, _prescriber(), prof, _ctx(), override_reason="benefit outweighs, monitored")
    assert d2.allowed, d2.reasons


def test_never_override_interaction_stays_blocked():
    order = _order(name="phenelzineish", drug_classes=frozenset({"maoi"}))
    prof = _profile(current_med_classes=frozenset({"ssri"}))
    d = P.can_issue(order, _prescriber(), prof, _ctx(), override_reason="I really want to")
    assert not d.allowed


def test_pregnancy_contra_blocks_and_not_overridable():
    order = _order(name="isotretinoinish", drug_classes=frozenset({"retinoid"}))
    d = P.can_issue(order, _prescriber(), _profile(pregnant=True), _ctx(),
                    override_reason="anything")
    assert not d.allowed and any("pregnancy" in r for r in d.reasons)


def test_unknown_pregnancy_for_teratogen_blocks():
    order = _order(name="isotretinoinish", drug_classes=frozenset({"retinoid"}))
    d = P.can_issue(order, _prescriber(), _profile(pregnant=None), _ctx())
    assert not d.allowed and any("pregnancy status unknown" in r for r in d.reasons)


# ── Dose bounds ──────────────────────────────────────────────────────────────

def test_single_dose_over_max_blocks():
    d = P.can_issue(_order(name="paracetamol", drug_classes=frozenset(), dose_mg=1500, per_day=1),
                    _prescriber(), _profile(), _ctx())
    assert not d.allowed and any("single-dose max" in r for r in d.reasons)


def test_daily_dose_over_max_blocks():
    d = P.can_issue(_order(name="paracetamol", drug_classes=frozenset(), dose_mg=1000, per_day=6),
                    _prescriber(), _profile(), _ctx())
    assert not d.allowed and any("daily dose exceeds" in r for r in d.reasons)


# ── Controlled substances ────────────────────────────────────────────────────

def test_schedule_i_never_prescribable():
    order = _order(name="heroinish", drug_classes=frozenset(), schedule=1)
    d = P.can_issue(order, _prescriber(controlled_authority=True), _profile(), _ctx())
    assert not d.allowed and any("Schedule I" in r for r in d.reasons)


def test_controlled_requires_authority_and_identity():
    order = _order(name="oxyish", drug_classes=frozenset(), schedule=2, day_supply=10)
    # no controlled authority
    d1 = P.can_issue(order, _prescriber(controlled_authority=False), _profile(), _ctx())
    assert not d1.allowed and any("controlled-substance authority" in r for r in d1.reasons)
    # unverified identity
    d2 = P.can_issue(order, _prescriber(controlled_authority=True),
                     _profile(identity_verified=False), _ctx())
    assert not d2.allowed and any("identity must be verified" in r for r in d2.reasons)


def test_controlled_day_supply_limit():
    order = _order(name="oxyish", drug_classes=frozenset(), schedule=2, day_supply=90)
    d = P.can_issue(order, _prescriber(controlled_authority=True), _profile(), _ctx())
    assert not d.allowed and any("day supply" in r for r in d.reasons)


def test_controlled_refill_ceilings():
    assert P.controlled_refills_allowed(1) == 0
    assert P.controlled_refills_allowed(2) == 0
    assert P.controlled_refills_allowed(3) == 5
    assert P.controlled_refills_allowed(5) == 5


# ── Immutable issued prescription ────────────────────────────────────────────

def test_issue_is_immutable_and_hashed():
    rx = P.issue(_order(), "doc-1", "consult-1", now_epoch=1000,
                 refills_authorized=2, rx_id="rx-1")
    assert rx.rx_hash and rx.refills_authorized == 2
    with pytest.raises(P.PrescriptionImmutableError):
        P.edit_prohibited(rx)


def test_issue_clamps_controlled_refills():
    order = _order(name="oxyish", drug_classes=frozenset(), schedule=2, day_supply=7)
    rx = P.issue(order, "doc-1", "consult-1", now_epoch=1000,
                 refills_authorized=5, rx_id="rx-2")
    assert rx.refills_authorized == 0        # Schedule II clamps to zero refills
