"""Invitation tokens and lifecycle-safe onboarding (Phase 16). Domain-pure.

Onboarding is resumable but onboarding state never grants authority. Invitation
tokens are hashed, single-use, expiring, and bound to an exact recipient and
purpose; tampering, replay, wrong recipient/purpose, revocation, and expiry fail
closed **without revealing account state**. Completing a UI wizard cannot set a
privileged role, a verified credential, an active membership, or a clinical
privilege — those are separate gated states.
"""
from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass
class InvitationToken:
    token_hash: str
    recipient: str            # exact recipient (e.g. email) the invite is bound to
    purpose: str              # exact purpose (e.g. clinician_onboarding)
    expiry: datetime
    used: bool = False
    revoked: bool = False


@dataclass
class InviteResult:
    ok: bool
    reason: str               # generic; never reveals account state

    def __bool__(self) -> bool:
        return self.ok


_GENERIC_FAIL = "invitation invalid or expired"   # never reveals which check failed to a caller


def validate_invitation(presented_raw: str, stored: Optional[InvitationToken],
                        recipient: str, purpose: str,
                        now: Optional[datetime] = None) -> InviteResult:
    """Fail closed with a single generic reason so nothing reveals account state."""
    now = now or datetime.utcnow()
    if stored is None:
        return InviteResult(False, _GENERIC_FAIL)
    if not hmac.compare_digest(hash_token(presented_raw), stored.token_hash):
        return InviteResult(False, _GENERIC_FAIL)      # tampered / wrong token
    if stored.revoked or stored.used:
        return InviteResult(False, _GENERIC_FAIL)      # revoked / replay
    if now > stored.expiry:
        return InviteResult(False, _GENERIC_FAIL)      # expired
    if stored.recipient != recipient or stored.purpose != purpose:
        return InviteResult(False, _GENERIC_FAIL)      # wrong recipient / purpose
    return InviteResult(True, "accepted")


# ── Onboarding states (separate; none grants authority) ──────────────────────

ONBOARDING_STATES = [
    "application", "invitation", "identity_verification", "profile_completion",
    "credentialing", "membership", "privilege", "consent", "activation",
]

# Capability-granting states that require an authorized human/gated process,
# NOT a wizard step.
AUTHORITY_STATES = frozenset({"credentialing", "membership", "privilege", "activation"})


def state_grants_authority(state: str) -> bool:
    """Onboarding state itself never grants authority."""
    return False


def wizard_completion_grants(field: str) -> bool:
    """A completed UI wizard step can never directly set these."""
    return field not in ("privileged_role", "verified_credential", "active_membership", "clinical_privilege")


def can_advance(current: str, target: str) -> bool:
    """No step-skipping into an authority-granting state; advance one step at a time."""
    if current not in ONBOARDING_STATES or target not in ONBOARDING_STATES:
        return False
    ci, ti = ONBOARDING_STATES.index(current), ONBOARDING_STATES.index(target)
    if ti <= ci:
        return False
    if ti - ci != 1:
        return False                                    # no skipping
    return True


def professional_restricted_until_gates(identity_ok: bool, mfa_ok: bool,
                                        credential_ok: bool, org_ok: bool,
                                        privilege_ok: bool) -> bool:
    """A professional account stays restricted until ALL gates complete."""
    return not (identity_ok and mfa_ok and credential_ok and org_ok and privilege_ok)


# ── Deep-link safety ─────────────────────────────────────────────────────────

def is_deep_link_safe(destination_type: Optional[str], token_in_url: bool,
                      redirect_allowlisted: bool) -> bool:
    """A deep link must bind to a typed destination, not carry the token in a
    referrer-exposed URL, and only redirect within an allowlist."""
    return bool(destination_type) and not token_in_url and redirect_allowlisted
