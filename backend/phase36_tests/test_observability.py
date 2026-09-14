"""Phase 36 observability & audit: complete audit events, append-only
tamper-evident hash chain, must-audit actions never dropped by sampling,
privacy-safe telemetry scrubbing with a PHI/secret guard, and audit-read access
control.
"""
from __future__ import annotations

import pytest

from app import observability as O


def _ev(**kw):
    base = dict(actor_id="doc-1", action="prescription.issue", resource_type="prescription",
                resource_id="rx-1", outcome=O.OUTCOME_SUCCESS, at_epoch=1000, request_id="req-1")
    base.update(kw)
    return O.AuditEvent(**base)


# ── Event completeness ───────────────────────────────────────────────────────

def test_valid_event():
    assert O.audit_event_valid(_ev())


def test_invalid_events():
    assert not O.audit_event_valid(_ev(action=""))
    assert not O.audit_event_valid(_ev(outcome="maybe"))
    assert not O.audit_event_valid(_ev(at_epoch=0))
    # anonymous actor is allowed as long as the shape is complete
    assert O.audit_event_valid(_ev(actor_id=None, action="auth.failed", outcome=O.OUTCOME_DENIED))


# ── Must-audit ───────────────────────────────────────────────────────────────

def test_must_audit_actions():
    assert O.must_audit("auth.login")
    assert O.must_audit("prescription.issue")
    assert O.must_audit("record.access")
    assert not O.must_audit("page.view")


# ── Tamper-evident chain ─────────────────────────────────────────────────────

def test_chain_appends_and_verifies():
    ch = O.AuditChain()
    ch.append(_ev(action="auth.login", resource_type=None, resource_id=None))
    ch.append(_ev(action="record.access"))
    assert len(ch.entries()) == 2
    assert ch.verify()
    assert ch.entries()[1].prev_hash == ch.entries()[0].this_hash


def test_incomplete_event_rejected_on_append():
    ch = O.AuditChain()
    with pytest.raises(ValueError):
        ch.append(_ev(outcome="nope"))


def test_tampered_chain_fails_verify():
    ch = O.AuditChain()
    ch.append(_ev(action="auth.login"))
    ch.append(_ev(action="record.export"))
    # tamper: replace an event's action in place
    items = ch._items
    from dataclasses import replace
    items[0] = O.AuditRecord(event=replace(items[0].event, action="auth.logout"),
                             prev_hash=items[0].prev_hash, this_hash=items[0].this_hash)
    assert not ch.verify()


def test_audit_delete_prohibited():
    ch = O.AuditChain()
    ch.append(_ev())
    with pytest.raises(PermissionError):
        ch.delete(0)


# ── Sampling ─────────────────────────────────────────────────────────────────

def test_sampling_never_drops_security_events():
    assert not O.sampling_may_drop("auth.login", is_sampled_out=True)
    assert not O.sampling_may_drop("prescription.issue", is_sampled_out=True)
    # a routine event may be sampled out
    assert O.sampling_may_drop("page.view", is_sampled_out=True)
    assert not O.sampling_may_drop("page.view", is_sampled_out=False)


# ── Privacy-safe telemetry ───────────────────────────────────────────────────

def test_scrub_telemetry_redacts_sensitive_keys():
    out = O.scrub_telemetry({"authorization": "Bearer abc.def.ghijklmnop", "clinical_note": "cancer",
                             "level": "info"})
    assert out["authorization"] == redaction_marker()
    assert out["clinical_note"] == redaction_marker()
    assert out["level"] == "info"


def redaction_marker():
    from app import redaction
    return redaction.REDACTED


def test_telemetry_safety_guard():
    assert O.telemetry_is_safe("user completed onboarding step 2")
    assert not O.telemetry_is_safe("contact +244923456789")
    with pytest.raises(ValueError):
        O.assert_telemetry_safe("email a@b.com")


# ── Audit-read access control ────────────────────────────────────────────────

def test_audit_read_access_control():
    assert O.can_read_audit("auditor", frozenset({"audit_read"}))
    assert not O.can_read_audit("doctor", frozenset({"audit_read"}))       # wrong role
    assert not O.can_read_audit("auditor", frozenset())                    # missing privilege
    assert not O.can_read_audit("admin", frozenset({"audit_read"}))        # admin is not an auditor
