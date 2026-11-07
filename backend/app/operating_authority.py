"""Organization, facility, and clinical operating authority (Phase 18).
Domain-pure. Kaya cannot present a clinic, facility, availability, or care
service, or accept a booking, without a **verified organization and an explicit,
active operating relationship** for the chosen jurisdiction. Organization
authority and professional authority are **jointly** required at booking and care
time. A global verified flag never authorizes practice everywhere.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

# Organization operating statuses.
ORG_ACTIVE = "active"
_ORG_BLOCKED = frozenset({"suspended", "closed", "expired", "terminated", "draft", "pending_review"})


@dataclass
class Organization:
    org_id: str
    status: str                       # active | suspended | closed | expired | terminated | ...
    verified_by_human: bool           # a human approval, not automated extraction
    jurisdiction: str
    medical_director_id: Optional[str]
    insurance_valid: bool
    effective_from: Optional[date]
    effective_to: Optional[date] = None


@dataclass
class Facility:
    facility_id: str
    org_id: str
    open: bool = True                 # location-specific downtime toggles this


@dataclass
class ServiceMembership:
    clinician_id: str
    org_id: str
    facility_id: str
    service: str
    profession: str
    privilege_granted: bool
    active: bool
    effective_from: Optional[date]
    effective_to: Optional[date] = None


def org_can_operate(org: Organization, jurisdiction: str, today: Optional[date] = None) -> bool:
    today = today or date.today()
    if not org.verified_by_human:
        return False                              # automated/submitted number is not verification
    if org.status != ORG_ACTIVE or org.status in _ORG_BLOCKED:
        return False
    if org.jurisdiction != jurisdiction:
        return False                              # must match the chosen jurisdiction
    if org.medical_director_id is None or not org.insurance_valid:
        return False
    if org.effective_from is None or today < org.effective_from:
        return False
    if org.effective_to is not None and today > org.effective_to:
        return False
    return True


def _membership_active(m: ServiceMembership, today: date) -> bool:
    if not (m.active and m.privilege_granted):
        return False
    if m.effective_from is None or today < m.effective_from:
        return False
    if m.effective_to is not None and today > m.effective_to:
        return False
    return True


def clinician_can_practice_here(m: ServiceMembership, org: Organization, facility: Facility,
                                jurisdiction: str, today: Optional[date] = None) -> bool:
    """JOINT org + professional authority, bound to this exact facility/service.
    A global verified flag does not authorize practice everywhere."""
    today = today or date.today()
    if not org_can_operate(org, jurisdiction, today):
        return False
    if not facility.open:
        return False
    if m.org_id != org.org_id or m.facility_id != facility.facility_id:
        return False                              # not bound to this facility
    if org.org_id != facility.org_id:
        return False                              # facility must belong to the org
    return _membership_active(m, today)


def booking_allowed(m: ServiceMembership, org: Organization, facility: Facility,
                    jurisdiction: str, today: Optional[date] = None) -> bool:
    """Bookings require an active verified org relationship AND professional
    authority for this facility/service."""
    return clinician_can_practice_here(m, org, facility, jurisdiction, today)


def can_appear_public(org: Organization, facility: Facility, jurisdiction: str,
                      today: Optional[date] = None) -> bool:
    """A clinic/facility appears publicly only with an active verified
    relationship for the chosen jurisdiction; never inferred partner status."""
    return org_can_operate(org, jurisdiction, today) and facility.open and facility.org_id == org.org_id


# Public profile fields that may be exposed (never private evidence).
PUBLIC_PROFILE_FIELDS = frozenset({"name", "facility_type", "address", "services", "hours", "contact_public"})
PRIVATE_EVIDENCE_FIELDS = frozenset({"registration_number", "license_scan", "insurance_document",
                                     "bank_details", "medical_director_id"})


def is_publishable_field(field_name: str) -> bool:
    return field_name in PUBLIC_PROFILE_FIELDS and field_name not in PRIVATE_EVIDENCE_FIELDS


def cross_org_access_allowed(actor_org_ids: frozenset, resource_org_id: str) -> bool:
    """Cross-organization staff/data access is denied by policy."""
    return resource_org_id in actor_org_ids


# A status change invalidates these without erasing records.
STATUS_CHANGE_INVALIDATES = ("schedules", "new_bookings", "clinical_entry", "public_listing")
