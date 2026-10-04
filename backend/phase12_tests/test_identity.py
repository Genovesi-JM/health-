"""Phase 12 canonical identity: no self-promotion into a privileged role via
registration, profile, onboarding, or a legacy path. Pure guard tests plus a
static contract check that the real registration code carries the controls.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app import identity
from app.services.mfa import MFA_MANDATORY_ROLES

AUTH = (Path(__file__).resolve().parents[1] / "app/routers/auth.py").read_text(encoding="utf-8")


# ── Canonical guard ──────────────────────────────────────────────────────────

def test_public_registration_role_is_never_privileged():
    for requested in ("doctor", "nurse", "pharmacist", "admin", "support", "compliance_reviewer"):
        assert identity.canonical_account_role(requested) == "patient", requested


def test_public_self_roles_allowed():
    assert identity.canonical_account_role("patient") == "patient"
    assert identity.canonical_account_role("cliente") == "patient"  # normalized


def test_is_privileged_role():
    assert identity.is_privileged_role("doctor")
    assert identity.is_privileged_role("admin")
    assert not identity.is_privileged_role("patient")
    assert not identity.is_privileged_role("cliente")


def test_assert_not_self_privileged():
    identity.assert_not_self_privileged("patient")  # ok
    for r in ("doctor", "admin", "reviewer", "support"):
        with pytest.raises(identity.SelfPromotionError):
            identity.assert_not_self_privileged(r)


def test_mutable_fields_are_not_authorization_authority():
    for field in ("email", "phone", "provider_id", "licence_number", "full_name", "slug"):
        assert not identity.is_authorization_authority(field)
    assert identity.is_authorization_authority("role")


def test_lifecycle_effects_defined():
    for op in ("disable", "delete", "merge"):
        assert identity.ACCOUNT_LIFECYCLE_EFFECTS[op]


# ── Real-code contract ───────────────────────────────────────────────────────

def test_registration_bounds_requested_role():
    # The requested role is validated against a bounded allow-set.
    assert '{"patient", "doctor", "nurse"}' in AUTH


def test_persisted_privileged_roles_require_mfa():
    # Requested professions stay non-clinical until human review; MFA follows
    # the persisted role, not the profession supplied on the registration form.
    assert "if mfa_is_mandatory(user.role):" in AUTH
    # Every privileged clinical/admin role is MFA-mandatory (so the gate covers them).
    for r in ("doctor", "nurse", "pharmacist", "admin", "compliance_reviewer"):
        assert r in MFA_MANDATORY_ROLES, f"{r} must be MFA-mandatory"


def test_user_created_with_canonical_non_privileged_role():
    assert "canonical_account_role(role)" in AUTH
    # No path persists a raw client-supplied privileged role on the User at register.
    assert "role=role, is_active=True)" not in AUTH
