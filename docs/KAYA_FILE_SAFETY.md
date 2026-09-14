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
