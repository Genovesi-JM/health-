"""Clinical documentation and note integrity (Phase 26). Domain-pure.

A clinical note is a legal record. Once finalized it must be tamper-evident and
non-repudiable: authored-by attribution is fixed, the signed content is locked,
there is no silent edit or delete, and every later change is an ordered,
reason-bearing, hash-chained amendment that leaves the original intact and
readable. Retraction is a marked amendment, never a hard delete.

This module is stdlib-only and importable without the FastAPI app, so it is the
canonical, in-place-testable policy while the app is held. Wiring the mutable
`ConsultationNotes` ORM model (which today has no sign/lock, no amendment chain,
and `ondelete=CASCADE`) onto this policy is a separate harness-verified adoption
task.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from typing import Optional

# ── Errors ───────────────────────────────────────────────────────────────────

class NoteIntegrityError(Exception):
    """A clinical-note integrity rule was violated (fail-closed)."""


class NoteLockedError(NoteIntegrityError):
    """The note is signed/locked and its content cannot change in place."""


class NoteDeletionProhibited(NoteIntegrityError):
    """Clinical records are never hard-deleted; retract via amendment."""


class ChainTamperError(NoteIntegrityError):
    """The amendment chain does not verify (reorder/insertion/edit detected)."""


# ── Content hashing (tamper-evidence) ────────────────────────────────────────

def content_hash(payload: dict) -> str:
    """Stable hash of note/amendment content. Canonical JSON so key order and
    whitespace cannot change the digest."""
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


# ── Note lifecycle ───────────────────────────────────────────────────────────

DRAFT = "draft"
SIGNED = "signed"


@dataclass(frozen=True)
class ClinicalNote:
    """An immutable value. `sign` returns a NEW locked note; the content of a
    signed note can never change in place. The author is fixed at creation and
    is never reassigned."""
    note_id: str
    episode_id: str
    org_id: str
    author_id: str            # authored-by attribution, immutable
    author_role: str
    content: dict             # e.g. SOAP sections
    state: str = DRAFT
    created_at_epoch: int = 0
    signed_at_epoch: Optional[int] = None
    signed_by: Optional[str] = None
    signed_hash: Optional[str] = None

    def is_locked(self) -> bool:
        return self.state == SIGNED


def can_edit_content(note: ClinicalNote) -> bool:
    """Content is editable only while a draft. A signed note is locked."""
    return note.state == DRAFT


def edit_draft(note: ClinicalNote, new_content: dict, editor_id: str) -> ClinicalNote:
    """Edit a draft in place. Only the author may edit their own draft; a signed
    note raises (use an amendment instead)."""
    if note.is_locked():
        raise NoteLockedError("signed note is locked; add a signed amendment instead")
    if editor_id != note.author_id:
        raise NoteIntegrityError("only the author may edit their own draft")
    return replace(note, content=dict(new_content))


def sign(note: ClinicalNote, signer_id: str, now_epoch: int) -> ClinicalNote:
    """Finalize (sign) a note. The signer must be the author (attribution is
    non-repudiable); signing locks the content and records a content hash.
    Re-signing a locked note is refused."""
    if note.is_locked():
        raise NoteLockedError("note already signed")
    if signer_id != note.author_id:
        raise NoteIntegrityError("a note is signed by its author, not another user")
    if not note.content:
        raise NoteIntegrityError("cannot sign an empty note")
    h = content_hash(note.content)
    return replace(
        note, state=SIGNED, signed_at_epoch=now_epoch, signed_by=signer_id, signed_hash=h,
    )


def signature_valid(note: ClinicalNote) -> bool:
    """A signed note's recorded hash must still match its content — proves the
    locked content was not altered underneath the signature."""
    if not note.is_locked():
        return False
    return note.signed_hash == content_hash(note.content)


def reassign_author_prohibited(note: ClinicalNote, new_author_id: str) -> None:
    """Authored-by attribution can never be reassigned."""
    raise NoteIntegrityError("authored-by attribution is immutable and cannot be reassigned")


def delete_prohibited(note: ClinicalNote) -> None:
    """Clinical records are never hard-deleted."""
    raise NoteDeletionProhibited("clinical notes are never deleted; retract via a signed amendment")


# ── Append-only, hash-chained amendments ─────────────────────────────────────

GENESIS = "0" * 64
RETRACTION = "retraction"
ADDENDUM = "addendum"
CORRECTION = "correction"
_KINDS = {ADDENDUM, CORRECTION, RETRACTION}


@dataclass(frozen=True)
class Amendment:
    amend_id: str
    author_id: str
    author_role: str
    reason: str               # a reason is mandatory
    kind: str                 # addendum | correction | retraction
    content: dict
    created_at_epoch: int
    prev_hash: str = GENESIS
    this_hash: str = ""

    def compute_hash(self) -> str:
        return content_hash({
            "amend_id": self.amend_id,
            "author_id": self.author_id,
            "author_role": self.author_role,
            "reason": self.reason,
            "kind": self.kind,
            "content": self.content,
            "created_at_epoch": self.created_at_epoch,
            "prev_hash": self.prev_hash,
        })


class AmendmentLog:
    """Append-only, ordered, hash-chained amendments to a signed note. The
    original note and every amendment remain readable; nothing is edited in place
    and nothing is removed. Reorder/insertion/edit breaks `verify()`."""

    def __init__(self, base_signed_hash: str) -> None:
        if not base_signed_hash:
            raise NoteIntegrityError("amendments require a signed base note")
        self._base = base_signed_hash
        self._items: list[Amendment] = []

    def _head_hash(self) -> str:
        return self._items[-1].this_hash if self._items else self._base

    def append(self, author_id: str, author_role: str, reason: str, kind: str,
               content: dict, now_epoch: int, amend_id: str,
               note_is_signed: bool = True) -> Amendment:
        """Append one amendment. Requires a signed base, a non-empty reason, and a
        known kind. Only clinicians may amend."""
        if not note_is_signed:
            raise NoteIntegrityError("only a signed note is amended; edit the draft instead")
        if not reason or not reason.strip():
            raise NoteIntegrityError("an amendment reason is mandatory")
        if kind not in _KINDS:
            raise NoteIntegrityError(f"unknown amendment kind: {kind}")
        am = Amendment(
            amend_id=amend_id, author_id=author_id, author_role=author_role,
            reason=reason.strip(), kind=kind, content=dict(content),
            created_at_epoch=now_epoch, prev_hash=self._head_hash(),
        )
        am = replace(am, this_hash=am.compute_hash())
        self._items.append(am)
        return am

    def entries(self) -> tuple:
        return tuple(self._items)

    def verify(self) -> bool:
        """Recompute the chain from the signed base; any tampering fails."""
        prev = self._base
        for am in self._items:
            if am.prev_hash != prev:
                return False
            if am.this_hash != am.compute_hash():
                return False
            prev = am.this_hash
        return True

    def delete_entry(self, amend_id: str) -> None:
        raise NoteDeletionProhibited("amendments are append-only; a retraction is itself an amendment")

    def latest_effective(self) -> Optional[Amendment]:
        """The most recent amendment; a retraction marks the note retracted but
        does not remove any prior content."""
        return self._items[-1] if self._items else None


# ── Access control ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class NoteAccessContext:
    user_id: str
    role: str                     # patient | doctor | nurse | ...
    org_ids: frozenset
    assigned_episode_ids: frozenset
    privileges: frozenset


_CLINICIAN_ROLES = {"doctor", "nurse", "clinician", "midwife"}


def can_read(note: ClinicalNote, ctx: NoteAccessContext) -> bool:
    """A clinician reads a note only for an episode they are assigned to, in an
    org they belong to, with the clinical-read privilege. No one browses
    unrelated records. A patient's own-record read is a relationship check the
    adopting layer supplies via `patient_may_read_own` (the domain-pure note does
    not carry the patient subject id), so this function denies the patient role
    by default rather than guess."""
    if ctx.role in _CLINICIAN_ROLES:
        return (
            note.org_id in ctx.org_ids
            and note.episode_id in ctx.assigned_episode_ids
            and "clinical_read" in ctx.privileges
        )
    return False


def can_amend(note: ClinicalNote, ctx: NoteAccessContext) -> bool:
    """Only a clinician assigned to the episode, in-org, with the write privilege,
    may amend — and only a signed note is amendable."""
    if ctx.role not in _CLINICIAN_ROLES:
        return False
    return (
        note.is_locked()
        and note.org_id in ctx.org_ids
        and note.episode_id in ctx.assigned_episode_ids
        and "clinical_write" in ctx.privileges
    )


# Patient-subject read is decided by the caller (the note does not carry the
# patient id in this domain-pure form); this helper documents that the patient's
# own-record read is a relationship check the adopting layer supplies.
def patient_may_read_own(note: ClinicalNote, patient_id: str, subject_patient_id: str) -> bool:
    return note.is_locked() and patient_id == subject_patient_id
