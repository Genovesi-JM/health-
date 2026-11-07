"""Clinician credential verification and privileging lifecycle (Phase 17).
Domain-pure. Professional verification is a human-governed, primary-source,
expiring decision that gates every clinical action. Automated provider checks are
evidence only; no public, support, automated, or legacy path activates clinical
authority.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

# Lifecycle states and permitted transitions (human-governed).
STATES = {"draft", "needs_information", "pending_review", "verified",
          "suspended", "expired", "revoked", "rejected"}
_TRANSITIONS = {
    "draft": {"pending_review", "needs_information"},
    "needs_information": {"pending_review", "rejected"},
    "pending_review": {"verified", "needs_information", "rejected"},
    "verified": {"suspended", "expired", "revoked"},
    "suspended": {"verified", "revoked"},          # reactivation by authorized decision
    "expired": {"pending_review", "revoked"},      # re-verification
    "revoked": set(),                              # terminal
    "rejected": {"pending_review"},
}

# Only a verified (active) status permits clinical work.
CLINICAL_OK_STATUS = "verified"

# Provider-check outcomes that can never approve (evidence only, non-live).
NON_LIVE_CHECK = frozenset({"mock", "sandbox", "not_configured", "stale", "inconclusive", "failed", "pending"})


def can_transition(src: str, dst: str) -> bool:
    return src in _TRANSITIONS and dst in _TRANSITIONS.get(src, set())


def provider_check_can_approve(check_status: str, live: bool) -> bool:
    """A provider check is evidence, not an approval. Non-live / bad outcomes
    can never approve."""
    return live and check_status == "completed" and check_status not in NON_LIVE_CHECK


def status_permits_clinical(status: str) -> bool:
    return status == CLINICAL_OK_STATUS


@dataclass
class Decision:
    allow: bool
    reason: str

    def __bool__(self) -> bool:
        return self.allow


@dataclass
class Evidence:
    primary_source: bool          # verified against the issuing authority
    live: bool                    # not mock/sandbox
    check_status: str             # completed | failed | ...
    malware_clean: bool
    valid_type_and_size: bool
    not_expired: bool
    insurance_ok: bool            # or insurance_not_required
    good_standing: bool


@dataclass
class PrivilegingDecision:
    applicant_id: str
    reviewer_id: str
    reviewer_mfa_verified: bool
    reviewer_role: str            # credentialing_authority | compliance_reviewer
    second_approver_id: Optional[str]   # four-eyes for activation
    jurisdiction: Optional[str]
    profession: Optional[str]
    organization_id: Optional[str]
    scope: Optional[str]
    effective_from: Optional[date]
    effective_to: Optional[date]
    audit_committed: bool


def can_activate_privilege(d: PrivilegingDecision, e: Evidence) -> Decision:
    """All conditions must hold to activate clinical authority; fails closed."""
    # Human, authorized, MFA-verified reviewer — never the applicant, never support.
    if d.reviewer_role not in ("credentialing_authority", "compliance_reviewer"):
        return Decision(False, "unauthorized reviewer role")
    if d.reviewer_id == d.applicant_id:
        return Decision(False, "conflict of interest: self-approval")
    if not d.reviewer_mfa_verified:
        return Decision(False, "reviewer MFA required")
    # Four-eyes: a distinct second approver for activation.
    if not d.second_approver_id or d.second_approver_id in (d.reviewer_id, d.applicant_id):
        return Decision(False, "four-eyes activation requires a distinct second approver")
    # Primary-source, live, clean, unexpired evidence.
    if not (e.primary_source and e.live and provider_check_can_approve(e.check_status, e.live)):
        return Decision(False, "primary-source live evidence required (provider check is evidence only)")
    if not (e.malware_clean and e.valid_type_and_size and e.not_expired and e.good_standing and e.insurance_ok):
        return Decision(False, "evidence incomplete or failing")
    # Required decision attributes.
    if not all([d.jurisdiction, d.profession, d.organization_id, d.scope, d.effective_from]):
        return Decision(False, "jurisdiction/profession/org/scope/effective dates required")
    # Audit must commit atomically with the decision.
    if not d.audit_committed:
        return Decision(False, "audit transition must commit atomically; audit failure fails the decision")
    return Decision(True, "activated")


# Loss of status must propagate promptly to all of these.
REVOCATION_PROPAGATION = (
    "sessions", "caches", "queue_visibility", "prescribing",
    "records_access", "video", "future_appointments",
)


def status_loss_blocks_clinical(new_status: str) -> bool:
    """Any non-verified status blocks clinical endpoints (without deleting history)."""
    return new_status != CLINICAL_OK_STATUS
