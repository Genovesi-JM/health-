# Retained clinical corrections

The application now supports attributed corrections of completed consultations.
The original finalized note remains unchanged. Clinical release stays HOLD; these
are synthetic/local implementation and validation results, not clinical approval.

## API and authority

`POST /api/v1/consultations/{id}/closeout/amendments` requires the assigned,
currently verified doctor, matching known Angola/Portugal practice country, active
episode consent, a completed consultation and an intact original/history. It
accepts a UUID `Idempotency-Key`, the expected current digest, an internal reason,
a complete SOAP/patient-summary text snapshot and an explicit patient-publication
boolean. Text limits are enforced. Outcomes and follow-up obligations remain
unchanged; a correction never duplicates, reschedules or cancels a follow-up task.

Doctor, patient and consultation locks serialize concurrent corrections. A stale
expected digest returns 409; an exact retry with the same key/content returns the
stored result. Reusing the key for different content is rejected. Correction,
audit and generic in-app notification commit atomically. A patient notice is
created only for explicit publication and contains no clinical preview.

The existing closeout GET remains compatible. Clinicians receive the original,
the effective latest clinical snapshot, current digest/revision, and attributed
correction history. Patients receive only the latest explicitly published summary
and published summary history. They never receive SOAP, internal reasons,
unpublished revisions or internal digests. All history is verified before read.
Older clinician overview/agenda/workspace readers use the same effective verified
note rather than silently showing obsolete clinical content.

## Storage and migration

`clinical_amendments_v1` follows `durable_notifications_v1`. Persisted correction
rows carry revision, previous digest, full snapshot, author, time, reason,
publication choice and request identity/digest. Per-note revision and request-key
uniqueness enforce the chain. The original finalization digest is computed before
its first insert.

SQLite and PostgreSQL guards reject changes/deletes of finalized or partially
finalized notes and corrections, retained-parent deletion, and changes to retained
episode identity, country, timezone or completed status. SQLite insert/update
conflict guards cover each protected unique identity, including `OR REPLACE`
under the default `recursive_triggers=0`. The referenced follow-up task cannot be
deleted, replaced or rebound to another patient/consultation; ordinary task
status, due-date and assignee updates remain permitted. Metadata events protect newly created test
schemas; the explicit migration installs protection on existing schemas. Existing
content is preserved, including corrupt historical content which remains blocked
by the read verifier. No live database was migrated. Destructive downgrade is
refused when finalized content or correction history exists.

These controls reject ordinary database writes. They are not a certificate-backed
signature, an external immutable audit store, or protection against an
administrator altering schema. A lawful retention schedule and live migration
approval still require the responsible clinical/data owner. Wrong-patient
retraction and changes to outcome/follow-up obligations need a separate reviewed
workflow; this correction endpoint does not silently perform those operations.

## Client behavior

The web clinician workspace exposes eligible completed records from history and
opens the same closeout view. The correction editor preserves the original,
shows the full current text and requires a reason and deliberate confirmation.
Patient publication defaults off. When another correction wins, the draft is
preserved and a clinician must compare the current version before rebasing and
reconfirming it.

An uncertain request retains its exact key/body and locks editing while retrying.
A later authorization/consent error cannot falsely establish that an earlier
request was never committed. Only a successful replay or the server's specific
post-lookup not-committed conflict can resolve that uncertainty. Drafts remain in
memory and are not written as clinical text to browser storage. Leaving the page
warns about an unsaved draft; after a reload, the clinician must reread the record.

Late refreshes cannot overwrite an acknowledged correction. Changing the
signed-in account remounts protected clinical views. Patients on web/native can
inspect published summary history with attribution; native parsing also copies
only permitted patient fields and rejects inconsistent publication history.

## Evidence

Validation covers permission/consent/country changes, private versus published
corrections, exact and changed retries, stale versions, atomic rollback, unchanged
follow-up tasks, historical corruption, database retention and migration adoption.
PostgreSQL scenarios additionally force independent concurrent transactions and
exercise migration/retention guards on a real disposable database. The report
records exact source hashes and confirms the cluster was stopped.

The final checkpoint passed **1,534 expanded backend tests**, **29 repository/
inventory checks with 43 subtests**, **256 web tests**, **15 presentation checks**,
web TypeScript, lint with zero warnings, and the production build. PostgreSQL18.1
passed15 scenarios including50 forced races. The independent reviewer reproduced
and verified the SQLite replacement and follow-up retention fixes. The
[source-hashed evidence](evidence/clinical-records-2026-10-04/manifest.json) records
scope and limitations; existing Python deprecations and the web chunk-size
warning remain. Mobile validation is recorded separately.
