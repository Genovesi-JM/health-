# KAYA Response — audit & incident record (Phase R9)

Every Response incident lifecycle step is recorded on an append-only,
tamper-evident hash chain (`backend/app/response_audit.py`, domain-pure, reusing
the Phase 36 audit chain). Boundary events are specially tracked and never
deletable; reads are access-controlled.

## Invariants enforced

- **Append-only + tamper-evident.** `ResponseIncidentLog` records intake/route/
  acknowledge/fallback/boundary-event/resolution/kill on the Phase 36 `AuditChain`;
  `verify()` detects any tampering; unknown event kinds are rejected.
- **Boundary events tracked.** `boundary_events()` returns the recorded boundary
  events (R15 zero-tolerance metric).
- **Per-incident query.** `incident_events(id)` returns one incident's trail.
- **Access-controlled.** `can_read_response_audit` admits an auditor/security/
  compliance role (Phase 36) or a `response_supervisor` with `audit_read`.
- **No deletion.** `delete_prohibited` raises — Response audit records are never
  deleted.

## Tests — `backend/phaseR9_tests/test_response_audit.py` (7, all passing)

Records + verifies; unknown event rejected; boundary events tracked; tamper breaks
verify; per-incident query; access control; delete prohibited.

## Human intervention / external gates (owner-bound)

- **Durable tamper-evident store.** Adopting this chain onto a WORM/append-only
  store at the real write path is an owner-approved change (ties to Phase 36).
- **Retention schedule** for Response incident records set by the data controller.
- **Clinical release stays HOLD; Response stays DISABLED.**
