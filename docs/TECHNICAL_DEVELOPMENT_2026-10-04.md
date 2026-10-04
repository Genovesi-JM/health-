# Kaya technical development — 4 October 2026

Canonical codebase: `Genovesi-JM/health-`. This increment extends the existing
React/TypeScript web app, Expo mobile app and Python/FastAPI API. It does not
create another application or change the launch market.

## First increment: trustworthy consultation status

Previously, submitting a doctor and time immediately created a `scheduled`
consultation. The doctor agenda's confirm/cancel buttons changed local state
without persisting it. The completion endpoints could overwrite cancelled
consultations, and simultaneous queue acceptance used unconditional writes.

The implemented flow is:

| Action | Required state | Result |
| --- | --- | --- |
| Request a doctor and time | Patient profile and required consents | `requested`, directed to that doctor |
| Doctor accepts a timed request | `requested`, selected doctor | `scheduled` |
| Doctor accepts a next-available request | `requested`, eligible shared queue | `in_progress` (existing immediate-care behavior) |
| Doctor starts confirmed care | `scheduled`, assigned doctor | `in_progress` |
| Doctor completes care | `in_progress`, assigned doctor | `completed` |
| Authorized cancellation | `requested`, `scheduled` or `in_progress` | `cancelled` |

The backend validates future, timezone-qualified scheduling, doctor/time pairing
and the selected specialty. Dates are stored using the existing UTC convention
and consultation responses now explicitly include the UTC offset.

Queue filters cannot broaden access to other specialties. Directed requests are
visible to the selected doctor, and requests do not grant longitudinal patient
record access through the shared guard or doctor patient-list/summary endpoints.
The pre-existing general-care shared-queue eligibility remains in place; this is
not a clinical scope-of-practice certification.

Status/owner compare-and-set updates protect competing accept, start, complete
and cancel operations. Each mutation and its consultation audit event commit
together. SOAP notes submitted through the consultation completion endpoint are
part of that transaction. Video start/completion uses the same transition guard.
Audit metadata records state changes, without copying clinical notes or
cancellation reasons. Invalid/stale mutations return an error rather than
overwriting a terminal state.

Web agenda buttons now persist acceptance/cancellation and only show the server's
returned status. The work queue distinguishes accepting a request from starting
confirmed care and displays action failures. Patient booking text explains that
acceptance is pending. The Expo app now has a real, typed `Consultations` route
with status, refresh, empty/error states and cancellation, reachable from home
and the booking confirmation.

## Verification

Historical results from the original isolated development checkout on 4 October 2026: **258 backend tests passed** (including 26 new
lifecycle cases), **19 web tests passed** (including six new interaction tests),
**15 existing prototype checks passed**, web production build passed, and mobile
TypeScript check passed. The web build still reports a pre-existing large-bundle
warning. Native-device and production-database testing were not performed. These historical
counts do not verify the later integrated local branch; current validation is recorded
in the integrated foundation section below.

Commands, from the relevant directories:

```bash
# Repository root, after installing backend/requirements.txt
python -m pytest backend/tests -q --disable-warnings --tb=short

# frontend
npm ci
npm run build
npm test -- --maxWorkers=2 --minWorkers=1

# mobile
npm ci
npm run typecheck
```

New regression coverage includes directed acceptance, timezone preservation,
invalid bookings, unverified/wrong clinicians, patient isolation, forbidden
completion states, stale competing database sessions, audit failure rollback,
video-path bypass attempts, and web controls that must persist before changing
their displayed status. A separate CI workflow runs backend tests, web tests and
build, and mobile typechecking without deployment permissions.

## Compatibility and remaining work

No schema migration is required. Existing `scheduled` records remain scheduled;
their historical acceptance cannot be inferred or corrected by this change.
Scheduled requests from older clients must include a timezone. Deploy API and
web changes together, and validate the Expo build on real iOS/Android devices.

This increment is a development change, not a launch-readiness assessment.
Verification uses synthetic SQLite records and mocked web API responses; it does
not establish production PostgreSQL concurrency, native-device behavior or
external-provider readiness. The API still returns at most 100 patient
consultations and 50 queue entries; paging remains future work.

Next implementation priorities, with evidence from the current code:

1. Complete clinical closure: require the appropriate clinician-authored outcome,
   owner and follow-up tasks; distinguish ending a video call from closing care.
   Current optional SOAP fields and video completion remain separate gaps.
2. Audit remaining family/consent, revoked-credential and patient-record access
   paths; validate revocation across every endpoint. This change is not a full
   authorization audit.
3. Add capacity/slot conflict handling, expiry of unaccepted requests, persistent
   notifications and staging end-to-end tests against the deployment schema.
4. Prepare Angola first and Portugal alongside it, with country-specific providers,
   professional verification, consent, currency and service availability.
5. Upgrade Expo incrementally, then test authentication, secure storage,
   HealthKit/Health Connect, background behavior and branded store builds. Keep
   `health-` canonical and do not fork a second native app.
6. Leave payments/refunds to the final phase: replace fixed checkout amounts with
   server-side quotes, preserve the accepted amount/currency, and test idempotent
   checkout, webhook reconciliation, refunds and settlement in provider sandboxes.

## Recovery integration

The original increment was recovered exactly from its complete tool transcript
against commit `b18a848`, then merged with the later local development history.
The local document-URL expiry contract, translated agenda/landing page, and
approved-provider-only video access were preserved. Agenda tests now use the
existing translation provider; booking copy was adapted in the translation table.
Video join additionally checks the consultation remains in progress and does not
record a successful join when the provider is disabled or unconfigured. Six new
regression cases cover these integration corrections. Synthetic clinician fixtures
now enroll MFA and use MFA-complete test tokens to satisfy the existing access
guard; production authentication was not relaxed.

Focused integration validation on 4 October 2026 passed: **32 lifecycle backend
tests** in an isolated source copy without local environment files, **6 web
agenda/queue interaction tests**, and `git diff --check`. Full combined-branch
validation and native-device tests are separate from these focused results.

The existing standalone presentation prototype is separate from these real
application routes. Its simulated bookings are not production consultations.

## Integrated Angola/Portugal foundation

The local branch `codex/kaya-angola-portugal-foundation` combines the existing
local history, upstream presentation prototype and recovered consultation work.
The product and architecture records now agree on Angola first (initially
Luanda), Portugal preparation alongside it, React web/PWA, standalone
React Native/Expo apps and FastAPI. Customers will install Kaya itself; Expo Go
is not required. Payments remain the final implementation phase.

The canonical policy and all generated clients now contain explicit AO/PT
locales, currencies and clinic timezone choices. Portugal includes mainland,
Madeira and Azores zones; no fixed countrywide offset is assumed. Validators
reject incomplete or inconsistent market metadata, and client lookups do not
silently substitute a different country. These are planning/formatting settings;
they do not implement cross-border eligibility or activate clinical services.

Mobile development commands now use a development client and native builds.
The internal preview profile produces a standalone Android APK. Operational
API initialization requires an explicit HTTPS endpoint for distribution, with
local/emulator addresses and embedded credentials rejected. Configuration tests
also run against the URL parser bundled with the installed Expo SDK.

Foundation validation on 4 October 2026 (before the account journey below):

| Check | Result |
| --- | --- |
| Backend application suite | 282 passed, including 38 consultation lifecycle cases |
| Backend Phase 1 policy suite | 98 passed |
| Policy/inventory script tests | 23 passed |
| Web suite | 80 passed |
| Existing presentation prototype | 15 checks passed |
| Mobile endpoint tests | 6 passed |
| Web production build and web/mobile TypeScript | Passed |
| Generated policy consistency | 4 artifacts verified |

The backend application suite ran in a disposable source copy without local
environment files, using synthetic SQLite records and blocked network access.
The existing test wrapper cached repeated demo-seed password hashes only; real
authentication hashing remained exercised. Clinician workflow fixtures now use
administrator-issued invitations and complete MFA. MFA-specific tests provision
synthetic roles explicitly and assert that public signup cannot grant those roles.
Production authentication was not weakened to make tests pass.

These are local results, not a remote CI run or deployment. Existing Python
deprecation warnings, web bundle-size warnings and the Node module-type warning
remain. Native builds were not completed: this Mac's Xcode license is not yet
accepted, and platform signing/distribution is unverified. Mobile icons are still
placeholders and the installed Expo SDK 52 needs an upgrade review.

The default mobile entry remains informational. Its operational screens are
preserved but are not yet mounted for patient use. The account journey milestone
is implemented below. Native-device and production PostgreSQL concurrency
validation, capacity/slot conflicts and clinical closeout remain outstanding.

## Account, onboarding and professional approval journey

Patient signup now leads to the real, resumable eight-step profile in both the
web app and the native operational navigator. Angola is the initial country;
Portugal is also available. Submission validates the account email, birth date,
contact details and consent choices, then saves the patient record, user profile,
five versioned consent grants and completion audit in one transaction. Existing
optional clinical data is preserved when no replacement is supplied. A previously
submitted draft without this completion evidence resumes for proper completion.
Completed submissions can be retried without creating duplicate consent grants.

The wizard supports saved progress, back navigation and explicit save failures.
The registration screens no longer send unauthenticated, best-effort consent
requests or imply that signup has completed clinical onboarding. Contact
information is collected here; ownership verification by email or SMS is still
separate work. Optional family-sharing choices do not grant anyone record access.

Public professional signup creates a patient-role applicant with a professional
dossier. The applicant can supply credentials and evidence, submit the application,
and see its review status. Human approval by an administrator or compliance
reviewer validates the submitted evidence and licence, then commits the role
grant, professional status and audit together. Provider results alone do not grant
a clinical role. The previous applicant session cannot inherit the new authority;
the clinician signs in again and completes mandatory MFA. Native login now handles
MFA challenges, enrollment and recovery-code acknowledgment.

Approval and other participating dossier mutations use the captured status and
revision to reject stale writes. An upload racing with approval or revocation
cannot replace approved evidence; conflicts roll back and remove the newly
uploaded blob. The legacy doctor verification endpoint follows the same human
review rules. Revocation is terminal in these transitions.

Clinical access now checks current dossier status and licence expiry in addition
to the existing role, MFA and patient relationship checks. The covered paths
include consultation acceptance, doctor portal, video, medication renewal,
messages, medication and reading access, and prescription/referral download.
This does not certify every route in the application. Doctor discovery still uses
the cached profile flag; booking separately rejects a clinician whose authority
is no longer current.

The synthetic integration journey uses the real API routes for patient signup,
profile and consents, professional signup, evidence upload, submission, human
approval, MFA enrollment, booking and doctor acceptance. It verifies that a
request alone does not grant access to the longitudinal patient summary and that
the accepted consultation does. All data and evidence in this test are synthetic.

Final local validation for this account milestone:

| Check | Result |
| --- | --- |
| Backend application suite, including the complete account journey | 366 passed |
| Policy, identity, authorization, session and invitation suites (Phases 1, 12, 13, 14, 16) | 153 passed |
| Web interaction and policy suite | 113 passed |
| Native endpoint, auth and patient-onboarding tests | 22 passed |
| Presentation prototype checks | 15 passed |
| Web production build and web/native TypeScript | Passed |
| Generated policy consistency | 4 artifacts verified; release HOLD |
| Git whitespace/error check | Passed |

Backend runs used disposable source copies, synthetic SQLite databases and
blocked network access. New tests cover patient completion and rollback, lost
responses, legacy accounts, clinician authority withdrawal, and competing dossier
writes in separate database sessions. The existing Python deprecation, web bundle
size/Browserslist and Node module-type warnings remain. These local checks are not
remote CI, a real-device test or production PostgreSQL concurrency evidence.

The default HOLD entry points and external-provider activation gates remain in
place. No production service, deployment, provider transmission or payment was
activated. Next work is document-reading extraction and review in an isolated
preview, followed by the remaining consultation/video and clinical-closeout
workflow. Real provider onboarding, notification delivery, PostgreSQL concurrency,
native-device testing and store distribution still require validation. Payments
remain last.

## Patient document reading and review

Patients now have a dedicated document area in the operational web and native
clients. Web supports PDF/JPEG/PNG originals up to 10 MiB; native selection
currently supports JPEG/PNG, and can review text from PDFs uploaded on the web.
Portuguese copy serves the Angola-first and Portugal preparation scope. These
documents are separate from professional credential evidence and legacy company
documents.

The flow is upload with explicit processing consent, scan, extract, then review.
The private original and its hash are retained. Local PDF extraction produces an
unconfirmed transcription; the patient can correct and confirm it, or reject it.
The original extracted text is retained separately from reviewed text. Confirmation
does not update diagnoses, prescriptions, medication lists or device readings,
and does not imply clinical validation.

Only a clean malware scan allows parsing or original download. The ClamAV adapter
requires explicit operator configuration and the feature defaults to disabled.
Scanner failures and infected files remain unavailable for download. Original
downloads are authenticated responses rather than persistent public URLs.
Current professional authority and an accepted care relationship are required
for doctor access. Pending care requests alone do not grant access to these
documents.

Real PDF text extraction runs locally in a bounded subprocess with no model
provider call or inherited provider credentials. Images and scanned PDFs need
OCR/manual transcription; missing-page, encrypted and size/complexity conditions
are stated explicitly. The supported extraction is text-layer reading, not
structured laboratory interpretation. The
[file-safety record](KAYA_FILE_SAFETY.md) describes parser limits and the remaining
operational prerequisites.

Upload retries retain an owner-scoped idempotency key. Review/version conflicts
refresh the saved version and preserve the patient's local edits for comparison.
Database state changes and their content-free audit events commit together.
A new `patient_documents_v1` migration creates the metadata table and uniqueness
constraints; it is validated against disposable databases, including the current
application's `create_all` bootstrap behavior. No user or deployment database was
migrated during this work.

The canonical policy inventory now includes the new nine API declarations and
patient page, with all activation flags still false. The existing HOLD entry
points were preserved. Production scanner provisioning, image OCR, native PDF
selection/original download, real-device UI testing, clinical document-review UX,
production PostgreSQL validation and retention/deletion operations remain further
work. No live provider, scanner, deployment or clinical service was activated.

Final local validation for this document milestone:

| Check | Result |
| --- | --- |
| Full backend application suite | 419 passed |
| Focused patient document API and migration suite | 44 passed |
| Local PDF extraction subprocess tests (included in the full backend suite) | 9 passed |
| Policy, file safety and AI safety suites (Phases 1, 29, 30) | 134 passed |
| Scope and route inventory checks | 23 passed; 43 subtests passed |
| Web interaction and policy suite | 127 passed |
| Native endpoint, auth, onboarding and document helper tests | 36 passed |
| Presentation prototype checks | 15 passed |
| Web production build and web/native TypeScript | Passed |
| Generated policy consistency | 4 artifacts verified; release HOLD |
| Git whitespace/error check | Passed |

Backend checks used disposable source copies and synthetic SQLite databases with
network access blocked. Synthetic PDFs exercised the actual local extractor;
scanner tests used controlled responses rather than a live ClamAV installation.
The final empty-idempotency-key validation adjustment was separately regression
tested after the full backend run. Tests cover owner isolation, current clinician
authority and accepted relationships, blocked downloads, stale reviews, audit
rollback, upload commit/response failures, and migration bootstrap adoption.
The existing Python deprecation, web bundle size/Browserslist and Node module-type
warnings remain. These results do not establish production PostgreSQL concurrency,
scanner operation, real-device UI behavior or deployment readiness.

## Consultation closeout and patient follow-up

Clinical closeout now requires the assigned, currently authorized doctor to
record an assessment, plan, explicit outcome, separately authored patient summary
and explicit follow-up decision. Internal SOAP notes are not copied into the
patient summary. A finalized record retains clinician attribution, time and a
content digest; there is no API for silently replacing it. This is application
record finalization, not a qualified digital signature. Historical completed
consultations without an explicitly published summary remain unpublished.

Required follow-up has instructions and a future date with a timezone. Closeout
creates a task assigned to the finalizing doctor. Notes, consultation status,
follow-up task, local video-session ending and their audit events commit together.
An identical closeout retry recovers the saved result; changed content is rejected.
Task completion also commits its audit atomically, checks current assignment and
status in the write, and recovers identical retries. A stale view cannot overwrite
another completion or a reassignment. Patient views include follow-up owner,
deadline and current task status, without internal task completion notes.

The web doctor's queue and call view now lead to an explicit closeout editor,
with a separate confirmation before publishing the summary. Errors and conflicts
preserve the local draft. Web patients can open the published summary from their
consultations. Native patients can open consultation details from booking or the
list, follow request/acceptance status, cancel eligible requests, and read the
published summary and follow-up details. Native details refresh on focus and
foreground; active consultations also refresh periodically. Dates carry explicit
UTC offsets from the API and display in the device's local timezone.

Ending a video session no longer completes clinical care. The shipped video
provider remains disabled, and the actual join route refuses access even when
environment flags and a base URL are supplied. Authenticated capability discovery
reports this honestly to clients. Preparation/check-in records are local workflow
state and are not proof that an external call occurred. The
[video record](KAYA_VIDEO.md) explains the adapter boundary and remaining work.

The `consultation_closeout_v1` migration adds disclosure/finalization fields
without publishing historical notes. The policy inventory includes the closeout
read and video capabilities endpoints; release remains HOLD, with every activation
flag false. No live provider call, migration of user data, deployment or payment
was performed. Actual video-provider integration, native clinician editing,
device/media testing, production PostgreSQL concurrency and an amendment workflow
for finalized clinical notes remain further work. Appointment capacity/conflict
handling and reliable patient notification delivery also remain outstanding.
Nurse preparation retains the existing verified active-episode access model;
explicit team/facility assignment is not certified by this milestone.

Local validation uses synthetic identities and disposable SQLite source copies,
with outbound network access blocked. Tests exercise the real API journey from
closeout to owned follow-up completion and patient summary refresh, alongside
rollback, lost responses, stale writes, consent/authority checks, legacy-note
privacy, migration adoption and video configuration bypass attempts. Web checks
cover explicit publication, retained conflict drafts, unchanged retries after a
follow-up deadline, role-specific display and unavailable video. Native tests
cover the patient detail API contract and failure states; TypeScript checks the
screen integration. No real media call, mobile device or PostgreSQL server was
used. Existing Python deprecation, web bundle/Browserslist and Node module-type
warnings remain.

Final local validation for this consultation milestone:

| Check | Result |
| --- | --- |
| Full backend application suite | 465 passed |
| Policy, care-episode, video-boundary and database-integrity suites (Phases 1, 24, 25, 32) | 151 passed |
| Scope and route inventory checks | 23 passed; 43 subtests passed |
| Web interaction and policy suite | 159 passed |
| Native endpoint, auth, onboarding, document and consultation helper tests | 49 passed |
| Presentation prototype checks | 15 passed |
| Web production build and web/native TypeScript | Passed |
| Generated policy consistency | 4 artifacts verified; 269 API declarations; release HOLD |
| Git whitespace/error check | Passed |

The final backend source matches the tested disposable snapshot. The auxiliary
database-integrity suite initially lacked its referenced documentation in the
test snapshot; after copying that reference into the isolated harness, all 151
checks passed. No application change was needed for that harness omission.

## Published availability and conflict-safe booking

The next development increment replaces free-form appointment selection with
dated slots published by the clinician. Web clinicians can publish and withdraw
their own slots; web and native patients browse the same availability, by
country, specialty and doctor, through the 180-day publication horizon. An
explicit separate option submits a request without a promised appointment time.
The request remains pending until the clinician accepts it.

Slot reservation, consultation creation and audit now commit together. The API
serializes clinician and patient capacity checks, rejects overlapping commitments
and releases only the matching reservation on cancellation. Queue acceptance and
video/consultation start use the same capacity guard. A late start checks the
actual current interval, and ongoing care continues to block conflicting starts.
A UUID request key recovers the same consultation after a lost response; changed
content cannot reuse that identity. Web stores the minimal pending request in
account-scoped session storage and native uses SecureStore before submission.
Both retain uncertain requests for exact retry.

Angola uses Africa/Luanda. Portugal supports Lisbon, Madeira and the Azores;
clinicians choose the clinic zone explicitly. Date conversion rejects gaps and
requires disambiguation for repeated clock times. Patient displays include the
slot's zone and offset. The clinician agenda supports a selected local date and
uses the correct UTC bounds for 23-hour and 25-hour days. Historical appointments
with no country remain unclassified; the migration does not assign them to
Angola. Unknown historical duration is not presented as a known 30 minutes.

The `appointment_slots_v1` migration and five new API declarations are recorded
in the canonical inventory. Existing weekly profile hours remain stored but do
not publish dated capacity. Runtime credential and practice-country checks are
not a substitute for live organization/service approval. Release remains HOLD,
with all activation flags false. No deployment, live provider transmission or
user database migration was performed.

See [scheduling](KAYA_SCHEDULING.md) and [booking](KAYA_BOOKING.md) for the runtime
contract and its distinction from earlier policy-only mechanisms. Reliable
in-app workflow notifications are the next implementation stage. Request expiry,
recurring availability and rescheduling remain separate scheduling work.

Final local validation for the scheduling checkpoint:

| Check | Result |
| --- | --- |
| Full backend application suite, exact staged snapshot | 518 passed |
| Policy, scheduling, booking, care-episode, video and database suites (Phases 1, 22–25, 32) | 169 passed |
| Scope and route inventory checks | 23 passed; 43 subtests passed |
| Web interaction and policy suite | 197 passed |
| Native helper and API-contract suite | 70 passed |
| Presentation prototype checks | 15 passed |
| Web production build and web/native TypeScript | Passed |
| Generated policy consistency | 4 artifacts verified; 274 API declarations; release HOLD |
| Disposable PostgreSQL 18.1 API concurrency | 9 scenarios passed, including 30 forced races |
| Git whitespace/error check | Passed |

The full backend suite initially identified an older journey that submitted an
unpublished timestamp and an expiry test affected by a deliberately expired
credential left by another test. The journey now publishes a slot through the
real clinician API, and the authority test restores its fixture. Patient
cancellation is now limited to pending/scheduled care at the server as well as
the clients; cancellation of already active care requires the professional
workflow. The final exact staged backend snapshot passes all 518 tests.

The PostgreSQL harness uses synthetic identities, independent database sessions
and barriers before SQL resource locks. It passed against the exact staged
application source at READ COMMITTED; its private socket-only cluster was stopped
afterwards. The source-hashed report is retained in
[`evidence/scheduling-2026-10-04/postgresql.json`](evidence/scheduling-2026-10-04/postgresql.json).
This establishes local PostgreSQL behavior for the covered races, not deployment
topology, production configuration, native-device behavior or clinical launch
approval. No existing database was contacted or migrated. Existing deprecation,
bundle-size, Browserslist and Node module-type warnings remain.

## Durable in-app workflow notifications

Consultation changes and published follow-up tasks now persist their in-app
notices inside the originating database transaction. Failures roll back the
workflow instead of silently losing its notice; recipient/event uniqueness
prevents duplicate notifications on retries. Generic task creation also now
commits its task, audit and notice together, although separate repeated task
creation requests still create distinct tasks.

The new authenticated inbox has bounded cursor pagination, unread filtering,
global counts, explicit UTC dates and audited first-read markers. Web and native
clients use that contract, expose failed loads and writes, preserve loaded data
after recoverable errors, and invalidate stale responses across accounts. Native
home now fetches the actual global unread count. Related-record navigation uses
fixed internal destinations with independent record authorization.

New workflow notices do not contain clinical-text previews. Patient follow-up
notices require an exact link from an intact, finalized clinical note; internal
tasks stay internal. Email, SMS and push remain explicitly unavailable. Inbox
read status is not clinical acknowledgement or proof of care receipt.

The `durable_notifications_v1` migration preserves historical messages and
unknown historical read times. The policy inventory includes the inbox and
capabilities endpoints, with all flags false and release HOLD. The
[notification record](KAYA_NOTIFICATIONS.md) distinguishes these durable core
workflows from older best-effort notification callers and describes the external
delivery work still required. No live message or provider call was made.

Final local validation for the notification checkpoint:

| Check | Result |
| --- | --- |
| Full backend application suite | 551 passed |
| Policy, coordination, video, database and observability suites (Phases 1, 22–25, 32, 36) | 180 passed |
| Scope and route inventory checks | 23 passed; 43 subtests passed |
| Web interaction and policy suite | 216 passed |
| Native helper and API-contract suite | 86 passed |
| Presentation prototype checks | 15 passed |
| Web production build and web/native TypeScript | Passed |
| Generated policy consistency | 4 artifacts verified; 276 API declarations; release HOLD |
| Disposable PostgreSQL 18.1 API concurrency | 11 scenarios passed, including 40 forced races |
| Git whitespace/error check | Passed |

The PostgreSQL report adds concurrent duplicate notification inserts and read
markers to the earlier scheduling scenarios. Duplicate inserts preserve the
other writes in both transactions, and simultaneous read requests retain one
first-read timestamp and one audit. The staged backend source matches the full
suite's isolated tested snapshot. No existing database, external delivery
provider or real mobile device was used.

## Dependency hardening and independent review

The backend and web dependency update removes the known findings in both audited
package graphs, introduces a hash-locked Linux runtime graph and aligns CI on
Node 24.21.0 with immutable Action commits. JWT compatibility, enrollment-only
sessions and privileged-role approval remain tested. CI now checks isolated test
results explicitly and includes disposable PostgreSQL races. Deployment stays
disabled.

Independent review fixed ongoing-care capacity when a consultation starts early
and blocked corrupt signed notes in older clinician summary routes. Running all
existing backend phase suites also exposed transport-layer import shortcuts;
shared specialty and reviewer-decision services now remove them without changing
the API contract. The exact audit counts, test scopes, resolved harness failures
and image-build limitation are in
[the dependency update record](KAYA_DEPENDENCY_UPDATE_2026-10-04.md).

These results establish local engineering behavior. They do not sign the clinical,
privacy, provider, native-device or production-operations launch gates.

## Retained clinical corrections and client lifecycle

Completed consultations now accept attributed, chained SOAP/summary corrections
without replacing the original finalized note. Patient publication is explicit;
patients see only published summary history. Duplicate and concurrent requests
are checked under database locks, and the correction, audit and generic notice
commit together. SQLite/PostgreSQL retention guards cover finalized notes,
amendments, retained parents and the referenced follow-up task. Replacement SQL
cannot bypass these guards on SQLite's default connection settings. See
[the clinical correction contract](KAYA_CLINICAL_AMENDMENTS.md).

Web clinicians reopen completed records in the patient workspace, preserve drafts
on conflict, reconcile uncertain responses using the exact request identity and
update both record and workspace card after acknowledgment. Session changes clear
protected views; late identity responses and expired requests from a previous
account cannot replace or log out a new account. A late document download after
the owning view unmounts cannot open private bytes, and an old upload cannot start
another operation. Replacing the selected document requires fresh consent;
cancelled/invalid selections preserve the previous file and retry identity.

The whole web app now passes lint without suppressing the hook rules. Corrections
include stable context exports, loader dependencies, stale-response handling,
preserved profile edits across language changes and map popups built from text
nodes rather than interpolated HTML. CI now includes the lint check.

Final local validation for this checkpoint: 1,534 expanded backend tests passed
(176.14 seconds); 29 repository/inventory checks and 43 subtests passed; 256 web tests
passed; web TypeScript, zero-warning lint, 15 presentation checks and production
build passed. PostgreSQL 18.1 passed 15 scenarios with 50 forced races and stopped
its disposable cluster. The final backend matched the tested source snapshot.
Evidence is in
[`evidence/clinical-records-2026-10-04`](evidence/clinical-records-2026-10-04/manifest.json).

The initial web recheck used the host Node 25 binary and exposed that runtime's
localStorage compatibility failures; the pinned Node 24.21.0 run passed. Repository
checks require portable Git because the host Git is behind an unaccepted Xcode
license. Neither environment correction changed application behavior. Existing
Python deprecation and JS bundle-size warnings remain visible. No clinical gate
was signed or live migration performed.

## Paginated documents and atomic rescheduling

Patient document lists now traverse signed, owner-bound metadata pages and load
full text only on demand. The clinician workspace supplies a read-only paginated
view, with current professional/relationship checks and clean-scan enforcement
on details and originals. Unsaved patient reviews survive page failures; uncertain
web uploads retain the original file and request identity for an exact retry.

Patients can move an unpaid reservation to the same doctor's other published
slot in the same market. The original claim, new claim, revision, audit and
notices change atomically. A move requires renewed clinician acceptance. Web
recovery remains reachable after later state changes; displayed revisions stop
stale acceptance, start, check-in and preflight writes. Unstarted video
preparation resets without erasing the authored note or previous audit history.
See [the scheduling contract](KAYA_SCHEDULING.md#patient-rescheduling--4-october-2026).

The exact staged backend snapshot passed 1,634 expanded tests in 162.53 seconds;
29 repository checks plus 43 subtests passed. Web passed 286 tests in 42 files,
TypeScript, zero-warning lint, 15 prototype checks and production build.
PostgreSQL passed 23 scenarios including 75 forced races and stopped the
disposable cluster. Source hashes, test reports and retained bundle warning are
in [the checkpoint evidence](evidence/documents-rescheduling-2026-10-04/manifest.json).
The generated policy contains 280 routes with every activation flag false and
release HOLD. Native screen changes receive a separate validation checkpoint;
this record includes only their shared generated policy artifact.

## Complete list traversal, directory authority and client loading

Patient consultation history and clinician queues now use signed cursor pages
with authorization and filters applied before pagination. Patients can select
all, upcoming or past records without first loading only the newest 100. The
assigned-clinician history API uses the same bounded traversal. Next-page errors
preserve loaded rows; access loss clears clinical data and closes derived panels.
The clinician refresh action also retries nursing escalations without accepting
a late response after access changes.

Family creation/update now maps the public relationship field to its actual ORM
column; required fields cannot be cleared to null. Public doctor profiles require
an active doctor account and current credential/licence, with an explicit AO/PT
filter and authoritative practice-country output. The owner-only document request
lookup supports recovery after a device's cached upload file disappears.

Web pages load on demand with an accessible loading/error boundary. The service
worker precaches only the static shell graph and caches hashed page scripts when
visited; API/auth/prototype requests remain network-only. The compressed shell
plus landing route is 246,547 bytes versus the earlier 396,628-byte single bundle
(about 38% smaller). Previously unvisited pages need a connection. The remaining
large-shell warning is retained.

This staged backend snapshot passed 1,670 tests in 167.95 seconds, plus 29
repository checks and 43 subtests. Web passed 307 tests, TypeScript, clean lint,
15 prototype checks, production build and emitted-service-worker graph checks.
Native passed 157 tests, TypeScript and four platform/entry Hermes exports;
its existing APK remains an earlier source checkpoint. See the
[combined validation evidence](evidence/history-discovery-2026-10-04/manifest.json)
and [native source evidence](evidence/native-pages-rescheduling-2026-10-04/manifest.json).
The first expanded run exposed two test fixtures assuming an empty shared queue;
the corrected fixtures explicitly narrow to their synthetic specialty. No test
was skipped. Policy remains HOLD with 284 route declarations and no activation.

## Persisted expiry, historical records and market discovery

Unaccepted consultation requests now carry an explicit acceptance deadline and
an audited, bounded expiry operation. Reads expose open, expiry-pending or
review-required state without silently releasing a slot. The worker rechecks
locks, revision, care evidence and all linked payment history before changing
status, releasing capacity and recording a notification in one transaction.
Historical migration assigns a capped deadline where chronology is known and
retains ambiguous requests for review. No worker or live migration was activated.

Web and native clinician history can traverse older records and read the exact
completed closeout without relying on the recent-patient summary. Patient and
clinician screens show expiry and preserve exact rescheduling recovery. Public
doctor discovery defaults to Angola with explicit Portugal selection; country
changes discard stale replies and legacy kwanza prices appear only for Angola.

Any authoritative queue, escalation, history or closeout-read access denial now
closes the whole clinician page scope and invalidates late sibling replies.
Explicit retry creates a fresh scope. Ordinary refresh preserves loaded records
and open closeout state, including unsaved drafts. Uncertain amendment recovery
remains memory-only: full authority loss tears down clinical state, and restoring
access never silently recreates a correction.

The exact staged expiry backend passed 1,710 tests in 172.42 seconds. Disposable
PostgreSQL passed 28 scenarios including 90 forced races and was stopped. Web
passed 334 tests, TypeScript, zero-warning lint, 15 prototype checks, production
build and the emitted service-worker graph check, now enforced by postbuild.
Repository checks passed 29 tests and 43 subtests. Native passed 174 tests,
TypeScript and four Hermes exports. See [combined source-hashed evidence](evidence/expiry-history-2026-10-04/manifest.json) and [native export evidence](evidence/native-consultation-pages-expiry-2026-10-04/manifest.json).

Policy remains 284 routes and HOLD. The existing Android APK is the earlier
09df949 informational source snapshot with policy277; these newer JavaScript
exports do not update that APK or establish a tested operational device journey.

## Durable payment recovery and correct clinical subject boundaries

Checkout now commits an owned UUID/body identity before dispatch. Unknown
outcomes retain financial evidence and exact recovery; retries never issue a
second adapter call. The web preserves recovery after care closes, rejects
stale-session replies, avoids fabricated methods, shows server currency, and
refreshes care state only after authoritative payment application. Late or
inconsistent receipts remain financial-review items without reopening care.
Refund observations cannot be overwritten by delayed paid callbacks. See the
[operational billing contract](KAYA_PAYMENTS.md). No real money moved.

A workflow review found that the old dependent/pediatric triage selection wrote
under the account holder's patient ID. Unsupported subject/guardian/pediatric
payloads now fail before any clinical or measurement write; web/native no longer
offer that unsupported path. Family profiles remain separate from verified
representative authority. Private triage-photo reads also reject unassigned
nurses and recheck the assigned doctor's current authority, with explicit
private/no-store and nosniff headers on files and redirects.

Final staged-source validation passed 1,762 backend tests in 183.49 seconds,
29 repository checks plus 43 subtests, and 34 PostgreSQL scenarios including
114 forced races. The disposable cluster was stopped. Web passed 389 tests,
TypeScript, full lint, 15 prototype checks, production build and emitted-PWA
checks. Native passed 176 tests, TypeScript and four refreshed Hermes exports.
Evidence is retained in [the combined checkpoint](evidence/payments-subjects-2026-10-04/manifest.json) and [native subject-boundary exports](evidence/native-subject-boundary-2026-10-04/manifest.json).

This checkpoint retains policy284 and HOLD; it excludes the subsequent durable
consent adoption. The existing Android APK still represents the earlier09df949
informational/policy277 source. Provider integration, reviewed commercial prices,
refund/settlement operations, current consent adoption and clinical release
approvals are not established by these local tests.

## Durable consent and exact-text recovery

The operational API now retains immutable AO/PT catalog text and append-only
grant/refusal/withdrawal events. Empty catalogs remain unavailable; no real text
is approved or seeded. Exact UUID retries recover the original decision together
with current state. State reads use one immutable sequence prefix, preventing an
old grant view from acquiring a newer revision across a concurrent withdrawal.
Withdrawals/refusals deny older grants across translations in the same market.

Onboarding and the documented booking, triage, document, checkout and episode
flows now check current exact references. Actual care start retains an immutable
episode snapshot, allowing retained closeout/correction after later withdrawal
without inventing authority for a legacy episode. Web/native provide exact text,
separate decisions, history and owner-scoped recovery. Personal record access is
not hidden behind a blanket consent redirect. See the [runtime contract](KAYA_CONSENT_MODEL.md).

Bank references now use the full attempt UUID and ambiguous provider/reference
correlation is rejected before applying a receipt, including after a provider
await. No payment provider was enabled.

The staged checkpoint passed **1,789 backend tests** in 186.52 seconds,
**431 web tests**, **199 native tests**, TypeScript, lint, 15 presentation checks,
production build and emitted PWA checks. PostgreSQL passed **39 scenarios and
140 forced races**, then stopped. Repository checks passed 29 tests plus 43
subtests. Four platform/entry Hermes exports passed; the existing Android APK
remains an earlier source snapshot. Six built-browser scenarios passed using
only intercepted synthetic API replies; desktop and 390px screenshots were
inspected. External font requests were blocked during that browser proof; this
was not a real backend/provider end-to-end test.

Evidence: [combined checkpoint](evidence/consent-runtime-2026-10-04/manifest.json)
and [native proof](evidence/native-consent-2026-10-04/manifest.json).
Policy contains 288 routes with all activation flags false and HOLD. These counts
exclude subsequent readings/triage changes. The review also identified legacy
measurement ingestion and prescription/renewal routes needing separate consent
adoption before activation; they are not silently certified by this checkpoint.
