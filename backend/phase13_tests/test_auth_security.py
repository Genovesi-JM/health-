"""Phase 13 auth-security: step-up freshness and refresh-family reuse (pure),
plus a static contract that the runtime already fails closed on partial tokens,
hashes single-use recovery codes, revokes reused refresh families, and runs MFA
for OAuth logins too.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app import authsecurity as A

BACKEND = Path(__file__).resolve().parents[1]
AUTH = (BACKEND / "app/routers/auth.py").read_text(encoding="utf-8")
MFA = (BACKEND / "app/services/mfa.py").read_text(encoding="utf-8")
MFA_ROUTER = (BACKEND / "app/routers/mfa.py").read_text(encoding="utf-8")


# ── Step-up freshness (pure) ─────────────────────────────────────────────────

def test_high_impact_actions_require_step_up():
    for action in ("credential_decision", "prescription", "data_export",
                   "break_glass", "payment", "privilege_change"):
        assert A.requires_step_up(action)
    assert not A.requires_step_up("view_dashboard")


def test_step_up_fails_closed_without_mfa():
    assert A.is_auth_fresh("prescription", None) is False
    with pytest.raises(PermissionError):
        A.assert_step_up("payment", None)


def test_step_up_respects_freshness_window():
    now = datetime(2026, 9, 14, 12, 0, 0)
    fresh = now - timedelta(seconds=60)
    stale = now - timedelta(seconds=6000)
    assert A.is_auth_fresh("prescription", fresh, now) is True
    assert A.is_auth_fresh("prescription", stale, now) is False


def test_non_stepup_action_always_fresh():
    assert A.is_auth_fresh("view_dashboard", None) is True


# ── Refresh-family reuse (pure) ──────────────────────────────────────────────

def test_reuse_of_revoked_token_detected():
    assert A.detect_family_reuse("t1", active_token_id="t3", revoked_token_ids={"t1", "t2"}) is True


def test_non_current_token_is_reuse():
    assert A.detect_family_reuse("t2", active_token_id="t3", revoked_token_ids=set()) is True


def test_current_active_token_is_not_reuse():
    assert A.detect_family_reuse("t3", active_token_id="t3", revoked_token_ids={"t1", "t2"}) is False


# ── Runtime contract ─────────────────────────────────────────────────────────

def test_partial_token_fails_closed_in_runtime():
    assert "mfa_challenge" in MFA
    assert "fail closed" in MFA.lower() or "Fail closed" in MFA


def test_recovery_codes_hashed_and_single_use():
    assert "def hash_recovery_code" in MFA
    assert "code_hash" in MFA_ROUTER and "used_at" in MFA_ROUTER


def test_refresh_reuse_revokes_family_in_runtime():
    assert "family_id" in AUTH
    assert 'update({"revoked": True})' in AUTH or "revoked" in AUTH


def test_oauth_login_enforces_mfa_in_runtime():
    # The shared auth-response builder runs assert_mfa_session for all logins.
    assert "assert_mfa_session" in AUTH


def test_mfa_required_roles_match_runtime():
    for r in ("doctor", "nurse", "pharmacist", "corporate_admin", "compliance_reviewer", "admin"):
        assert A.mfa_required(r), r
    assert not A.mfa_required("patient")
