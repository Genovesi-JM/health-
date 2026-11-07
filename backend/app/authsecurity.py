"""Authentication assurance: step-up freshness and refresh-family reuse
detection (Phase 13). Domain-pure and importable without the app.

High-impact actions must prove recent, role-appropriate authentication; a reused
refresh token must revoke its whole family. These are the canonical rules the
runtime enforces.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable, Optional

# Actions that require a fresh MFA step-up, with the maximum allowed age of the
# last successful MFA (seconds). Missing/older ⇒ re-authenticate.
STEP_UP_ACTIONS = {
    "credential_decision": 300,
    "prescription": 300,
    "data_export": 300,
    "break_glass": 120,
    "payment": 300,
    "privilege_change": 300,
    "recovery_code_regenerate": 300,
}


def requires_step_up(action: str) -> bool:
    return action in STEP_UP_ACTIONS


def is_auth_fresh(action: str, last_mfa_at: Optional[datetime], now: Optional[datetime] = None) -> bool:
    """True only if the action is allowed given the last MFA time. Fails closed:
    a step-up action with no/expired MFA is not fresh."""
    if not requires_step_up(action):
        return True
    if last_mfa_at is None:
        return False
    now = now or datetime.utcnow()
    max_age = STEP_UP_ACTIONS[action]
    return (now - last_mfa_at) <= timedelta(seconds=max_age)


def assert_step_up(action: str, last_mfa_at: Optional[datetime], now: Optional[datetime] = None) -> None:
    if not is_auth_fresh(action, last_mfa_at, now):
        raise PermissionError(f"Action '{action}' requires a fresh MFA step-up")


def detect_family_reuse(presented_token_id: str, active_token_id: Optional[str],
                        revoked_token_ids: Iterable[str]) -> bool:
    """A refresh token is reused if it was already rotated away (revoked) or is
    not the family's current active token. Reuse ⇒ revoke the whole family."""
    if presented_token_id in set(revoked_token_ids):
        return True
    if active_token_id is not None and presented_token_id != active_token_id:
        return True
    return False


# Roles for which MFA is mandatory to reach protected work (mirrors the runtime
# MFA_MANDATORY_ROLES; duplicated here only as a pure constant for testing).
MFA_REQUIRED_ROLES = frozenset({
    "doctor", "nurse", "pharmacist", "corporate_admin", "compliance_reviewer", "admin",
})


def mfa_required(role: str) -> bool:
    return (role or "").strip().lower() in MFA_REQUIRED_ROLES
