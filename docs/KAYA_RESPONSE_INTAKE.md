# KAYA Response — incident intake & red-flag detection (Phase R2)

Accepts a Response incident report only when Response is active and the intake
capability is permitted, always surfaces the emergency redirect and boundary
notice, and never auto-acts (`backend/app/response_intake.py`, domain-pure,
composing Phase 28 messaging red-flags and the R0/R1 gates).

## Invariants enforced

- **Fail-closed intake.** `intake` accepts only when Response is active, the
  `symptom_intake` capability is permitted for the jurisdiction/scope, the report
  is consented, and the text is non-empty; otherwise it returns the blocking
  reasons.
- **Always redirect + notice.** `emergency_redirect` (Phase 28 red-flag detector)
  and the boundary notice are computed on every intake, accepted or not.
- **Never auto-acts.** `incident_auto_actionable` is always False; an accepted
  report is `routed_for_human_review` — never a command that dispatches or
  contacts anyone.
- **Idempotent.** `IncidentLedger` dedupes a retried submission by external id.

## Tests — `backend/phaseR2_tests/test_response_intake.py` (7, all passing)

Accepted-when-active-and-permitted; rejected-when-inactive; unapproved-jurisdiction
rejected; consent/empty-text rejected; emergency redirect + boundary notice always
computed; never auto-actionable; dedup.

## Human intervention / external gates (owner-bound)

- **Red-flag list localization/validation** (Phase 28/R1) by a named clinical owner.
- **Human review roster** must exist to receive routed incidents (Phase R3).
- **Clinical release stays HOLD; Response stays DISABLED.**
