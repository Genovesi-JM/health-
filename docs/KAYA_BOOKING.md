# Kaya transactional booking (Phase 23)

Evidence date 14 September 2026. Prevent double booking, false confirmation,
duplicate payment intent, and inconsistent state under retries and concurrency.
Enforced by [`backend/app/booking.py`](../backend/app/booking.py); tested in
[`backend/phase23_tests`](../backend/phase23_tests).

- **Hold-to-confirm** with short expiry (10 min), idempotency keys, ownership, and
  quoted terms; explicit failure outcomes.
- **Single-owner capacity** (`CapacityLedger`): at most one active booking owns a
  slot; a simultaneous second request raises `CapacityConflict`. In production
  this is a **database unique constraint** on the reserved slot — not a
  process-local lock (`CONFLICT_ENFORCEMENT = database_unique_constraint`).
- **Idempotency** (`IdempotencyStore`): a lost-response retry with the same key
  returns the original result and never creates a duplicate appointment, payment,
  notification, or audit record.
- **Confirmation revalidation** (`can_confirm`): credentials, privilege, org
  authority, effective consent, service state, age/capacity and jurisdiction are
  re-checked at confirmation, and the hold must be unexpired — fail closed.
- **UI never shows confirmed** until the server transaction has committed
  (`ui_shows_confirmed`); uncertain writes reconcile the external outcome before
  replay (`replay_before_write`).
- Bounded, audited transitions (hold/confirmed/cancelled/rescheduled/no_show/
  expired/failed); cancelled/no_show/expired are terminal.

## PostgreSQL concurrency gate (BLOCKED_EXTERNAL)

The release gate requires **PostgreSQL** concurrency evidence for same-slot,
adjacent-slot, multi-resource, stale-hold, idempotent-retry and suspension races
under multiple replicas; **SQLite-only tests are not accepted**. The full
deployment gate remains **OPEN**. Local PostgreSQL evidence for the implemented
application lifecycle is recorded below; it does not verify a deployed topology
or the separate policy-level expiring-hold workflow.

## Application booking integration — 4 October 2026

The current API reserves a published dated slot in the transaction that creates
the consultation and audit event. The application uses database resource locks,
patient/clinician overlap checks, a conditional reservation update and an
owner/request-key unique index. Identical request retries return the stored
consultation; conflicting payloads return an error. Acceptance remains a separate
doctor action. Cancellation releases the matching reservation atomically.
Patient cancellation is limited to requested/scheduled care, checked again on
the server so a stale patient screen cannot cancel care that has already started.

The policy-level ten-minute hold and quoted-terms workflow described above is
not the application's current lifecycle. An application request reserves its
slot pending acceptance or cancellation; automatic expiry and payments remain
further work. SQLite API race tests demonstrate one winner for competing slot
claims and immediate-care acceptance. See
[runtime scheduling](KAYA_SCHEDULING.md#application-integration--4-october-2026).

The reproducible [PostgreSQL harness](../scripts/kaya_validate_postgres.py) creates
a new disposable cluster, binds only a private Unix socket, copies source without
dotenv/operator credentials and stops the cluster after validation. The harness
exercises the real authenticated API using independent database sessions and SQL
barriers before resource locking. On PostgreSQL 18.1 at READ COMMITTED, nine
scenarios passed, including 30 forced races: same-slot requests, overlapping
patient requests across doctors, competing queue acceptance, exact request
retries, cancellation/rebooking, stale cancellation, late starts, overruns and
revocation after authentication while acceptance waits. See the
[source-hashed report](evidence/scheduling-2026-10-04/postgresql.json).

Run with the backend dependencies and the pinned `psycopg2-binary` driver:

```sh
TMPDIR=/tmp python scripts/kaya_validate_postgres.py --postgres-bin /path/to/postgresql/bin
```

An optional `--staged` validates the Git index snapshot, and `--git` chooses an
explicit Git executable. This local evidence does not prove multi-replica load,
production database configuration, live provider readiness or clinical approval.
