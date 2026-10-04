# Kaya clinical documentation & note integrity (Phase 26)

The original Phase26 module (`backend/app/note_integrity.py`) defines pure
note-integrity policy and negative tests. The October implementation now persists
finalized note digests and append-only correction snapshots in the application
models. See the [runtime correction record](KAYA_CLINICAL_AMENDMENTS.md) for the
implemented API, patient disclosure and database guards. A content digest is not
a certificate-backed digital signature or proof against a database administrator
who changes schema/data.

## Original domain-policy invariants

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

- **Runtime migration approval.** `ConsultationNotes` now carries author/time
  and a finalization digest; `ConsultationAmendment` retains attributed correction
  snapshots. SQLite/PostgreSQL triggers reject finalized-note updates/deletes,
  amendment updates/deletes and parent deletions or identity/jurisdiction changes.
  The historical cascade declarations remain for unsigned legacy records; the
  guards prevent them from deleting finalized records. An explicit migration
  installs guards on an existing database. Local SQLite and PostgreSQL evidence
  does not authorize migration of a live database.
- **Retention & medico-legal record schedule** must be set by the data
  controller / clinical owner (how long notes and amendment chains are kept, and
  the lawful basis).
- **Runtime adoption verification.** The application uses transactional
  `consultation_closeout`, `consultation_amendments` and `clinical_retention`
  services with shared integrity checks in each clinician summary reader. This
  is distinct from the pure in-memory `AmendmentLog`. The runtime currently
  supports corrections of SOAP and patient-summary text, not a wrong-patient
  retraction or changes to outcome/follow-up obligations. Those require a
  separate reviewed clinical workflow.
- **Clinical release stays HOLD.**
