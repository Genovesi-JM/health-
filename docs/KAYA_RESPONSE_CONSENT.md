# KAYA Response — consent & data handling for incidents (Phase R10)

Recording a Response incident requires a specific, non-bundled consent; the record
is minimized; and retention/erasure follow the data-governance rules
(`backend/app/response_consent.py`, domain-pure, composing `app.data_governance`).

## Invariants enforced

- **Consent-gated recording.** `incident_recording_allowed` is fail-closed — no
  consent, no recording. `consent_is_specific` requires a Response-specific
  consent, not one bundled with the care contract.
- **Data minimization.** `record_is_minimized` allows only the allowlisted incident
  fields; extra fields are rejected and listed.
- **Special-category data.** `incident_data_categories` marks incident data as
  identity + health; `ropa_for_response` provides a ROPA template that is
  intentionally invalid until a named owner sets the retention period.
- **Retention-aware erasure.** `erasure_allowed` keeps a record within retention or
  under a legal hold; erasable only once past retention with no hold.
- **Withdrawal.** `withdrawal_stops_future_recording` stops new recording;
  lawfully-retained records remain.

## Tests — `backend/phaseR10_tests/test_response_consent.py` (7, all passing)

Recording requires consent; consent must be specific/non-bundled; record
minimization; incident is special-category; ROPA template needs retention/signing;
erasure respects retention + legal hold; withdrawal stops recording.

## Human intervention / external gates (owner-bound)

- **Signed Response ROPA + retention** set by the data controller/DPO (ties to
  Phase 39); the template is invalid until retention is set.
- **Response consent document** authored specifically (not bundled) and localized.
- **Clinical release stays HOLD; Response stays DISABLED.**
