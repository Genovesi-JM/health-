"""Phase 28 secure clinical messaging: relationship-scoped send, server-derived
recipient (no misroute), sender authenticity (no spoof), not-an-emergency-channel
redirect, never auto-act on patient directives, append-only with monotonic read
receipts, and participant-only read.
"""
from __future__ import annotations

import pytest

from app import clinical_messaging as M


def _thread(**kw):
    base = dict(consultation_id="c1", patient_id="pat-1", clinician_id="doc-1", status=M.OPEN)
    base.update(kw)
    return M.MessageThread(**base)


PATIENT = M.Sender(user_id="pat-1", role="patient")
DOCTOR = M.Sender(user_id="doc-1", role="doctor")
OUTSIDER = M.Sender(user_id="stranger", role="patient")


# ── Scoped send ──────────────────────────────────────────────────────────────

def test_participant_can_send_in_open_thread():
    assert M.can_send(_thread(), PATIENT)
    assert M.can_send(_thread(), DOCTOR)


def test_outsider_cannot_send():
    assert not M.can_send(_thread(), OUTSIDER)


def test_cannot_send_in_closed_thread():
    assert not M.can_send(_thread(status=M.CLOSED), PATIENT)
    assert not M.can_send(_thread(status=M.CLOSED), DOCTOR)


# ── Recipient derived server-side (no misroute) ──────────────────────────────

def test_recipient_is_the_other_participant():
    t = _thread()
    assert M.resolve_recipient(t, PATIENT) == "doc-1"
    assert M.resolve_recipient(t, DOCTOR) == "pat-1"


def test_resolve_recipient_rejects_outsider():
    with pytest.raises(M.MisrouteError):
        M.resolve_recipient(_thread(), OUTSIDER)


def test_recipient_must_be_in_thread():
    t = _thread()
    assert M.recipient_is_in_thread(t, "doc-1")
    assert not M.recipient_is_in_thread(t, "someone-else")


# ── Sender authenticity (no spoof) ───────────────────────────────────────────

def test_patient_cannot_claim_clinician_role():
    spoof = M.Sender(user_id="pat-1", role="doctor")   # patient claiming doctor
    assert not M.sender_authentic(_thread(), spoof)


def test_clinician_role_must_match_slot():
    # doctor id but claiming patient role
    spoof = M.Sender(user_id="doc-1", role="patient")
    assert not M.sender_authentic(_thread(), spoof)


def test_nurse_role_valid_for_clinician_slot():
    nurse = M.Sender(user_id="doc-1", role="nurse")
    assert M.sender_authentic(_thread(), nurse)


# ── Not an emergency channel ─────────────────────────────────────────────────

def test_emergency_redirect_triggers():
    assert M.emergency_check("I have chest pain and can't breathe").redirect
    assert M.emergency_check("dor no peito há uma hora").redirect
    assert M.requires_emergency_redirect("tenho falta de ar")


def test_routine_message_no_redirect_but_carries_notice():
    d = M.emergency_check("Can I take this with food?")
    assert not d.redirect
    assert "emergência" in d.notice.lower()


# ── Never auto-act on patient directives ─────────────────────────────────────

def test_patient_message_never_auto_actionable():
    assert M.patient_message_is_auto_actionable("stop my metformin now") is False
    assert M.patient_message_is_auto_actionable("double the dose") is False


def test_patient_directive_routed_for_review():
    assert M.directive_requires_clinician_review(PATIENT, "please stop my metformin")
    assert M.directive_requires_clinician_review(PATIENT, "cancel my prescription")
    assert M.directive_requires_clinician_review(PATIENT, "aumentar a dose")


def test_clinician_message_not_flagged_as_patient_directive():
    assert not M.directive_requires_clinician_review(DOCTOR, "I will stop your metformin")


# ── Build / integrity ────────────────────────────────────────────────────────

def test_build_message_sets_derived_recipient():
    msg = M.build_message(_thread(), PATIENT, "hello", now_epoch=1000, message_id="m1")
    assert msg.recipient_id == "doc-1" and msg.sender_id == "pat-1"


def test_build_message_rejects_unauthorized_and_empty():
    with pytest.raises(M.MessagingError):
        M.build_message(_thread(), OUTSIDER, "hi", now_epoch=1000, message_id="m1")
    with pytest.raises(M.MessagingError):
        M.build_message(_thread(), PATIENT, "   ", now_epoch=1000, message_id="m2")


def test_sent_message_is_immutable():
    msg = M.build_message(_thread(), DOCTOR, "take with food", now_epoch=1000, message_id="m1")
    with pytest.raises(M.MessageImmutableError):
        M.edit_prohibited(msg)
    with pytest.raises(M.MessageImmutableError):
        M.delete_prohibited(msg)


# ── Read receipts monotonic ──────────────────────────────────────────────────

def test_only_recipient_marks_read():
    msg = M.build_message(_thread(), PATIENT, "hi", now_epoch=1000, message_id="m1")  # recipient doc-1
    with pytest.raises(M.MessagingError):
        M.mark_read(msg, reader_id="pat-1", now_epoch=1100)      # sender can't mark own read
    read = M.mark_read(msg, reader_id="doc-1", now_epoch=1100)
    assert read.read_at_epoch == 1100


def test_read_receipt_is_monotonic():
    msg = M.build_message(_thread(), PATIENT, "hi", now_epoch=1000, message_id="m1")
    read = M.mark_read(msg, reader_id="doc-1", now_epoch=1100)
    again = M.mark_read(read, reader_id="doc-1", now_epoch=2000)
    assert again.read_at_epoch == 1100                          # never reset/un-read


# ── Read access ──────────────────────────────────────────────────────────────

def test_only_participants_read_thread():
    t = _thread()
    assert M.can_read_thread(t, "pat-1") and M.can_read_thread(t, "doc-1")
    assert not M.can_read_thread(t, "stranger")
