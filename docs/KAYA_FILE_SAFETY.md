# Kaya secure clinical file/document handling (Phase 29)

Uploads and downloads of clinical documents cannot be abused. This phase adds the
fail-closed application policy (`backend/app/file_safety.py`, domain-pure) that
complements the transport controls already in
`backend/app/services/health_storage.py` (private ACL, `private, no-store`,
traversal-safe unguessable keys, short-lived signed URLs, no persisted SAS).

## Invariants enforced

- **Upload validation (fail-closed).** `validate_upload` requires an allowlisted
  content type (PDF / JPEG / PNG / TIFF), an extension that matches the type, a
  size within `MAX_UPLOAD_BYTES` (25 MiB), and **magic bytes that match the
  declared type** — a renamed executable (`report.pdf` whose bytes are `MZ…`) is
  rejected. Empty files and missing names are rejected.
- **Malware-scan gate.** `download_allowed` returns true only for `clean`; a file
  that is not yet scanned (`pending`), `infected`, or a scan `error` is blocked.
  `quarantined` marks infected/error.
- **Authorization on every access (no IDOR).** `authorize_access` never trusts
  possession of a key: a clinician must be assigned to the file's episode, in-org,
  with `clinical_read`; a patient must be the file's own subject. `require_access`
  raises `FileAccessDenied` otherwise, and `can_download` requires *both*
  authorization and a clean scan.
- **Storage / URL guardrails.** `is_safe_key` rejects traversal/null/bad segments
  and enforces the `health/` prefix; `is_unguessable_key` requires random entropy
  so keys are not enumerable from a patient/consultation id; `signed_url_ttl_ok`
  bounds URL lifetime (≤ 1 h); `persisted_url_prohibited` detects a signed
  URL/SAS that must never be stored in a DB field; `reject_public_acl` refuses any
  non-private ACL; `bucket_must_be_private` asserts no public access.

## Tests — `backend/phase29_tests/test_file_safety.py` (20, all passing)

Valid PDF/image accept; disallowed type, extension mismatch, magic-byte mismatch
(renamed exe), oversize, empty/missing-name reject; download only when clean and
quarantine states; assigned-clinician authorized while unassigned/other-org/
no-privilege denied even with the key; patient own-file only; require_access
raises; can_download needs authorized + clean; safe/unguessable key checks;
signed-URL TTL bounds; persisted signed-URL detection; public ACL refused; bucket
privacy.

## Human intervention / external gates

- **Malware-scanning service (owner-bound, BLOCKED_EXTERNAL).** The scan gate is
  policy; wiring a real scanner (ClamAV / cloud AV) that sets `clean`/`infected`
  before any download is an operational integration a named security owner must
  provision and approve. Until then files stay `pending` and are not downloadable.
- **Encryption at rest & key management.** A named owner must confirm
  storage-side encryption and key management for the chosen provider/region.
- **Metadata/EXIF stripping.** A named owner decides PHI-metadata handling
  (e.g. stripping EXIF/geolocation from images) before storage.
- **Retention schedule** for clinical documents set by the data controller.
- **Runtime adoption verification** — a harness-verified task must confirm the held
  upload/download endpoints consume `validate_upload`, the scan gate, and
  `authorize_access`.
- **Clinical release stays HOLD.**

## Patient document runtime — 4 October 2026

The new `/api/v1/patient-documents` routes adopt the upload/type/signature policy
with a narrower PDF/JPEG/PNG allowlist and 10 MiB limit. Originals are private,
immutable storage objects. The database records the content hash, extraction
state, original extracted text and separate patient-reviewed text. Upload retries
use an owner-scoped idempotency key; process/review writes use a version check.
Audits commit with state changes and omit filenames and document contents.

Uploading and processing are disabled by default. Enabling this workflow requires
`PATIENT_DOCUMENTS_ENABLED` plus a deliberately configured private
`PATIENT_DOCUMENT_CLAMAV_HOST` and port. Configuration availability is not a health
check: a scanner failure is reported as a processing failure and cannot mark a
file clean. The ClamAV service, network isolation, scanner signature updates and
storage provisioning are separate operational work; no live service was enabled
during development. The daemon's `StreamMaxLength` must accept the 10 MiB upload
limit; scan/decompression limits and alerts for exceeded limits must be validated
so skipped content is not treated as a clean result. The adapter follows the
[ClamAV INSTREAM protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html),
with a total socket-operation deadline and exact clean-response matching.

Only a clean scan permits extraction or original download. Pending, infected and
scanner-error files cannot be downloaded. Downloads use authenticated bytes with
attachment, `private, no-store` and `nosniff` headers, and verify the stored hash
again. A patient can review their own documents; doctors need current professional
authority and the existing accepted-care relationship, and have read-only access.
Possession of a document ID does not grant access.
Patients use `/api/v1/patient-documents/page`; the doctor workspace uses
`/api/v1/patient-documents/patients/{patient_id}/page`. These return metadata and
an opaque next cursor, with 20 items by default and an enforced maximum of 100.
The signed cursor is bound to the authenticated viewer, patient and list scope;
authorization is rechecked on every page and detail request. Ordering uses UTC
creation time and ID so equal timestamps do not lose records. Metadata queries
omit extracted text and private storage identifiers. Full text and original
downloads load only when requested, and clinician details require a clean scan.
The legacy array endpoint retains its shape with a bounded limit and next-page
Link header. Older aggregate patient-summary responses still cap document
metadata at 100; the workspace document tab provides the complete paginated view.

Text-bearing PDFs are read locally with pinned pypdf, without an external model.
The parser runs in a short-lived process with a 10-second wall timeout and CPU
limits. Linux also applies a 512 MiB address-space limit; that memory limit is
not enforced on macOS. The parser accepts at most 40 pages and 100,000 extracted
characters. Encrypted, image-only, partly readable or oversized-content PDFs
return an explicit manual-review condition; text is never silently declared
complete when an entire page has no readable text. These controls are not a full
OS sandbox or certification of extracted content. See the
[pypdf extraction limitations](https://pypdf.readthedocs.io/en/stable/user/extract-text.html).

Patient confirmation is an attestation of their review, not clinician validation.
It does not populate diagnoses, medications, device readings or prescriptions.
The clinician workspace has a read-only document tab; it does not turn patient
review into clinical validation. Scanned-document/image OCR, production scanner
validation and retention/deletion operations remain further work. Existing credential,
triage-photo and generated-prescription endpoints are outside this runtime
adoption claim.

The native patient client now selects PDF as well as JPG/PNG. A cached-file byte
size check enforces the narrower server/10 MiB limit before upload, and invalid
or cancelled selection preserves the previous request. A valid replacement needs
fresh consent. Web and native do not interpret a successful picker or upload as a
clean malware scan or a clinically validated reading. See
[native validation](KAYA_NATIVE_BUILD_2026-10-04.md#pdf-selection-session-isolation-and-offline-android-smoke).

Native metadata pages and detail loading now match the web workflow. A bounded,
owner-scoped SecureStore record retains the pending upload UUID, explicit consent
and cached-file reference across restart. The owner-only
`/api/v1/patient-documents/requests/{idempotency_key}` lookup recovers a committed
document without that file. A missing result never proves a concurrent request
cannot commit. Explicitly discarding local recovery requires a history-review
acknowledgement and does not delete the server document. No document bytes or
extracted text are stored in the recovery reference.

On web, an upload with an unknown result locks replacement and consent controls
until the exact request can be retried. A later generic failure does not prove
the first attempt was absent. Keep the page open during this recovery: browser
file bytes are held in memory and are not persisted across reloads. Pagination,
detail errors and refresh do not discard an unsaved patient-review draft.
