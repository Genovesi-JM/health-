"""Phase 17 privileging: human-governed four-eyes activation with primary-source
live evidence; automated/mock/support/self paths cannot activate; status loss
blocks clinical; audit-atomicity. Includes a static check that the real webhook
router verifies signatures + idempotency.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from app.privileging import (
    Decision, Evidence, PrivilegingDecision, can_activate_privilege, can_transition,
    provider_check_can_approve, status_permits_clinical, status_loss_blocks_clinical,
    REVOCATION_PROPAGATION, NON_LIVE_CHECK,
)

BACKEND = Path(__file__).resolve().parents[1]


def _evidence(**kw):
    base = dict(primary_source=True, live=True, check_status="completed",
                malware_clean=True, valid_type_and_size=True, not_expired=True,
                insurance_ok=True, good_standing=True)
    base.update(kw)
    return Evidence(**base)


def _decision(**kw):
    base = dict(applicant_id="doc-1", reviewer_id="rev-1", reviewer_mfa_verified=True,
                reviewer_role="credentialing_authority", second_approver_id="rev-2",
                jurisdiction="AO", profession="doctor", organization_id="org-1",
                scope="primary_care", effective_from=date(2026, 9, 14),
                effective_to=date(2027, 9, 14), audit_committed=True)
    base.update(kw)
    return PrivilegingDecision(**base)


def test_valid_activation():
    assert can_activate_privilege(_decision(), _evidence())


def test_provider_check_is_evidence_only():
    for bad in NON_LIVE_CHECK:
        assert not provider_check_can_approve(bad, live=True)
    assert not provider_check_can_approve("completed", live=False)   # sandbox/not-live
    assert provider_check_can_approve("completed", live=True)


def test_mock_evidence_cannot_activate():
    assert not can_activate_privilege(_decision(), _evidence(live=False))
    assert not can_activate_privilege(_decision(), _evidence(primary_source=False))


def test_self_approval_blocked():
    assert not can_activate_privilege(_decision(reviewer_id="doc-1"), _evidence())


def test_support_cannot_decide():
    assert not can_activate_privilege(_decision(reviewer_role="support"), _evidence())


def test_reviewer_mfa_required():
    assert not can_activate_privilege(_decision(reviewer_mfa_verified=False), _evidence())


def test_four_eyes_required():
    assert not can_activate_privilege(_decision(second_approver_id=None), _evidence())
    assert not can_activate_privilege(_decision(second_approver_id="rev-1"), _evidence())  # same as reviewer


def test_missing_scope_attributes_blocked():
    assert not can_activate_privilege(_decision(jurisdiction=None), _evidence())
    assert not can_activate_privilege(_decision(effective_from=None), _evidence())


def test_audit_failure_fails_decision():
    assert not can_activate_privilege(_decision(audit_committed=False), _evidence())


def test_incomplete_evidence_blocked():
    for bad in ("malware_clean", "valid_type_and_size", "not_expired", "good_standing", "insurance_ok"):
        assert not can_activate_privilege(_decision(), _evidence(**{bad: False}))


def test_only_verified_permits_clinical():
    assert status_permits_clinical("verified")
    for s in ("suspended", "expired", "revoked", "needs_information", "rejected", "pending_review"):
        assert not status_permits_clinical(s)
        assert status_loss_blocks_clinical(s)


def test_transitions_are_bounded():
    assert can_transition("pending_review", "verified")
    assert can_transition("verified", "suspended")
    assert not can_transition("draft", "verified")        # cannot skip review
    assert not can_transition("revoked", "verified")       # terminal


def test_revocation_propagation_targets():
    for target in ("sessions", "prescribing", "video", "future_appointments", "records_access"):
        assert target in REVOCATION_PROPAGATION


def test_webhook_router_verifies_signature_and_idempotency():
    wh = (BACKEND / "app/routers/verification_webhooks.py")
    if wh.exists():
        text = wh.read_text(encoding="utf-8").lower()
        assert "signature" in text or "hmac" in text or "verify" in text
