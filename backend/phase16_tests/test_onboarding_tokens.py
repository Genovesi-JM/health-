"""Phase 16 invitation & onboarding: hashed single-use expiring exact-recipient/
purpose tokens that fail closed without revealing account state; onboarding
state never grants authority; no wizard step sets privilege; deep-link safety.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.onboarding_tokens import (
    InvitationToken, hash_token, validate_invitation, state_grants_authority,
    wizard_completion_grants, can_advance, professional_restricted_until_gates,
    is_deep_link_safe, ONBOARDING_STATES,
)

NOW = datetime(2026, 9, 14, 12, 0, 0)


def _tok(raw="secret-raw", **kw):
    base = dict(token_hash=hash_token(raw), recipient="doc@clinic.test",
                purpose="clinician_onboarding", expiry=NOW + timedelta(hours=1))
    base.update(kw)
    return InvitationToken(**base)


def test_valid_invitation_accepts():
    r = validate_invitation("secret-raw", _tok(), "doc@clinic.test", "clinician_onboarding", NOW)
    assert r.ok


def test_tampered_token_fails_generic():
    r = validate_invitation("wrong-raw", _tok(), "doc@clinic.test", "clinician_onboarding", NOW)
    assert not r.ok and r.reason == "invitation invalid or expired"


def test_replay_used_token_fails():
    assert not validate_invitation("secret-raw", _tok(used=True), "doc@clinic.test", "clinician_onboarding", NOW)


def test_revoked_token_fails():
    assert not validate_invitation("secret-raw", _tok(revoked=True), "doc@clinic.test", "clinician_onboarding", NOW)


def test_expired_token_fails():
    assert not validate_invitation("secret-raw", _tok(expiry=NOW - timedelta(minutes=1)),
                                   "doc@clinic.test", "clinician_onboarding", NOW)


def test_wrong_recipient_fails():
    assert not validate_invitation("secret-raw", _tok(), "other@x.test", "clinician_onboarding", NOW)


def test_wrong_purpose_fails():
    assert not validate_invitation("secret-raw", _tok(), "doc@clinic.test", "patient_onboarding", NOW)


def test_missing_token_fails_without_state_leak():
    r = validate_invitation("secret-raw", None, "doc@clinic.test", "clinician_onboarding", NOW)
    assert not r.ok and r.reason == "invitation invalid or expired"


def test_all_failures_share_one_reason():
    reasons = {
        validate_invitation("wrong", _tok(), "doc@clinic.test", "clinician_onboarding", NOW).reason,
        validate_invitation("secret-raw", _tok(revoked=True), "doc@clinic.test", "clinician_onboarding", NOW).reason,
        validate_invitation("secret-raw", _tok(), "other@x.test", "clinician_onboarding", NOW).reason,
    }
    assert reasons == {"invitation invalid or expired"}  # no distinguishing oracle


# ── Onboarding state ─────────────────────────────────────────────────────────

def test_onboarding_state_never_grants_authority():
    for s in ONBOARDING_STATES:
        assert state_grants_authority(s) is False


def test_wizard_cannot_set_privilege():
    for field in ("privileged_role", "verified_credential", "active_membership", "clinical_privilege"):
        assert wizard_completion_grants(field) is False
    assert wizard_completion_grants("display_name") is True


def test_no_step_skipping():
    assert can_advance("application", "invitation")
    assert not can_advance("application", "privilege")       # skip → denied
    assert not can_advance("privilege", "application")        # backwards → denied


def test_professional_restricted_until_all_gates():
    assert professional_restricted_until_gates(True, True, True, True, False)  # one gate open → restricted
    assert not professional_restricted_until_gates(True, True, True, True, True)


def test_deep_link_safety():
    assert is_deep_link_safe("appointment", token_in_url=False, redirect_allowlisted=True)
    assert not is_deep_link_safe("appointment", token_in_url=True, redirect_allowlisted=True)
    assert not is_deep_link_safe(None, token_in_url=False, redirect_allowlisted=True)
    assert not is_deep_link_safe("appointment", token_in_url=False, redirect_allowlisted=False)
