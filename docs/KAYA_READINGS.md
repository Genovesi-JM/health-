# Kaya measurement ingestion

Status: locally implemented and tested in synthetic environments; clinical
launch remains HOLD. Angola is the first market, with Portugal explicitly
supported in the same contracts. This feature does not establish a diagnosis,
validate device accuracy or approve any clinical thresholds.

## New measurements

`POST /api/v1/readings` and `/readings/sync` require an explicit `country`
(`AO` or `PT`) and accept `consent_language` (default `pt`). CSV imports at
`POST /api/v1/readings/import` use the same multipart fields. The patient comes
from the authenticated session, never the body. Every write acquires the shared
patient transaction lock before checking current server consent. Withdrawal and
measurement writes therefore have a serialized order.

Manual entry needs the five current required purposes listed in
[Kaya consent](KAYA_CONSENT_MODEL.md). All nonmanual sources, every sync and CSV
import additionally require the separately chosen optional `devices` purpose.
Device-derived triage vitals use the same rule before a triage or measurement
record is created. Measurements derived from triage carry its country/language.
No approved catalog or grant is fabricated when a purpose is unavailable.

The web and native clients show Angola/Portugal selection. Their preflight
reduces acquisition and transmission without authority; the backend still
checks again for each write. Web Bluetooth uses a separate chooser click after
the asynchronous consent check to retain the browser's required user gesture.
Native health synchronization checks before OS permissions and sample reads.
This does not validate a real device bridge or activate a provider.

## Identity, errors and history

The sync identity remains patient + source + external sample ID across all
markets. The same identity cannot be relabelled with a different country or
language, or silently assigned a market when its legacy scope is unknown. Such
a conflict returns `409 reading_scope_conflict` and rolls back the whole batch.
Within the same scope, corrected samples update their existing record. CSV uses
its existing patient/source/type/measurement-time duplicate identity and applies
the same scope rule. Every retry still needs current consent; these APIs do not
have durable UUID receipts for manual writes or whole batches.

Native connections retain only bounded owner/country/language configuration.
Old connections without explicit scope need reconnection. A sync captures one
scope for all batches and keeps the original source IDs; connection replacement,
disconnect and account changes invalidate late callbacks and cursor commits.
The cursor advances only when every batch succeeds. An uncertain manual write
requires checking history before repeating, because another POST can duplicate
it.

CSV imports are capped at 2 MiB and 2,000 data rows. Oversized files fail before
writes. Missing, invalid or future measurement dates become row errors; imports
do not invent a current timestamp. Aware timestamps normalize to UTC. The web
shows partial/invalid-row errors and retains the file for correction. Valid
rows may be imported while other rows fail; this is reported with the actual
imported/skipped counts.

Personal history and deletion remain accessible after withdrawal, subject to
normal ownership checks. Old rows retain null country/language and are shown as
unknown. `reading_consent_scope_v1` adds nullable scope without manufacturing
historical consent; downgrade refuses to erase scope already in use.

## Triage lifecycle

Answers, completion and photo attachment acquire the patient lock before
reloading the owned session. A request waiting behind completion cannot change
its answers or attach another photo. Concurrent completion produces one result.
An empty answer set returns 422 without completing the session or creating a
result. This is a lifecycle safeguard, not clinical validation of the triage
algorithm or its question set.

## Verification and limits

Source-hashed evidence is retained in
[evidence/readings-consent-2026-10-04](evidence/readings-consent-2026-10-04/validation.json)
and the corresponding native export record. The PostgreSQL cluster is local,
disposable and Unix-socket-only. Browser smoke uses the built UI with entirely
synthetic HTTP replies and blocked external traffic. No live patient data,
provider, real database migration, deployment or medical approval was involved.

The native APK remains the earlier informational 09df949/policy277 build. Later
Hermes exports verify current JavaScript source, not a rebuilt installed app.
