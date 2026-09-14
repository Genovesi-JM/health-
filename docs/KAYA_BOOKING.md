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
under multiple replicas; **SQLite-only tests are not accepted**. That proof needs
a running Postgres (the Azure database is a foundation only, not running here) and
is **OPEN** — the domain logic and DB-constraint design are done; the live PG
concurrency run is pending the disposable harness/infra.
