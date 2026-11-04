"""Phase 18 operating authority: no clinic/clinician appears or accepts bookings
without a verified active org relationship; org + professional authority jointly
required; global verified does not authorize everywhere; cross-org denied.
"""
from __future__ import annotations

from datetime import date

from app.operating_authority import (
    Organization, Facility, ServiceMembership, org_can_operate,
    clinician_can_practice_here, booking_allowed, can_appear_public,
    is_publishable_field, cross_org_access_allowed, STATUS_CHANGE_INVALIDATES,
)

TODAY = date(2026, 9, 14)


def _org(**kw):
    base = dict(org_id="org-1", status="active", verified_by_human=True, jurisdiction="AO",
                medical_director_id="md-1", insurance_valid=True, effective_from=date(2026, 1, 1))
    base.update(kw)
    return Organization(**base)


def _fac(**kw):
    base = dict(facility_id="fac-1", org_id="org-1", open=True)
    base.update(kw)
    return Facility(**base)


def _mem(**kw):
    base = dict(clinician_id="doc-1", org_id="org-1", facility_id="fac-1", service="primary_care",
                profession="doctor", privilege_granted=True, active=True, effective_from=date(2026, 1, 1))
    base.update(kw)
    return ServiceMembership(**base)


def test_verified_org_can_operate():
    assert org_can_operate(_org(), "AO", TODAY)


def test_unverified_org_cannot_operate():
    assert not org_can_operate(_org(verified_by_human=False), "AO", TODAY)


def test_wrong_jurisdiction_cannot_operate():
    assert not org_can_operate(_org(jurisdiction="ES"), "AO", TODAY)


def test_missing_medical_director_or_insurance():
    assert not org_can_operate(_org(medical_director_id=None), "AO", TODAY)
    assert not org_can_operate(_org(insurance_valid=False), "AO", TODAY)


def test_suspended_org_blocks_operation_and_booking():
    org = _org(status="suspended")
    assert not org_can_operate(org, "AO", TODAY)
    assert not booking_allowed(_mem(), org, _fac(), "AO", TODAY)


def test_clinician_joint_authority_required():
    assert clinician_can_practice_here(_mem(), _org(), _fac(), "AO", TODAY)
    # No professional privilege → denied even with a verified org.
    assert not clinician_can_practice_here(_mem(privilege_granted=False), _org(), _fac(), "AO", TODAY)


def test_global_verified_does_not_authorize_other_facility():
    other_fac = _fac(facility_id="fac-2")
    # Membership is bound to fac-1; cannot practice at fac-2.
    assert not clinician_can_practice_here(_mem(), _org(), other_fac, "AO", TODAY)


def test_facility_downtime_blocks():
    assert not clinician_can_practice_here(_mem(), _org(), _fac(open=False), "AO", TODAY)


def test_booking_requires_active_verified_relationship():
    assert booking_allowed(_mem(), _org(), _fac(), "AO", TODAY)
    assert not booking_allowed(_mem(active=False), _org(), _fac(), "AO", TODAY)


def test_public_appearance_requires_verified_org():
    assert can_appear_public(_org(), _fac(), "AO", TODAY)
    assert not can_appear_public(_org(verified_by_human=False), _fac(), "AO", TODAY)


def test_only_public_fields_publishable():
    for f in ("name", "services", "hours", "address"):
        assert is_publishable_field(f)
    for f in ("registration_number", "license_scan", "insurance_document", "bank_details"):
        assert not is_publishable_field(f)


def test_cross_org_access_denied():
    assert cross_org_access_allowed(frozenset({"org-1"}), "org-1")
    assert not cross_org_access_allowed(frozenset({"org-1"}), "org-2")


def test_status_change_invalidation_targets():
    for t in ("schedules", "new_bookings", "clinical_entry", "public_listing"):
        assert t in STATUS_CHANGE_INVALIDATES
