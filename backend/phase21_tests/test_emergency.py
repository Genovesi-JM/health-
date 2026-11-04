"""Phase 21 emergency escalation: unknown/expired jurisdiction fails to generic
guidance (never a guessed number); no external-action claims; reachable during
outages; telemetry drops health detail; deterministic triggers.
"""
from __future__ import annotations

from datetime import date

from app import emergency as E

TODAY = date(2026, 9, 14)
REG = [E.EmergencyEntry(jurisdiction="AO", region="Luanda", language="pt", number="112",
                        source_url="https://minsa.gov.ao", verified_date=date(2026, 9, 1),
                        owner="clinical_owner", expiry=date(2027, 9, 1))]


def test_known_jurisdiction_returns_verified_number():
    g = E.get_emergency_guidance("AO", "pt", REG, TODAY)
    assert "112" in g


def test_unknown_jurisdiction_generic_no_guess():
    g = E.get_emergency_guidance("ZZ", "pt", REG, TODAY)
    assert g == E.GENERIC_GUIDANCE
    assert not any(ch.isdigit() for ch in g)      # no guessed number


def test_no_jurisdiction_generic():
    assert E.get_emergency_guidance(None, "pt", REG, TODAY) == E.GENERIC_GUIDANCE


def test_expired_entry_falls_to_generic():
    expired = [E.EmergencyEntry("AO", "Luanda", "pt", "112", "u", date(2025, 1, 1),
                                "o", expiry=date(2025, 6, 1))]
    assert E.get_emergency_guidance("AO", "pt", expired, TODAY) == E.GENERIC_GUIDANCE


def test_language_mismatch_falls_to_generic():
    assert E.get_emergency_guidance("AO", "fr", REG, TODAY) == E.GENERIC_GUIDANCE


def test_guidance_reachable_during_all_outages():
    assert E.guidance_reachable(auth_down=True, payment_down=True, consent_incomplete=True,
                                ai_down=True, video_down=True, api_down=True)


def test_no_external_action_claims_pass():
    assert E.claims_no_external_action("In an emergency, contact your local emergency services.")
    assert "not contacted" in E.disclaimer()


def test_false_external_action_claims_flagged():
    for bad in ("The hospital has been notified", "Ambulance dispatched",
                "estimated response 5 minutes", "your queue position is 2",
                "we have contacted the hospital", "less waiting"):
        assert not E.claims_no_external_action(bad)


def test_escalation_triggers_deterministic():
    assert E.should_escalate({"red_flag": True})
    assert E.should_escalate({"no_clinician_coverage": True})
    assert not E.should_escalate({"foo": True})


def test_telemetry_drops_health_detail():
    clean = E.sanitize_escalation_event({
        "event": "escalation", "trigger": "red_flag", "jurisdiction": "AO",
        "symptoms": "chest pain", "diagnosis": "MI", "patient_name": "X",
    })
    assert clean == {"event": "escalation", "trigger": "red_flag", "jurisdiction": "AO"}
    assert "symptoms" not in clean and "diagnosis" not in clean and "patient_name" not in clean
