# KAYA conversation and product synthesis

Last updated: 2026-07-29

This note consolidates the KAYA-related product context visible in the project
history and connected conversations. Conversation content was treated as product
context and checked against the repository before implementation.

## Product direction that repeats across the conversations

- `health-` / `kaya-web` is the single source of truth. The separate
  `kaya-ios` repository is an older duplicate.
- KAYA is a personal health account plus clinician marketplace, telemedicine,
  triage, home monitoring, clinic overflow and connected-device platform.
- The public product consists of a responsive web/PWA, one Expo application for
  iOS and Android, and a shared FastAPI API/database.
- Triage provides orientation and escalation, never a diagnosis. Fixed clinical
  red flags must override automated or visual suggestions.
- Health photographs and documents must be private, consented, auditable and
  available only to a patient and an appropriately linked clinical professional.
- Patient-facing multilingual coverage and low-bandwidth/mobile usability are
  higher priority than broad but disconnected UI-only modules.
- External launch gates remain legal entity, clinical governance, jurisdiction,
  provider contracts, payment/email credentials, app-store accounts and a
  security/clinical validation programme.

## Feature adapted from the “Impetigo en niños” conversation

The useful feature is not image diagnosis. It is a safe photo-assisted,
standardised triage:

1. Detect a complaint category where a photograph may help (`skin` or `injury`).
2. Proactively invite, but never require, three photographs:
   orientation, surrounding context and close-up.
3. Explain that photographs are for clinician review and are not interpreted by
   KAYA in the current release.
4. Remove metadata in the browser, resize the image and run non-medical
   brightness/resolution checks.
5. Ask structured visible-feature questions about crusting, discharge, open
   skin, blisters, spreading redness, swelling, red streaks, dark skin damage,
   sensitive locations and general condition.
6. Apply deterministic red-flag and urgency rules. Images cannot lower urgency.
7. Expose the photographs only to the patient and the doctor linked through the
   associated consultation, with an audit event for upload.

## Implemented in this pass

- Private triage-photo model, migration, storage and authenticated APIs.
- JPEG/PNG/WebP type, signature, size and three-view limits.
- Replacement of an existing view without creating duplicates.
- Deletion of stored photo objects when the triage is deleted.
- Responsive three-view capture guide with explicit consent and four-language
  copy.
- Client-side metadata removal, resizing, brightness and resolution checks.
- Configuration-driven visual questions and red-flag rules.
- Active accepted consultations remain in the doctor work queue.
- Clinician photo-review panel with an explicit non-AI interpretation boundary.
- Safe rendering of FastAPI validation errors so a structured 422 response
  cannot crash the login, registration or triage interface.
- Integration tests for privacy, linked-doctor access, replacement uploads,
  unsupported content and visual red-flag escalation.
- Complete Expo patient triage flow using the same backend questions and fixed
  red-flag engine as the web application.
- Optional three-view mobile camera/gallery capture with explicit consent,
  client-side JPEG re-encoding, resizing and low-resolution warnings.
- Native iOS/Android camera and photo-library permission copy, plus a mobile
  emergency boundary that sends immediate danger to 112 instead of triage.
- Patient-controlled permanent removal of individual triage photographs on web
  and mobile, with ownership checks, storage deletion and an audit event.
- Patient-owned ZIP export containing sanitized photographs and a versioned
  manifest with integrity checksums, without exposing private storage keys.
- Linked clinicians can request a specific additional view with guidance; the
  owning patient receives an in-app notification and can fulfil the request on
  web or mobile even after the original triage is completed.
- Photo requests are idempotent, audited and automatically marked fulfilled on
  upload; deleting the requested image reopens the request.

## Next coherent priorities

1. Add resumable/offline photo drafts for low-bandwidth use.
2. Add a governed retention schedule for photographs after clinical and legal
   approval of the required periods in each launch jurisdiction.
3. Add structured clinician annotations without diagnostic AI.
4. Build a de-identified, clinician-labelled validation dataset only after
   consent, governance and retention rules are approved.
5. Consider vision AI only as a separately validated feature that may escalate,
   request another image or decline assessment; it must never override a fixed
   red flag or claim a confirmed diagnosis.
