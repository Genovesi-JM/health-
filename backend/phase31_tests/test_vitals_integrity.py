"""Phase 31 vitals integrity: unit normalization, plausibility (reject impossible,
flag critical), timestamp bounds, provenance (self-reported != verified), and
idempotent dedup. Ranges are ILLUSTRATIVE, not clinically validated.
"""
from __future__ import annotations

import pytest

from app import vitals_integrity as V

NOW = 1_700_000_000


# ── Unit normalization ───────────────────────────────────────────────────────

def test_temperature_f_to_c():
    assert V.normalize_unit("temperature", 98.6, "F") == pytest.approx(37.0, abs=0.05)
    assert V.normalize_unit("temperature", 37.0, "C") == 37.0


def test_glucose_mmol_to_mgdl():
    assert V.normalize_unit("glucose", 5.5, "mmol/L") == pytest.approx(99.1, abs=0.2)


def test_weight_lb_to_kg():
    assert V.normalize_unit("weight", 154, "lb") == pytest.approx(69.85, abs=0.05)


def test_unknown_unit_rejected():
    with pytest.raises(V.VitalsError):
        V.normalize_unit("glucose", 100, "furlongs")
    with pytest.raises(V.VitalsError):
        V.normalize_unit("temperature", 40, "kelvin")


# ── Plausibility ─────────────────────────────────────────────────────────────

def test_normal_value_ok():
    assert V.classify_value("heart_rate", 72).verdict == V.OK


def test_impossible_value_rejected():
    assert V.classify_value("heart_rate", 500).verdict == V.REJECT
    assert V.classify_value("oxygen_saturation", 150).verdict == V.REJECT


def test_critical_value_flagged_for_review():
    assert V.classify_value("oxygen_saturation", 85).verdict == V.CRITICAL
    assert V.classify_value("glucose", 320).verdict == V.CRITICAL
    assert V.classify_value("temperature", 40.5).verdict == V.CRITICAL


def test_unsupported_type_rejected():
    assert V.classify_value("aura_level", 5).verdict == V.REJECT


def test_blood_pressure_rules():
    assert V.classify_blood_pressure(120, 80).verdict == V.OK
    assert V.classify_blood_pressure(190, 100).verdict == V.CRITICAL
    assert V.classify_blood_pressure(80, 120).verdict == V.REJECT   # sys<=dia
    assert V.classify_blood_pressure(400, 200).verdict == V.REJECT  # impossible


# ── Timestamp integrity ──────────────────────────────────────────────────────

def test_future_timestamp_rejected():
    assert not V.timestamp_ok(NOW + 3600, NOW)
    assert V.timestamp_ok(NOW - 60, NOW)


def test_ancient_timestamp_rejected():
    assert not V.timestamp_ok(NOW - (2 * 366 * 24 * 3600), NOW)


# ── Provenance ───────────────────────────────────────────────────────────────

def test_source_validation():
    assert V.source_valid("bluetooth")
    assert not V.source_valid("telepathy")


def test_self_reported_never_verified():
    assert V.is_clinician_verified("bluetooth", verified_by_clinician=False) is False
    assert V.is_clinician_verified("manual", verified_by_clinician=False) is False
    assert V.is_clinician_verified("manual", verified_by_clinician=True) is True


# ── Dedup ────────────────────────────────────────────────────────────────────

def test_device_reading_idempotent():
    led = V.ReadingLedger()
    assert led.accept("pat-1", "bluetooth", "ext-1")
    assert not led.accept("pat-1", "bluetooth", "ext-1")     # duplicate push ignored
    assert led.accept("pat-1", "bluetooth", "ext-2")


def test_manual_reading_always_new():
    led = V.ReadingLedger()
    assert led.accept("pat-1", "manual", None)
    assert led.accept("pat-1", "manual", None)               # not deduped


# ── Composite ingest ─────────────────────────────────────────────────────────

def test_ingest_normalizes_and_accepts():
    d = V.ingest("glucose", 5.5, "mmol/L", "bluetooth", NOW - 10, NOW)
    assert d.accepted and d.plausibility == V.OK
    assert d.normalized_value == pytest.approx(99.1, abs=0.2)
    assert d.verified is False


def test_ingest_rejects_impossible():
    d = V.ingest("heart_rate", 500, "bpm", "manual", NOW, NOW)
    assert not d.accepted and d.plausibility == V.REJECT


def test_ingest_accepts_but_flags_critical():
    d = V.ingest("oxygen_saturation", 85, "%", "bluetooth", NOW, NOW)
    assert d.accepted and d.plausibility == V.CRITICAL       # surfaced, not rejected


def test_ingest_rejects_future_and_bad_source():
    d = V.ingest("heart_rate", 72, "bpm", "telepathy", NOW + 99999, NOW)
    assert not d.accepted
    assert any("source" in r for r in d.reasons)
    assert any("timestamp" in r for r in d.reasons)


def test_ingest_blood_pressure_requires_components():
    d = V.ingest("blood_pressure", None, "mmHg", "manual", NOW, NOW)
    assert not d.accepted and any("systolic" in r for r in d.reasons)
    d2 = V.ingest("blood_pressure", None, "mmHg", "manual", NOW, NOW, systolic=120, diastolic=80)
    assert d2.accepted and d2.plausibility == V.OK


def test_ingest_clinician_verified_flag():
    d = V.ingest("heart_rate", 72, "bpm", "manual", NOW, NOW, verified_by_clinician=True)
    assert d.accepted and d.verified is True
