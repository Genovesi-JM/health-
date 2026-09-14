# Kaya data-processing agreements & records of processing (Phase 39)

Privacy governance-as-code for a health data controller
(`backend/app/data_governance.py`, domain-pure). The lawful-basis taxonomy is
modeled on GDPR / Angola APD-style regimes; the exact statutory mapping and every
approval are owner-bound.

## Invariants enforced

- **Record of Processing Activities (ROPA).** `ropa_entry_valid` requires a named
  purpose, a recognized lawful basis, a retention period (no indefinite
  retention), and — for health/special-category data — an appropriate additional
  condition (explicit consent / health-care provision / public health / vital
  interests).
- **Sub-processors.** `subprocessor_allowed` permits a sub-processor to process
  personal data only under a signed DPA.
- **Cross-border transfers (default deny).** `transfer_allowed` permits a domestic
  transfer, and a cross-border one only with a valid mechanism (adequacy / SCC /
  BCR / explicit consent). Nothing is assumed adequate by default.
- **Data-subject requests.** `dsar_deadline_days` returns the statutory deadline
  for access/rectification/erasure/portability/restriction/objection.
- **Erasure vs retention.** `erasure_allowed` does not override a clinical-record
  retention obligation or a legal hold — those keep the record; a clinical record
  past retention becomes erasable.
- **Breach notification.** `breach_notification_required` triggers on a
  personal-data breach likely to risk individuals; `breach_deadline_hours` is 72h.

## Tests — `backend/phase39_tests/test_data_governance.py` (11, all passing)

Valid ROPA; health-needs-special-condition; no-indefinite-retention; unknown
lawful basis; sub-processor DPA requirement; domestic-allowed vs cross-border
default-deny vs valid-mechanism; DSAR deadline + unknown type; erasure blocked by
clinical retention / legal hold (and erasable past retention); breach-notification
triggers and 72h deadline.

## Human intervention / external gates (owner-bound)

- **Complete ROPA & retention schedule** per purpose, authored/approved by the data
  controller / DPO.
- **Signed sub-processor DPAs** for every provider (video, AI, payments, storage,
  email/SMS) — each remains BLOCKED_EXTERNAL until signed.
- **Transfer mechanism per destination** (adequacy/SCC/BCR) decided by legal
  counsel; the adequate-country list is intentionally empty here.
- **DSAR workflow & SLA** and a **breach-response runbook** operationalized by named
  owners.
- Ties to R09 (jurisdiction adoption) and R12 (approval confusion): none of these
  can be self-approved by the agent. **Clinical release stays HOLD.**
