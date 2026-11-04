# Kaya observability, audit & privacy-safe telemetry (Phase 36)

Security- and clinically-significant events are always audited, the audit trail is
append-only and tamper-evident, and telemetry never carries PHI or secrets.
`backend/app/observability.py` (domain-pure) is the canonical policy; it composes
`app.redaction` and the PHI guard from `app.ai_egress`.

## Invariants enforced

- **Event completeness.** `audit_event_valid` requires a named action, a valid
  outcome (success/denied/error), and a timestamp (actor may be null for an
  anonymous/pre-auth action, but the who/what/when/outcome shape must be complete).
- **Must-audit actions.** `MUST_AUDIT_ACTIONS` lists security/clinical events
  (auth, authz-denied, privilege/role/consent changes, note sign/amend,
  prescription issue, record access/export, file download, triage complete,
  emergency redirect, booking confirm, config change, data delete) that must
  always be recorded.
- **Tamper-evident chain.** `AuditChain` links each event to the previous by hash;
  `verify()` detects any reorder/insertion/edit, `append` rejects an incomplete
  event, and `delete` raises — the log is append-only.
- **Sampling never drops audit events.** `sampling_may_drop` allows dropping only
  routine events, never a must-audit security/clinical event.
- **Privacy-safe telemetry.** `scrub_telemetry` redacts sensitive/clinical keys and
  secret/PHI-shaped values; `telemetry_is_safe` / `assert_telemetry_safe` guard a
  log/metric/trace string against PHI or secrets.
- **Audit-read access control.** `can_read_audit` admits only an auditor/security/
  compliance/DPO role holding the explicit `audit_read` privilege — not ordinary
  clinicians or admins.

## Tests — `backend/phase36_tests/test_observability.py` (11, all passing)

Event completeness (and anonymous-actor allowed); must-audit actions; chain
append+verify; incomplete-event rejected; tampered-chain fails verify;
audit-delete prohibited; sampling never drops security events; telemetry key
redaction and PHI/secret guard; audit-read access control.

## Human intervention / external gates (owner-bound)

- **Tamper-evident audit store.** Adopting `AuditChain` (or a WORM/append-only
  store with hash chaining) at the `HealthAuditLog` write path is an owner-approved
  change — the live model is not currently hash-chained. No live DB migrated.
- **PII-scrubbing verification.** A named privacy owner must verify the scrubbing
  covers the real telemetry sinks (logs, metrics, traces, error reporter) before
  any external telemetry is enabled.
- **Audit retention schedule** and **security alerting** (who is paged on which
  events) set by named owners.
- **Clinical release stays HOLD.**
