# Kaya consent evidence and runtime enforcement

Updated 4 October 2026. **Clinical release remains HOLD.** The operational API now
stores exact-text consent evidence; this is an engineering implementation, not
approval of a legal document or a lawful basis for processing. There is no
runtime-seeded approved catalog. An empty catalog cannot authorize new care.

## Catalog and decision ledger

`ConsentCatalogDocument` stores immutable UTF-8 text, SHA-256, integer version,
country (AO/PT), language, purpose, kind, required flag, title, approved source and
effective interval. The latest effective version for that purpose/language/market
wins. A newer draft, retired or revoked version blocks fallback to an older
approved version. Publish corrections or retirement as new rows; do not mutate
old accepted text. The migration neither approves text nor upgrades legacy data.

`PatientConsentEvent` appends the exact document reference, owner/actor, action
(grant/refuse/withdraw), global patient sequence, UUID, request digest and time.
Decisions require the displayed revision. A patient lock serializes competing
choices; an old in-flight grant cannot overwrite a later withdrawal. Exact-key
replay returns the original event plus current state, even if the catalog changes.
Withdrawal or refusal prevents older grants for the same purpose in any language
of that market from remaining effective. A later explicit grant must still match
the currently displayed text and language; AO and PT are separate scopes.
A lookup 404 explicitly does not prove an in-flight request cannot commit. Only a
locked `consent_not_committed` response permits discarding that exact request.

SQLite/PostgreSQL guards retain catalog, decisions and episode snapshots against
update/delete and replacement collisions, including parent identity changes.
`PatientConsent` type-only rows remain historical, nonauthoritative evidence;
new exact-text decisions do not mint those rows. Client checkboxes and local
storage never provide server authority.

The five currently required purposes are `privacy_policy`,
`telemedicine_consent`, `terms_of_service`, `health_data_processing` and
`medical_disclaimer`. Optional purposes remain separate; uploading a triage
photo additionally requires `images`; device acquisition, synchronization and CSV
imports additionally require `devices`. Counsel and clinical owners must approve
whether these purposes/kinds and their lawful-basis mapping are appropriate.

## Operational coverage

Fresh onboarding completion records the displayed five exact references and
profile changes in one transaction. Booking, rescheduling, acceptance/start,
triage start/answers/completion, manual/device measurement writes, private
document upload/processing/review and fresh consultation checkout validate the applicable server state. New bookings,
triage, measurement writes and document uploads explicitly select AO or PT; no historical market is
inferred from a current profile. The language of the evidence is distinct from a
user's communication preference.

At actual consultation start, `ConsultationConsentSnapshot` retains the exact
valid grant IDs and a digest bound to the episode. A later withdrawal does not
erase that episode or prevent its retained closeout/correction workflow. Legacy
started episodes without evidence require explicit review; later grants do not
silently manufacture past authority. Personal document detail/download/export,
consultation history, cancellation and consent history remain available subject
to the user's normal ownership/session checks after withdrawal.

This is coverage of the listed operational routes. It does not certify all legacy
features, third-party delivery, device bridges, AI/OCR, recording or vendor
transfer, nor does it enable any of them. The default API entrypoint is still
HOLD and the native entrypoint informational. See the [measurement contract](KAYA_READINGS.md)
for device preflight, immutable import scope and retained personal history. Legacy
renewal and prescription generation still require separate runtime adoption.

## Web and native behavior

Both clients display exact server text, title, purpose and version, with separate
choices and visible AO/PT selection (Angola first). Missing documents are shown
as unavailable. Onboarding does not prefill approvals from old checkboxes.
History and settings remain reachable; a blanket consent redirect is not used
to withhold personal records.

Before an action is sent, web localStorage or native SecureStore saves only its
owner, UUID and exact reference/body. Ambiguous replies preserve this identity;
recovery never substitutes a newer document, revision or account. Access loss
clears displayed evidence and rejects late sibling replies. These are recovery
references, not copies of legal text or evidence that a grant is effective.

## API contract

- `GET /api/v1/compliance/catalog?country=AO&language=pt`: available documents and
  missing required purposes; authenticated read.
- `GET /api/v1/compliance/consent-state?country=AO&language=pt`: current patient
  revision and purpose states; a profile may not exist yet during onboarding.
- `POST /api/v1/compliance/consent`: UUID `Idempotency-Key` and exact
  `document_id`, `version`, `content_hash`, `country`, `language`, `action` and
  `expected_revision`. Legacy type-only submissions are rejected.
- `GET /api/v1/compliance/consent-requests/{request_key}`: owner-only exact receipt
  recovery; absence is not proof of failure.
- `GET /api/v1/compliance/consent-history/page`: bounded owner cursor history.
- `GET /api/v1/compliance/consents`: legacy records, explicitly ineffective.

The additive `consent_runtime_v1` migration leaves historical scope unknown and
creates no grants. Its downgrade refuses to destroy retained evidence. Run the
migration in reviewed staging before a real rollout; no live schema was changed
by this checkpoint. Tests use explicitly labelled synthetic text fixtures only.

## Remaining authority and release work

The Phase 15 `backend/app/consent.py` module remains a separately tested domain
specification, including representative authority. Family profile CRUD does not
implement that verified authority. Dependent/guardian/pediatric triage is
rejected before clinical writes. Real representative/minor/capacity rules,
operator-controlled catalog publication/review, approved texts, lawful bases and
retention obligations remain owner-bound release work. No real catalog, clinic,
clinical lead or release approval is invented by these tests.
