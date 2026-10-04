# Kaya development readiness — 4 October 2026

**Clinical launch: HOLD. Angola first, initially Luanda; Portugal prepared in the
same codebase.** This record describes local implementation and validation. It
does not certify a remote deployment, an operational provider, clinical practice
or legal compliance. The responsive web/PWA pilot remains the first delivery
priority, followed by standalone Kaya apps for Android and iOS.

## Implemented and locally exercised

| Area | Current implementation | Evidence / practical limit |
| --- | --- | --- |
| AO/PT foundation | Explicit service country, professional authority and clinic timezone; Angola/Luanda and Portugal/Lisbon/Madeira/Azores formatting and DST handling | Market configuration grants no cross-border care permission |
| Consent | Durable exact-text AO/PT catalog, append-only decisions and withdrawal, retained episode authority, web/native review and recovery | [Consent runtime](KAYA_CONSENT_MODEL.md); no approved texts seeded, no human release approval |
| Accounts | Patient onboarding, professional enrollment/review and privileged MFA checks; session restoration uses server identity | Account changes invalidate old clinical views and pending identity responses |
| Documents | Private PDF/JPEG/PNG upload, exact retry identity, scanner gate, local text-PDF extraction, separate patient review, paginated metadata, lazy details and clinician read-only web view | [Document runtime](KAYA_FILE_SAFETY.md); image/scanned-PDF OCR and production scanning are not validated |
| Scheduling | Published dated slots, pending clinician acceptance, atomic capacity checks, cancellation release, rescheduling with renewed acceptance and persisted request expiry | [Scheduling](KAYA_SCHEDULING.md), [booking](KAYA_BOOKING.md); real local PostgreSQL races; expiry worker is implemented but not activated |
| Consultation history | Patient and assigned-clinician cursor pages on web/native, with all/upcoming/past filters and direct access to older completed records | Loaded counts are not total counts; clinician historical closeout is read-only; current authorization is required |
| Consultation record | Attributed finalized closeout, explicit patient summary, linked follow-up and verified readers | [Retained corrections](KAYA_CLINICAL_AMENDMENTS.md); original note retained with separate, explicitly published amendments |
| Notifications | Transactional core-workflow notices, owner-scoped cursor inbox and acknowledged read state on web/native | [Notification contract](KAYA_NOTIFICATIONS.md); email/SMS/push are unavailable |
| Payment recovery | Durable exact checkout identity, uncertain-outcome retention, owner recovery and separation of financial receipts from care eligibility | [Billing contract](KAYA_PAYMENTS.md); synthetic adapters only in validation, no provider activation or approved commercial quote |
| Web quality | Strict lint, typed error handling, async lifecycle/account isolation, safe map popup rendering | Interaction, build, presentation and TypeScript checks; remote browser/staging validation remains separate |
| Native packaging | Expo57/RN0.86 standalone branded Android test APK with embedded Hermes; operational navigator exports for both platforms | [Native build record](KAYA_NATIVE_BUILD_2026-10-04.md); packaged entry is informational and test-signed |
| Dependencies and CI | Hash-locked backend deploy/test graphs, pinned Node, immutable GitHub Action SHAs, backend/web zero-finding package audits, native SBOM | [Dependency record](KAYA_DEPENDENCY_UPDATE_2026-10-04.md); two native tooling advisory IDs remain unresolved |

## Current entrypoints

The default FastAPI entrypoint `app.main` serves the launch-hold boundary. The
operational API is tested only in disposable synthetic environments. The web
`App.tsx` mounts `LegacyApp`; its request gate requires explicit
`VITE_OPERATIONAL_HOLD=true` to block operational calls. A false policy feature
flag alone is not a web request gate. The native `App.tsx` remains informational.
The Pages deployment job is disabled. Existing remote deployments were not
inspected or changed by these local checkpoints.

## Work still required

These are explicit outstanding items, not hidden behind passing test counts:

- Confirm the actual invited-pilot scope and implement any additional workflows
  it requires. Request expiry and bounded consultation history are implemented;
  the expiry worker still needs a reviewed deployment schedule and monitoring. Native
  clinician closeout editing, embedded video and scanned-document OCR are not
  implemented by the patient-native/source-export work.
- Obtain and publish owner-approved, versioned consent documents for each
  market through a reviewed catalog publication process. Exact-text runtime
  decisions and withdrawal are implemented for the routes documented in the
  [consent contract](KAYA_CONSENT_MODEL.md); no real approved catalog is present.
  Family profile CRUD does not establish verified guardianship or delegated care.
  Unsupported dependent/guardian/pediatric triage entry now fails before any
  clinical record or measurement is created. The draft pilot's invitation,
  adult eligibility, named-clinic admission limits and staffed coverage still
  require operational enforcement against the eventually approved scope.
- Choose and provision approved video, email/SMS/push, private storage/scanning
  and recovery infrastructure. Complete provider adapters, durable external
  delivery, failure handling and real sandbox integration tests. Existing
  legacy best-effort notification callers need separate transactional adoption.
- Resolve or obtain named security-owner disposition of the two unpatched
  native-toolchain advisories. Validate the built container and target host;
  Docker Desktop was unavailable for local image validation.
- Build iOS with an accepted/licensed Xcode setup and test complete patient and
  clinician journeys on physical iOS/Android devices. Verify health bridges,
  SecureStore, background behavior, accessibility and poor connectivity. Local
  test signing is not App Store/Play Store distribution signing.
- Exercise the real deployment schema, migration, encrypted backup/restore,
  monitoring, rollback and role journeys in isolated staging. A disposable
  PostgreSQL test is not a production topology or restore drill.
- Record named clinic/operator, clinical, privacy, retention, support and release
  approvals for Angola; evaluate Portugal separately. The
  [20-gate readiness register](KAYA_PILOT_READINESS.md) remains unsigned.
- Complete payments, refunds, settlement and reconciliation **last**, with the
  agreed provider, authoritative server quotes, currency and sandbox evidence.
  No production money movement is authorized or claimed here.

No live database was migrated, provider enabled, patient enrolled, deployment
made, store submission sent or third-party terms accepted during this work.

## Validation records

Historical counts and source-hashed evidence are retained in the individual
checkpoint records. Final clinical/client verification is recorded in
[the technical development log](TECHNICAL_DEVELOPMENT_2026-10-04.md). Later changes
do not retroactively turn an earlier source snapshot into evidence for the new
snapshot. Existing deprecation and bundle-size warnings remain visible.
