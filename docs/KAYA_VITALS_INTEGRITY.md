# Kaya connected-device / vitals data integrity (Phase 31)

Patient-reported and connected-device measurements cannot corrupt the record or
silently drive unsafe decisions. `backend/app/vitals_integrity.py` (domain-pure)
is the canonical, fail-closed ingest policy that complements the `DeviceReading`
ORM model.

> The physiological ranges are **ILLUSTRATIVE** reference values, not clinically
> validated thresholds. A named clinical owner must set the real ranges and the
> critical-alert policy before any real use.

## Invariants enforced

- **Provenance.** `source_valid` limits sources to manual/bluetooth/wifi;
  `is_clinician_verified` returns true only when a clinician verified the reading —
  a device source never makes a value clinician-confirmed on its own, so
  self-reported vitals are never mistaken for verified.
- **Plausibility.** `classify_value` / `classify_blood_pressure` reject
  physiologically impossible values, flag critical values for review (surfaced,
  never auto-acting), and pass normal ones. Blood pressure additionally requires
  systolic > diastolic.
- **Unit normalization.** `normalize_unit` converts temperature (F→C), glucose
  (mmol/L→mg/dL) and weight (lb→kg) to canonical units; an unknown unit is
  rejected rather than assumed.
- **Timestamp integrity.** `timestamp_ok` rejects a measurement time in the future
  (beyond a 5-minute skew) or absurdly old (> ~1 year).
- **No silent overwrite.** `ReadingLedger` dedupes device pushes idempotently by
  (patient, source, external_id); a repeat is ignored rather than overwriting the
  stored value. Manual entries are always new rows.
- **Composite ingest.** `ingest` runs all of the above fail-closed: impossible →
  rejected, critical/implausible → accepted-but-flagged, self-reported → not
  verified.

## Tests — `backend/phase31_tests/test_vitals_integrity.py` (21, all passing)

Unit conversions and unknown-unit rejection; normal/impossible/critical
classification; unsupported-type reject; blood-pressure rules (normal, critical,
sys≤dia reject, impossible reject); future/ancient timestamp reject; source
validation; self-reported-never-verified; idempotent device dedup and
always-new manual entries; composite ingest normalizes+accepts, rejects
impossible, flags critical, rejects future/bad-source, requires BP components,
and honors the clinician-verified flag.

## Human intervention / external gates

- **Clinical range & alert policy (owner-bound).** A named clinical owner must
  replace the illustrative ranges with validated thresholds and define what a
  critical reading triggers (who is notified, how fast) — and confirm the app
  does not present device data as diagnosis.
- **Device calibration / identity trust.** A named owner decides which devices/
  vendors are trusted and how calibration/identity is established before a
  connected source is treated as reliable.
- **ORM adoption.** Adopting this policy at the `DeviceReading` write path
  (normalization, plausibility flagging, verified flag) is an owner-approved
  change; no live DB migrated.
- **Runtime adoption verification** — a harness-verified task must confirm the held
  device endpoints consume `ingest`.
- **Clinical release stays HOLD.**
