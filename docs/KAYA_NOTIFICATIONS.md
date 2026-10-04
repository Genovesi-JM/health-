# Kaya in-app workflow notifications

Engineering evidence: 4 October 2026. The default release remains HOLD. These
endpoints run in the isolated operational application; the public default entry
points still refuse clinical operations.

## Durable events and transaction ownership

Consultation booking, acceptance, start, cancellation, closeout and explicitly
published follow-up changes now save the related in-app notices in the same
database transaction as the clinical workflow. A notification failure rolls back
the associated write. The helper never commits or rolls back the caller's
transaction. A database unique index on `(user_id, event_key)` and an insert with
conflict handling prevent duplicate event delivery without discarding other
work in a concurrent transaction.

Booking and closeout retries recover the existing event; marking a task complete
again does not send another completion notice. Generic task creation is atomic
with its audit and notice, but separate repeated POST requests can still create
distinct tasks: that endpoint has no request-idempotency contract.

New workflow notices contain generic descriptions, fixed entity identifiers and
no copied assessment, plan, medication, patient name or message preview. Internal
tasks notify their creator/assignee. Patient follow-up notices require the exact
task link in an intact, finalized consultation note; a generic task labelled
`follow_up` does not disclose it to the patient. Access to the linked record is
checked by the destination API separately from inbox access.

## Inbox contract

| Endpoint | Behavior |
| --- | --- |
| `GET /api/v1/notifications/capabilities` | In-app persistence is available; email, SMS and push are unavailable. |
| `GET /api/v1/notifications/inbox` | Owner-scoped cursor pagination, 1–100 items, optional unread filter and global unread count. |
| `GET /api/v1/notifications/me` | Compatible bounded array response for older clients. |
| `GET /api/v1/notifications/unread-count` | Count of all unread notices for the authenticated owner. |
| `PATCH /api/v1/notifications/{id}/read` | Owned conditional update, first-read timestamp and atomic content-free audit. |
| `PATCH /api/v1/notifications/read-all` | Marks the owner's current unread rows, records the affected count and returns it. |

Cursors are bounded and validated, tied to owner and filter, and ordered by
timestamp plus ID so equal timestamps do not skip rows. Every query is independently
owner-scoped. Responses use private/no-store headers and explicit UTC timestamps.
Retries preserve the first read timestamp and do not duplicate the read audit.
Reading a notification is an inbox action, not clinical acknowledgement or proof
that care was received.

Web and native inboxes use server pagination and counts, keep loaded data after
recoverable refresh failures, expose mutation errors and show read state only
after server confirmation. Account changes invalidate old responses. Fixed
internal navigation targets are used; notification data cannot supply an
arbitrary URL. Mark-all refreshes the inbox/count so newly arriving notices are
not incorrectly presented as read. Native also refreshes on focus/foreground.

## Migration and remaining delivery work

`durable_notifications_v1` adds nullable event keys and first-read timestamps,
the recipient/event unique index and an inbox index. Historical messages remain
unchanged, and previously read rows retain an unknown read time instead of an
invented timestamp. Fresh migration and adoption of the application's existing
`create_all` schema are tested in disposable databases.

No email, SMS or push provider is configured or contacted. Durable external
delivery needs an outbox worker, provider credentials/agreements, channel consent,
bounded retry and dead-letter handling, signed callbacks, suppression/preferences
and reconciliation. In-app persistence does not claim delivery on a locked or
offline device.

Legacy triage-photo, message, prescription-decision and doctor-review callers
retain their older best-effort notification helper. Newly generated message and
prescription notices no longer copy clinical previews, but historical text is
not rewritten. Those legacy workflow transactions require separate adoption of
the durable helper before claiming end-to-end delivery reliability for them.
Credential/compliance/expiry inserts retain their existing transaction behavior.

Local PostgreSQL tests exercise concurrent duplicate notification inserts and
concurrent read markers in addition to scheduling races. This is local database
evidence, not deployment or real-device delivery certification. Feature flags,
external-provider gates and clinical release status remain unchanged.

Validation for this checkpoint: 551 backend application tests, 180 relevant
policy/coordination/audit tests, 216 web tests, 86 native helper/contract tests,
15 presentation checks and web/native TypeScript passed. The web production
build passed. The PostgreSQL 18.1 harness passed 11 scenarios with 40 forced races
and stopped its isolated cluster afterwards; the
[source-hashed report](evidence/notifications-2026-10-04/postgresql.json) records
the tested snapshot. No device or external delivery provider was exercised.
