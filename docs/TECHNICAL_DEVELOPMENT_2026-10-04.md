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
