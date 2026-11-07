"""Phase R10 Response consent & data handling: recording needs specific consent,
records are minimized, incident data is special-category, ROPA template is unsigned
by default, erasure respects retention/legal hold, and withdrawal stops recording.
"""
from __future__ import annotations

from app import response_consent as RC
from app import data_governance as G


def test_recording_requires_consent():
    assert RC.incident_recording_allowed(True)
    assert not RC.incident_recording_allowed(False)


def test_consent_must_be_specific_not_bundled():
    assert RC.consent_is_specific(bundled_with_care=False)
    assert not RC.consent_is_specific(bundled_with_care=True)


def test_record_minimization():
    ok, extra = RC.record_is_minimized(frozenset({"incident_id", "symptom_summary"}))
    assert ok and not extra
    bad, extra2 = RC.record_is_minimized(frozenset({"incident_id", "full_medical_history", "home_address"}))
    assert not bad and set(extra2) == {"full_medical_history", "home_address"}


def test_incident_is_special_category():
    assert "health" in RC.incident_data_categories()


def test_ropa_template_needs_retention_signed():
    ropa = RC.ropa_for_response()
    ok, reasons = G.ropa_entry_valid(ropa)
    assert not ok and any("retention" in r for r in reasons)   # retention unset by design


def test_erasure_respects_retention_and_hold():
    assert not RC.erasure_allowed(is_within_retention=True, legal_hold=False)   # within retention
    assert not RC.erasure_allowed(is_within_retention=False, legal_hold=True)   # legal hold
    assert RC.erasure_allowed(is_within_retention=False, legal_hold=False)      # erasable


def test_withdrawal_stops_recording():
    assert RC.withdrawal_stops_future_recording(withdrawn=False)
    assert not RC.withdrawal_stops_future_recording(withdrawn=True)
