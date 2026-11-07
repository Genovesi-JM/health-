"""KAYA Response — consent & data handling for incidents (Phase R10). Domain-pure.

Recording a Response incident requires a specific, non-bundled consent for
Response incident handling; the record is minimized to the fields actually needed;
retention and erasure follow the data-governance rules (a legal/clinical retention
obligation overrides an erasure request); and withdrawal stops future recording
while lawfully-retained records remain.

Composes `app.data_governance`. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import data_governance

RESPONSE_CONSENT_KIND = "response_incident"

# The only fields a minimized incident record may carry.
MINIMAL_INCIDENT_FIELDS = frozenset({
    "incident_id", "reporter_id", "jurisdiction", "area_id", "reported_at_epoch",
    "symptom_summary", "consent_ref", "routing_state", "boundary_event",
})


class ResponseConsentError(Exception):
    pass


def incident_recording_allowed(consent_effective: bool) -> bool:
    """Fail-closed: no consent, no recording."""
    return bool(consent_effective)


def consent_is_specific(bundled_with_care: bool) -> bool:
    """Response incident consent must be specific, not bundled with the care
    contract or a blanket notice."""
    return not bundled_with_care


def record_is_minimized(fields: frozenset) -> tuple[bool, tuple]:
    """The record may carry only allowlisted fields (data minimization)."""
    extra = fields - MINIMAL_INCIDENT_FIELDS
    return (not extra, tuple(sorted(extra)))


def incident_data_categories() -> frozenset:
    """Incident data is treated as health/special-category data."""
    return frozenset({"identity", "health"})


def ropa_for_response() -> data_governance.ProcessingActivity:
    """A ROPA entry template for Response incident handling (must be signed)."""
    return data_governance.ProcessingActivity(
        purpose="response_incident_handling",
        lawful_basis="vital_interests",
        data_categories=incident_data_categories(),
        retention_days=None,                         # owner must set → invalid until then
        special_category_condition="vital_interests",
    )


def erasure_allowed(is_within_retention: bool, legal_hold: bool) -> bool:
    """Erasure of an incident record follows the data-governance rule: a clinical/
    legal retention obligation or legal hold keeps it."""
    return data_governance.erasure_allowed(
        is_clinical_record=True, clinical_retention_active=is_within_retention,
        legal_hold=legal_hold,
    )


def withdrawal_stops_future_recording(withdrawn: bool) -> bool:
    """After withdrawal, no new incident data is recorded; lawfully-retained
    records remain (handled by erasure_allowed)."""
    return not withdrawn
