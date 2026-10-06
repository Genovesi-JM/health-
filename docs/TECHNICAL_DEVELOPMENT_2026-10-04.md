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

Local results on 4 October 2026: **258 backend tests passed** (including 26 new
lifecycle cases), **19 web tests passed** (including six new interaction tests),
**15 existing prototype checks passed**, web production build passed, and mobile
TypeScript check passed. The web build still reports a pre-existing large-bundle
warning. Native-device and production-database testing were not performed.

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

1. Replace the fixed 50,000 AOA consultation checkout with an explicit server-side
   price quote and immutable accepted amount/currency. Clinician `price_min` and
   `price_max` are ranges and cannot safely be treated as a final quote.
2. Make concurrent checkout, provider switching and webhook reconciliation
   idempotent; exercise failure, refund and settlement paths in a provider sandbox.
3. Complete clinical closure: require the appropriate clinician-authored outcome,
   owner and follow-up tasks; distinguish ending a video call from closing care.
   Current optional SOAP fields and video completion remain separate gaps.
4. Audit remaining family/consent, revoked-credential and patient-record access
   paths; validate revocation across every endpoint. This change is not a full
   authorization audit.
5. Add capacity/slot conflict handling, expiry of unaccepted requests, persistent
   notifications and staging end-to-end tests against the deployment schema.
6. Upgrade Expo incrementally, then test authentication, secure storage,
   HealthKit/Health Connect, background behavior and store builds. Keep `health-`
   canonical and do not fork a second native app.

The existing standalone presentation prototype is separate from these real
application routes. Its simulated bookings are not production consultations.
