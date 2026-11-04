# Kaya staging environment & pre-flight release gate (Phase 40)

A go/no-go aggregation on top of the Phase 2 governance release board
(`backend/app/preflight.py`, domain-pure). It fails closed: production release is
**NO-GO** unless a separate staging environment (synthetic data only) has passed,
every phase gate is GREEN with no unresolved external gate, and every required
human sign-off is present from a non-agent holder with separation of duties. The
agent can never sign off or self-clear.

## Invariants enforced

- **Environment isolation.** `environments_isolated` requires staging to share no
  database, domain, or credentials with production.
- **Synthetic-only staging.** `staging_data_is_synthetic` requires staging to carry
  synthetic data only — never a copy of real records.
- **Human sign-offs.** `REQUIRED_SIGNOFFS` = clinical_safety, legal, privacy,
  security, accessibility, operations. `signoff_valid` rejects an agent/automation
  approver; `all_signoffs_present` requires every role; `signoffs_separation_ok`
  forbids one person holding two sign-offs.
- **Fail-closed go/no-go.** `preflight` returns GO only when the release board is
  not on HOLD, staging is isolated + synthetic, every gate is GREEN
  (EXTERNAL/RED/UNKNOWN block), and all sign-offs are present with separation of
  duties — otherwise it returns the full blocking list.

## Tests — `backend/phase40_tests/test_preflight.py` (13, all passing)

Environment isolation (shared db/domain/creds fail); synthetic-only staging;
sign-off validity (agent rejected); all-present and separation-of-duties;
full pre-flight GO when green; HOLD blocks; EXTERNAL/UNKNOWN gate blocks; missing
sign-off blocks; non-synthetic staging blocks; no-gates blocks.

## Current pre-flight status (this repository)

**NO-GO**, by design. Multiple phase gates are `COMPLETE_WITH_EXTERNAL_GATES`
(EXTERNAL), the release board defaults to **HOLD**, and no human sign-offs exist.
This is the correct, honest state: the agent has prepared enforceable policy and
tests, and a named human release board must clear the external gates and sign off
before any production release.

## Human intervention / external gates (owner-bound)

- **Provision an isolated staging environment** (separate DB/domain/credentials,
  synthetic data) — infrastructure owner.
- **Clear every EXTERNAL gate** from Phases 0–39 (each documented in its phase
  record) to GREEN with evidence.
- **Collect the six named human sign-offs** through the Phase 2 release board with
  separation of duties. **Clinical release stays HOLD until then.**
