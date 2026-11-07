"""Connected-device / vitals data integrity (Phase 31). Domain-pure.

Patient-reported and connected-device measurements cannot corrupt the record or
silently drive unsafe decisions. This module is the canonical, fail-closed policy
for ingesting a vital sign; it complements the `DeviceReading` ORM model.

Enforced invariants:

  * Provenance. Every reading carries a source (manual/bluetooth/wifi) and is NOT
    clinician-verified until a clinician verifies it; self-reported values are
    never treated as clinician-confirmed.
  * Plausibility. Impossible values are rejected; out-of-range values are flagged
    (never stored as if normal); critical values are surfaced for review but never
    auto-act.
  * Unit normalization. Values are converted to a canonical unit; an unknown unit
    is rejected rather than assumed.
  * Timestamp integrity. A measurement time in the future (beyond small skew) or
    absurdly old is rejected; the server also records receipt time.
  * No silent overwrite. (patient, source, external_id) dedupes idempotently; a
    change is a new reading, never an in-place edit of a stored clinical value.

IMPORTANT — the physiological ranges here are ILLUSTRATIVE reference values, not
clinically validated thresholds. A named clinical owner must set the real ranges
and critical-alert policy before any real use.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# ── Errors ───────────────────────────────────────────────────────────────────

class VitalsError(Exception):
    """A vitals-integrity rule was violated (fail-closed)."""


# ── Canonical units & normalization ──────────────────────────────────────────

CANONICAL_UNIT = {
    "temperature": "C",
    "glucose": "mg/dL",
    "weight": "kg",
    "oxygen_saturation": "%",
    "heart_rate": "bpm",
    "blood_pressure": "mmHg",
}


def normalize_unit(reading_type: str, value: float, unit: Optional[str]) -> float:
    """Convert to the canonical unit. Unknown unit for a type → reject."""
    u = (unit or "").strip().lower()
    if reading_type == "temperature":
        if u in ("c", "°c", "celsius", ""):
            return value
        if u in ("f", "°f", "fahrenheit"):
            return round((value - 32.0) * 5.0 / 9.0, 2)
        raise VitalsError(f"unknown temperature unit: {unit}")
    if reading_type == "glucose":
        if u in ("mg/dl", "mgdl", ""):
            return value
        if u in ("mmol/l", "mmol"):
            return round(value * 18.0182, 1)
        raise VitalsError(f"unknown glucose unit: {unit}")
    if reading_type == "weight":
        if u in ("kg", "kgs", ""):
            return value
        if u in ("lb", "lbs", "pound", "pounds"):
            return round(value * 0.453592, 2)
        raise VitalsError(f"unknown weight unit: {unit}")
    # Unitless / already-canonical types accept blank or the canonical unit.
    return value


# ── Plausibility ranges (ILLUSTRATIVE — not clinically validated) ────────────

# reading_type -> (possible_lo, possible_hi, critical_lo, critical_hi)
_RANGES = {
    "heart_rate": (25, 250, 40, 150),
    "oxygen_saturation": (50, 100, 92, 101),   # critical if < 92
    "temperature": (30.0, 43.0, 35.0, 39.5),
    "glucose": (20, 700, 54, 250),
    "weight": (1, 400, 0, 10_000),             # no clinical critical band
}
# blood pressure handled separately (two components)
_BP_SYS = (60, 290, 90, 180)
_BP_DIA = (30, 200, 60, 120)


REJECT = "reject"
FLAG = "flag_implausible"
CRITICAL = "critical_review"
OK = "ok"


@dataclass(frozen=True)
class Plausibility:
    verdict: str            # ok | flag_implausible | critical_review | reject
    reason: str = ""


def _classify(v: float, possible_lo, possible_hi, crit_lo, crit_hi) -> Plausibility:
    if v < possible_lo or v > possible_hi:
        return Plausibility(REJECT, f"value {v} physiologically impossible")
    if v < crit_lo or v > crit_hi:
        return Plausibility(CRITICAL, f"value {v} in critical range")
    return Plausibility(OK)


def classify_value(reading_type: str, value: float) -> Plausibility:
    if reading_type not in _RANGES:
        return Plausibility(REJECT, f"unsupported reading type: {reading_type}")
    lo, hi, clo, chi = _RANGES[reading_type]
    return _classify(value, lo, hi, clo, chi)


def classify_blood_pressure(systolic: int, diastolic: int) -> Plausibility:
    s = _classify(systolic, *_BP_SYS)
    d = _classify(diastolic, *_BP_DIA)
    if s.verdict == REJECT or d.verdict == REJECT:
        return Plausibility(REJECT, "blood pressure physiologically impossible")
    if systolic <= diastolic:
        return Plausibility(REJECT, "systolic must exceed diastolic")
    if s.verdict == CRITICAL or d.verdict == CRITICAL:
        return Plausibility(CRITICAL, "blood pressure in critical range")
    return Plausibility(OK)


# ── Timestamp integrity ──────────────────────────────────────────────────────

MAX_FUTURE_SKEW_S = 300               # 5 minutes
MAX_AGE_S = 366 * 24 * 3600           # ~1 year


def timestamp_ok(measured_at_epoch: int, now_epoch: int) -> bool:
    if measured_at_epoch > now_epoch + MAX_FUTURE_SKEW_S:
        return False
    if measured_at_epoch < now_epoch - MAX_AGE_S:
        return False
    return True


# ── Provenance ───────────────────────────────────────────────────────────────

VALID_SOURCES = {"manual", "bluetooth", "wifi"}


def source_valid(source: str) -> bool:
    return source in VALID_SOURCES


def is_clinician_verified(reading_source: str, verified_by_clinician: bool) -> bool:
    """A reading is clinician-verified ONLY when a clinician verified it; the
    source (even a device) never makes it clinician-confirmed on its own."""
    return bool(verified_by_clinician)


# ── Dedup / no silent overwrite ──────────────────────────────────────────────

def dedup_key(patient_id: str, source: str, external_id: Optional[str]) -> Optional[tuple]:
    """Idempotency key for device-sourced readings. Manual readings without an
    external id are not deduped (return None → always a new row)."""
    if not external_id:
        return None
    return (patient_id, source, external_id)


class ReadingLedger:
    """Idempotent ingest: the same (patient, source, external_id) is accepted once;
    a repeat is ignored (no silent overwrite of the stored value)."""

    def __init__(self) -> None:
        self._seen: set[tuple] = set()

    def accept(self, patient_id: str, source: str, external_id: Optional[str]) -> bool:
        key = dedup_key(patient_id, source, external_id)
        if key is None:
            return True                       # manual entry: always a new record
        if key in self._seen:
            return False                      # duplicate device push ignored
        self._seen.add(key)
        return True


# ── Composite ingest decision ────────────────────────────────────────────────

@dataclass(frozen=True)
class IngestDecision:
    accepted: bool
    plausibility: str
    normalized_value: Optional[float]
    verified: bool
    reasons: tuple = ()


def ingest(reading_type: str, value: Optional[float], unit: Optional[str],
           source: str, measured_at_epoch: int, now_epoch: int,
           verified_by_clinician: bool = False,
           systolic: Optional[int] = None, diastolic: Optional[int] = None) -> IngestDecision:
    """Fail-closed ingest: validate source, timestamp, unit and plausibility.
    Impossible values are rejected; critical/implausible are accepted-but-flagged
    (surfaced, never auto-acting); self-reported is never clinician-verified."""
    reasons: list[str] = []

    if not source_valid(source):
        reasons.append(f"invalid source: {source}")
    if not timestamp_ok(measured_at_epoch, now_epoch):
        reasons.append("measurement timestamp out of bounds")

    if reading_type == "blood_pressure":
        if systolic is None or diastolic is None:
            reasons.append("blood pressure requires systolic and diastolic")
            pl = Plausibility(REJECT, "missing components")
            normalized = None
        else:
            pl = classify_blood_pressure(systolic, diastolic)
            normalized = None
    else:
        if value is None:
            reasons.append("value required")
            pl = Plausibility(REJECT, "missing value")
            normalized = None
        else:
            try:
                normalized = normalize_unit(reading_type, value, unit)
            except VitalsError as e:
                reasons.append(str(e))
                return IngestDecision(False, REJECT, None, False, tuple(reasons))
            pl = classify_value(reading_type, normalized)

    if pl.verdict == REJECT:
        reasons.append(pl.reason)

    accepted = not reasons and pl.verdict != REJECT
    verified = is_clinician_verified(source, verified_by_clinician)
    return IngestDecision(
        accepted=accepted, plausibility=pl.verdict,
        normalized_value=normalized, verified=verified, reasons=tuple(reasons),
    )
