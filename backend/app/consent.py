"""Versioned consent ledger and representative authority (Phase 15).

Server-owned, append-only proof of exactly which approved text and language a
subject (or authorized representative) saw, and what action occurred. Consent is
purpose-specific and versioned; a stale, unknown, untranslated, missing, or
mismatched version fails closed. Optional purposes are never bundled with
necessary care, and withdrawal stops future optional processing without deleting
legally-required records. Domain-pure and importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# Consent kinds are kept distinct — never bundled.
NECESSARY_KINDS = frozenset({"clinical_informed_consent", "privacy_notice", "contract"})
OPTIONAL_KINDS = frozenset({"ai", "images", "recording", "marketing", "research", "devices", "vendor_transfer"})


@dataclass(frozen=True)
class ConsentDocument:
    doc_id: str
    version: int
    content_hash: str          # immutable hash of the exact approved text
    jurisdiction: str
    language: str
    purpose: str
    kind: str                  # one of NECESSARY_KINDS | OPTIONAL_KINDS
    required: bool
    effective_from: datetime
    effective_to: Optional[datetime] = None
    supersedes: Optional[int] = None
    approved_source: Optional[str] = None   # None ⇒ unapproved ⇒ fails closed


@dataclass(frozen=True)
class ConsentRecord:
    subject_id: str
    doc_id: str
    version: int
    content_hash: str
    action: str                # grant | refuse | withdraw
    timestamp: datetime
    actor_id: str
    language: str
    notice_evidence: str
    representative_id: Optional[str] = None
    capability_state: Optional[str] = None


@dataclass
class RepresentativeAuthority:
    representative_id: str
    subject_id: str
    relationship: str          # parent | guardian | caregiver
    scope: frozenset           # purposes the rep may act on
    verified: bool
    expiry: Optional[datetime]
    revoked: bool = False


class ConsentError(ValueError):
    pass


class ConsentLedger:
    """Append-only. Existing records are never mutated; state is derived."""

    def __init__(self) -> None:
        self._records: list[ConsentRecord] = []

    def append(self, record: ConsentRecord) -> None:
        if record.action not in ("grant", "refuse", "withdraw"):
            raise ConsentError(f"invalid consent action: {record.action}")
        self._records.append(record)

    def records(self) -> list[ConsentRecord]:
        return list(self._records)

    def latest(self, subject_id: str, doc_id: str) -> Optional[ConsentRecord]:
        matching = [r for r in self._records if r.subject_id == subject_id and r.doc_id == doc_id]
        return matching[-1] if matching else None


def has_effective_consent(ledger: ConsentLedger, subject_id: str, doc: ConsentDocument,
                          language: str, now: Optional[datetime] = None) -> bool:
    """True only if the subject has a current, matching, non-withdrawn grant of
    this exact document version, hash and language, within its effective window,
    from an approved source. Fails closed otherwise."""
    now = now or datetime.utcnow()
    if doc.approved_source is None:
        return False                                   # unapproved ⇒ fail closed
    if now < doc.effective_from or (doc.effective_to and now > doc.effective_to):
        return False                                   # expired/superseded window
    rec = ledger.latest(subject_id, doc.doc_id)
    if rec is None or rec.action != "grant":
        return False                                   # missing / refused / withdrawn
    if rec.version != doc.version or rec.content_hash != doc.content_hash:
        return False                                   # stale / mismatched version
    if rec.language != language:
        return False                                   # untranslated / wrong language
    return True


def is_bundled_with_care(documents: list[ConsentDocument]) -> bool:
    """A single consent request must not bundle an optional purpose with a
    necessary-care purpose."""
    kinds = {d.kind for d in documents}
    return bool(kinds & OPTIONAL_KINDS) and bool(kinds & NECESSARY_KINDS)


def can_represent(auth: RepresentativeAuthority, purpose: str,
                  now: Optional[datetime] = None) -> bool:
    """Representative authority is bounded, verified, unexpired, unrevoked, and
    scoped — never inferred from shared contact details."""
    now = now or datetime.utcnow()
    if auth.revoked or not auth.verified:
        return False
    if auth.expiry is not None and now > auth.expiry:
        return False
    return purpose in auth.scope


def withdrawal_effect(ledger: ConsentLedger, subject_id: str, doc: ConsentDocument) -> dict:
    """Withdrawal stops future optional processing but never deletes legally
    required records."""
    rec = ledger.latest(subject_id, doc.doc_id)
    withdrawn = rec is not None and rec.action == "withdraw"
    return {
        "future_optional_processing_allowed": not (withdrawn and not doc.required),
        "existing_required_records_deleted": False,     # never
        "under_legal_hold": doc.required,
    }
