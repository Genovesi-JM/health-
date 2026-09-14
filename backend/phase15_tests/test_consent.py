"""Phase 15 consent: versioned, purpose-specific, fail-closed on stale/unknown/
mismatched versions; withdrawal stops future optional processing without
deleting required records; representative authority bounded and never inferred.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.consent import (
    ConsentDocument, ConsentRecord, ConsentLedger, RepresentativeAuthority,
    has_effective_consent, is_bundled_with_care, can_represent, withdrawal_effect,
)

NOW = datetime(2026, 9, 14, 12, 0, 0)


def _doc(**kw):
    base = dict(doc_id="privacy", version=2, content_hash="h2", jurisdiction="AO",
                language="pt", purpose="care", kind="privacy_notice", required=True,
                effective_from=NOW - timedelta(days=1), approved_source="counsel-2026")
    base.update(kw)
    return ConsentDocument(**base)


def _grant(doc, subject="pat-1", **kw):
    base = dict(subject_id=subject, doc_id=doc.doc_id, version=doc.version,
                content_hash=doc.content_hash, action="grant", timestamp=NOW,
                actor_id=subject, language=doc.language, notice_evidence="shown")
    base.update(kw)
    return ConsentRecord(**base)


def test_matching_grant_is_effective():
    doc = _doc()
    led = ConsentLedger(); led.append(_grant(doc))
    assert has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_missing_consent_fails_closed():
    assert not has_effective_consent(ConsentLedger(), "pat-1", _doc(), "pt", NOW)


def test_stale_version_fails_closed():
    doc = _doc(version=2, content_hash="h2")
    led = ConsentLedger(); led.append(_grant(doc, version=1, content_hash="h1"))
    assert not has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_wrong_language_fails_closed():
    doc = _doc(language="pt")
    led = ConsentLedger(); led.append(_grant(doc, language="en"))
    assert not has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_unapproved_document_fails_closed():
    doc = _doc(approved_source=None)
    led = ConsentLedger(); led.append(_grant(doc))
    assert not has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_expired_window_fails_closed():
    doc = _doc(effective_to=NOW - timedelta(hours=1))
    led = ConsentLedger(); led.append(_grant(doc))
    assert not has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_refusal_is_not_acceptance():
    doc = _doc()
    led = ConsentLedger(); led.append(_grant(doc, action="refuse"))
    assert not has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_withdrawal_after_grant_fails_closed():
    doc = _doc(required=False, kind="marketing")
    led = ConsentLedger()
    led.append(_grant(doc))
    led.append(_grant(doc, action="withdraw"))
    assert not has_effective_consent(led, "pat-1", doc, "pt", NOW)


def test_optional_not_bundled_with_care():
    care = _doc(kind="clinical_informed_consent")
    ai = _doc(doc_id="ai", kind="ai", required=False)
    assert is_bundled_with_care([care, ai])       # forbidden
    assert not is_bundled_with_care([care])       # ok alone


def test_withdrawal_does_not_delete_required_records():
    doc = _doc(required=True)
    led = ConsentLedger(); led.append(_grant(doc)); led.append(_grant(doc, action="withdraw"))
    eff = withdrawal_effect(led, "pat-1", doc)
    assert eff["existing_required_records_deleted"] is False
    assert eff["under_legal_hold"] is True


def test_withdrawal_stops_future_optional():
    doc = _doc(required=False, kind="marketing")
    led = ConsentLedger(); led.append(_grant(doc)); led.append(_grant(doc, action="withdraw"))
    assert withdrawal_effect(led, "pat-1", doc)["future_optional_processing_allowed"] is False


# ── Representative authority ─────────────────────────────────────────────────

def _auth(**kw):
    base = dict(representative_id="cg", subject_id="pat-1", relationship="parent",
                scope=frozenset({"care"}), verified=True, expiry=NOW + timedelta(days=30))
    base.update(kw)
    return RepresentativeAuthority(**base)


def test_representative_valid():
    assert can_represent(_auth(), "care", NOW)


def test_representative_out_of_scope_denied():
    assert not can_represent(_auth(scope=frozenset({"care"})), "marketing", NOW)


def test_representative_unverified_denied():
    assert not can_represent(_auth(verified=False), "care", NOW)


def test_representative_expired_denied():
    assert not can_represent(_auth(expiry=NOW - timedelta(days=1)), "care", NOW)


def test_representative_revoked_denied():
    assert not can_represent(_auth(revoked=True), "care", NOW)


def test_ledger_is_append_only():
    doc = _doc()
    led = ConsentLedger()
    led.append(_grant(doc))
    led.append(_grant(doc, action="withdraw"))
    # Both records retained; nothing rewritten.
    assert len(led.records()) == 2
    assert [r.action for r in led.records()] == ["grant", "withdraw"]
