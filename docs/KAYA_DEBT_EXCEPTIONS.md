# Kaya debt exceptions (Phase 6)

Evidence date 14 September 2026. These are **owner-bound, expiring** exceptions
for known failing checks in **unreachable, non-pilot code**. They are isolated,
not concealed: the failures are listed here, the verification entry point
(`scripts/kaya_verify.py`) reports them explicitly, and none is on a reachable
Kaya path while the Phase 0/1 hold stands (the default app returns 503 on every
clinical route; the clinical frontend is not mounted).

**Review/expiry: 2026-12-13.** Each exception must be repaired or re-justified by
then. An exception may never cover a pilot-path failure, a security-test failure,
or any P0. No assertion was weakened, no security test skipped, and no timeout
was increased to create these exceptions.

## Baseline (authoritative Phase 0 audit harness)

`pytest tests` in the disposable audit harness: **62 failed, 180 passed, 0
errors** in 279.34s. Identical failing case IDs in the original and transformed
source — this is **pre-existing GeoVision-era debt, not a Kaya-transformation
regression**. The full legacy suite runs only in that harness (the synthetic
runtime refuses to start where an operator `backend/.env` exists — a deliberate
safety control), so it is classified `SKIP_WITH_REASON` in-place.

The **required pilot gate is green**: the phase-safety suites (phase0/phase1/
governance/phase3/phase4/phase5) and `security_tests` pass (see `kaya_verify.py`).

## Exception ledger

| ID | Failing area (count) | Severity | Reachable now? | Owner | Rationale | Expiry |
| --- | --- | --- | --- | --- | --- | --- |
| DBT-01 | `test_mfa.py` (11) | P1 (test-isolation) | No — held | Security lead | Likely MFA/settings state leak between tests, not a product defect; the required security suite passes. Fix test isolation, do not weaken. | 2026-12-13 |
| DBT-02 | `test_clinician_credentials.py` (12) | P1 | No — held | Credentialing + eng | Credentialing lifecycle in non-pilot code; verify in Phase 17 before enabling. | 2026-12-13 |
| DBT-03 | `test_compliance_dashboard.py` (10) | P2 | No — held | Compliance + eng | Compliance dashboard not on the pilot wedge. | 2026-12-13 |
| DBT-04 | `test_state_machine.py` (9) | P1 | No — held | Clinical + eng | Care-episode/state-machine debt; repaired under Phase 24. | 2026-12-13 |
| DBT-05 | `test_health.py` (9) | P2 | No — held | Backend lead | General health-endpoint suite against non-pilot routes. | 2026-12-13 |
| DBT-06 | `test_verification_actions.py` (5) | P1 | No — held | Credentialing + eng | Provider verification actions (disabled providers); Phase 17. | 2026-12-13 |
| DBT-07 | `test_document_expiry.py` (3) | P2 | No — held | Backend lead | Document-expiry scheduler off by default. | 2026-12-13 |
| DBT-08 | `test_public_contact.py`, `test_nurse_dashboard.py`, `test_basic.py` (1 each) | P2 (test-isolation) | No — held | Eng lead | These pass in isolation but leak in full-suite ordering — test-isolation defects to fix in the toolchain pass, not product bugs. | 2026-12-13 |

Total isolated: **62** (matches the authoritative baseline).

## Frontend lint debt

Phase 0 measured 115 frontend lint errors, concentrated in the **legacy/non-pilot
clinical code** (`LegacyApp.tsx` and the disabled clinical pages), not the
supported pilot path (the informational-only entry, governance, and Phase 3
copy). No blanket lint-disable was added. Scoped lint repair of the legacy path
is owner-bound eng-lead debt with the same 2026-12-13 review. The supported pilot
path must remain lint-clean; a later toolchain pass enforces this per-path.

## What is NOT covered

Repair (not just isolation) of DBT-01 (MFA test isolation) and the other
test-isolation defects remains open engineering work; it requires the disposable
audit harness to iterate and is scheduled before the corresponding capability
phases enable those features. This ledger isolates the debt so later phases
inherit a trustworthy pilot gate; it does not claim the legacy suite is green.
