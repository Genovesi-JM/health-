# Kaya clinical documentation & note integrity (Phase 26)

A clinical note is a legal record. Once finalized it must be tamper-evident and
non-repudiable. This phase ships the canonical, domain-pure policy
(`backend/app/note_integrity.py`) with negative tests; wiring the existing
mutable ORM model onto it is a separate adoption gate.

## Invariants enforced

- **Authored-by is immutable.** The author is fixed at creation; there is no code
  path to reassign it (`reassign_author_prohibited` always raises).
- **Signing locks content.** `sign(note, signer, now)` may be done only by the
  author, refuses an empty note, and returns a new `SIGNED` note carrying a
  content hash. A signed note cannot be edited in place (`edit_draft` raises
  `NoteLockedError`) and cannot be re-signed. `signature_valid` recomputes the
  hash, so any out-of-band mutation of locked content is detectable.
- **No silent edit or delete.** Drafts are editable only by their author; a
  signed note changes only through an amendment. Hard delete is prohibited
  (`delete_prohibited` / `AmendmentLog.delete_entry` raise
  `NoteDeletionProhibited`).
- **Append-only, hash-chained amendments.** `AmendmentLog` chains each amendment
  to the signed base and the prior amendment (`prev_hash`→`this_hash`). Every
  amendment carries a **mandatory reason**, an author, a timestamp, and a known
  **kind** (`addendum` | `correction` | `retraction`). `verify()` recomputes the
  whole chain from the signed base, so any reorder, insertion, or in-place edit
  is detected.
- **Retraction is an amendment, not a delete.** A wrong-patient or erroneous note
  is retracted by appending a `retraction`; all prior content stays present and
  readable.
- **Access is scoped.** `can_read` admits a clinician only for an assigned
  episode, in-org, with `clinical_read`; `can_amend` additionally requires a
  signed note and `clinical_write`. The patient role is denied by default here —
  a patient's own-record read is a relationship check the adopting layer supplies
  via `patient_may_read_own` (the domain-pure note does not carry the patient
  subject id). No one browses unrelated records.

## Tests — `backend/phase26_tests/test_note_integrity.py` (21, all passing)

Author-only draft edit; sign locks + records hash; signed note cannot be edited,
re-signed, or signed empty/by a non-author; tampered locked content fails the
signature; attribution cannot be reassigned; hard delete prohibited; amendments
require a signed base, a reason, and a known kind; the chain appends and
verifies; a reordered/edited chain fails `verify`; amendment delete prohibited;
retraction is an amendment that removes nothing; and access is scoped by
episode/org/privilege with patient self-read delegated.

## Human intervention / external gates

- **ORM adoption (owner-bound).** The live `ConsultationNotes` model
  (`backend/app/health_models.py:421`) is today mutable, has no sign/lock state,
  no amendment chain, and `ondelete=CASCADE` (a consultation delete would remove
  the note). A named clinical-systems owner must approve the migration that adds
  the signed-hash/lock columns and the amendment table, removes the cascade
  hard-delete, and routes edits through this policy. The agent prepares the
  policy and tests; it does not migrate a live database.
- **Retention & medico-legal record schedule** must be set by the data
  controller / clinical owner (how long notes and amendment chains are kept, and
  the lawful basis).
- **Runtime adoption verification** — a harness-verified task must confirm the
  held note endpoints consume `note_integrity` (sign, amend, access) once the
  model is adopted.
- **Clinical release stays HOLD.**
