"""Phase 26 clinical note integrity: authored-by is immutable, signing locks
content, no silent edit or delete, append-only hash-chained reason-bearing
amendments, tamper-evident chain, retraction is an amendment (never a delete),
and access is scoped by episode/org/privilege.
"""
from __future__ import annotations

import pytest

from app import note_integrity as N


def _draft(**kw):
    base = dict(note_id="n1", episode_id="ep-1", org_id="org-1", author_id="doc-1",
                author_role="doctor",
                content={"subjective": "s", "objective": "o", "assessment": "a", "plan": "p"},
                created_at_epoch=1000)
    base.update(kw)
    return N.ClinicalNote(**base)


# ── Draft editing ────────────────────────────────────────────────────────────

def test_author_can_edit_draft():
    d = _draft()
    d2 = N.edit_draft(d, {"plan": "revised"}, editor_id="doc-1")
    assert d2.content == {"plan": "revised"}
    assert d.content != d2.content          # original value object unchanged (immutable)


def test_non_author_cannot_edit_draft():
    with pytest.raises(N.NoteIntegrityError):
        N.edit_draft(_draft(), {"plan": "x"}, editor_id="doc-2")


# ── Signing locks content ────────────────────────────────────────────────────

def test_sign_locks_and_records_hash():
    s = N.sign(_draft(), signer_id="doc-1", now_epoch=2000)
    assert s.is_locked() and s.state == N.SIGNED
    assert s.signed_by == "doc-1" and s.signed_at_epoch == 2000
    assert s.signed_hash and N.signature_valid(s)


def test_cannot_edit_signed_note_in_place():
    s = N.sign(_draft(), signer_id="doc-1", now_epoch=2000)
    assert not N.can_edit_content(s)
    with pytest.raises(N.NoteLockedError):
        N.edit_draft(s, {"plan": "sneaky"}, editor_id="doc-1")


def test_only_author_may_sign():
    with pytest.raises(N.NoteIntegrityError):
        N.sign(_draft(), signer_id="doc-2", now_epoch=2000)


def test_cannot_sign_empty_note():
    with pytest.raises(N.NoteIntegrityError):
        N.sign(_draft(content={}), signer_id="doc-1", now_epoch=2000)


def test_cannot_resign_locked_note():
    s = N.sign(_draft(), signer_id="doc-1", now_epoch=2000)
    with pytest.raises(N.NoteLockedError):
        N.sign(s, signer_id="doc-1", now_epoch=3000)


def test_tampered_signed_content_fails_signature():
    s = N.sign(_draft(), signer_id="doc-1", now_epoch=2000)
    # simulate an out-of-band content mutation (what the DB must never allow)
    tampered = N.replace(s, content={"plan": "altered"})
    assert not N.signature_valid(tampered)


# ── No reassignment / no delete ──────────────────────────────────────────────

def test_author_attribution_cannot_be_reassigned():
    with pytest.raises(N.NoteIntegrityError):
        N.reassign_author_prohibited(_draft(), new_author_id="doc-9")


def test_hard_delete_prohibited():
    with pytest.raises(N.NoteDeletionProhibited):
        N.delete_prohibited(N.sign(_draft(), "doc-1", 2000))


# ── Append-only hash-chained amendments ──────────────────────────────────────

def _log():
    s = N.sign(_draft(), signer_id="doc-1", now_epoch=2000)
    return s, N.AmendmentLog(base_signed_hash=s.signed_hash)


def test_amendment_requires_reason():
    _, log = _log()
    with pytest.raises(N.NoteIntegrityError):
        log.append("doc-1", "doctor", reason="", kind=N.ADDENDUM,
                   content={"note": "x"}, now_epoch=2100, amend_id="a1")


def test_amendment_requires_signed_base():
    _, log = _log()
    with pytest.raises(N.NoteIntegrityError):
        log.append("doc-1", "doctor", reason="typo", kind=N.CORRECTION,
                   content={"note": "x"}, now_epoch=2100, amend_id="a1",
                   note_is_signed=False)


def test_unknown_amendment_kind_rejected():
    _, log = _log()
    with pytest.raises(N.NoteIntegrityError):
        log.append("doc-1", "doctor", reason="r", kind="rewrite",
                   content={}, now_epoch=2100, amend_id="a1")


def test_chain_appends_and_verifies():
    _, log = _log()
    log.append("doc-1", "doctor", "clarify plan", N.ADDENDUM, {"note": "extra"}, 2100, "a1")
    log.append("doc-2", "doctor", "correct dose", N.CORRECTION, {"note": "fix"}, 2200, "a2")
    assert len(log.entries()) == 2
    assert log.verify()
    # chain links prev->this
    e = log.entries()
    assert e[1].prev_hash == e[0].this_hash


def test_reordered_or_edited_chain_fails_verify():
    _, log = _log()
    log.append("doc-1", "doctor", "r1", N.ADDENDUM, {"note": "one"}, 2100, "a1")
    log.append("doc-1", "doctor", "r2", N.ADDENDUM, {"note": "two"}, 2200, "a2")
    # tamper: edit the content of the first entry in place
    items = log._items
    items[0] = N.replace(items[0], content={"note": "hacked"})
    assert not log.verify()


def test_amendment_delete_prohibited():
    _, log = _log()
    log.append("doc-1", "doctor", "r", N.ADDENDUM, {"note": "x"}, 2100, "a1")
    with pytest.raises(N.NoteDeletionProhibited):
        log.delete_entry("a1")


def test_retraction_is_an_amendment_not_a_delete():
    _, log = _log()
    log.append("doc-1", "doctor", "entered on wrong patient", N.RETRACTION,
               {"retracted": True}, 2100, "a1")
    latest = log.latest_effective()
    assert latest.kind == N.RETRACTION
    assert len(log.entries()) == 1          # prior content still present, nothing removed
    assert log.verify()


# ── Access control ───────────────────────────────────────────────────────────

def _ctx(**kw):
    base = dict(user_id="doc-1", role="doctor", org_ids=frozenset({"org-1"}),
                assigned_episode_ids=frozenset({"ep-1"}),
                privileges=frozenset({"clinical_read", "clinical_write"}))
    base.update(kw)
    return N.NoteAccessContext(**base)


def test_assigned_clinician_can_read():
    assert N.can_read(_draft(), _ctx())


def test_unassigned_clinician_cannot_read():
    assert not N.can_read(_draft(), _ctx(assigned_episode_ids=frozenset({"ep-9"})))
    assert not N.can_read(_draft(), _ctx(org_ids=frozenset({"org-9"})))
    assert not N.can_read(_draft(), _ctx(privileges=frozenset()))


def test_patient_role_denied_by_default_here():
    assert not N.can_read(_draft(), _ctx(role="patient"))
    # own-record read is a relationship check the adopting layer supplies
    s = N.sign(_draft(), "doc-1", 2000)
    assert N.patient_may_read_own(s, patient_id="pat-1", subject_patient_id="pat-1")
    assert not N.patient_may_read_own(s, patient_id="pat-2", subject_patient_id="pat-1")


def test_amend_requires_signed_note_and_write_privilege():
    d = _draft()
    assert not N.can_amend(d, _ctx())                       # draft not amendable
    s = N.sign(d, "doc-1", 2000)
    assert N.can_amend(s, _ctx())
    assert not N.can_amend(s, _ctx(privileges=frozenset({"clinical_read"})))
    assert not N.can_amend(s, _ctx(role="patient"))
