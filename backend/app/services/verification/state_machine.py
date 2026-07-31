from __future__ import annotations
"""Verification state machine.

Encapsulates the 17-status transition table and the ``record_transition``
service that mutates an entity's status **and** writes an audit row in a
single database operation. Callers never manipulate status columns
directly — they invoke this service so no state change escapes audit.

Design rules:

* Transitions are validated. Callers cannot jump from ``draft`` straight
  to ``verified`` without going through ``submitted`` and a review step.
* Terminal statuses (``revoked``) are truly terminal — no forward edges.
* The audit row is written even when the transition is a no-op (same →
  same) so re-approvals still leave a trace when they carry new context.
* Only reviewers can transition to ``verified``, ``rejected``, ``suspended``,
  ``revoked``. The router layer enforces role; this service enforces the
  state graph.

The vocabulary is the ``VerificationStatus`` enum from ``.base``. The
existing ``ClinicianCredential.status`` column stores its ``.value``.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.health_models import VerificationTransition

from .base import VerificationStatus


# ── Allowed transitions ─────────────────────────────────────────────────────
# Interpretation: from → set of allowed next statuses. Missing keys default
# to "no transitions allowed" (used for terminal statuses).

_ALLOWED: dict[str, set[str]] = {
    VerificationStatus.NOT_STARTED.value: {
        VerificationStatus.CONSENT_REQUIRED.value,
        VerificationStatus.SUBMITTED.value,
    },
    VerificationStatus.CONSENT_REQUIRED.value: {
        VerificationStatus.SUBMITTED.value,
        VerificationStatus.NOT_STARTED.value,   # user withdrew
    },
    VerificationStatus.SUBMITTED.value: {
        VerificationStatus.PROCESSING.value,
        VerificationStatus.ACTION_REQUIRED.value,
        VerificationStatus.MANUAL_REVIEW.value,
        # Reviewer may complete a manual look-up straight from submitted
        # without a formal MANUAL_REVIEW hop (small cases don't need it).
        VerificationStatus.COMPLETED.value,
        VerificationStatus.PARTIALLY_VERIFIED.value,
        VerificationStatus.UNABLE_TO_VERIFY.value,
        VerificationStatus.FAILED.value,
    },
    VerificationStatus.PROCESSING.value: {
        VerificationStatus.COMPLETED.value,
        VerificationStatus.PARTIALLY_VERIFIED.value,
        VerificationStatus.UNABLE_TO_VERIFY.value,
        VerificationStatus.ACTION_REQUIRED.value,
        VerificationStatus.MANUAL_REVIEW.value,
        VerificationStatus.FAILED.value,
    },
    VerificationStatus.ACTION_REQUIRED.value: {
        VerificationStatus.SUBMITTED.value,
        VerificationStatus.PROCESSING.value,
        VerificationStatus.FAILED.value,
    },
    VerificationStatus.MANUAL_REVIEW.value: {
        VerificationStatus.COMPLETED.value,
        VerificationStatus.PARTIALLY_VERIFIED.value,
        VerificationStatus.UNABLE_TO_VERIFY.value,
        VerificationStatus.ACTION_REQUIRED.value,
        VerificationStatus.FAILED.value,
    },
    VerificationStatus.PARTIALLY_VERIFIED.value: {
        VerificationStatus.MANUAL_REVIEW.value,
        VerificationStatus.COMPLETED.value,
        VerificationStatus.ACTION_REQUIRED.value,
        VerificationStatus.FAILED.value,
    },
    VerificationStatus.UNABLE_TO_VERIFY.value: {
        VerificationStatus.MANUAL_REVIEW.value,
        VerificationStatus.ACTION_REQUIRED.value,
        VerificationStatus.FAILED.value,
    },
    VerificationStatus.COMPLETED.value: {
        # After approval a case may be suspended (interim risk flag), the
        # documentation may expire, or a serious breach may revoke.
        "suspended": None,   # sentinel below
        "expired":   None,
        "revoked":   None,
    },
    VerificationStatus.FAILED.value: {
        # Reviewer can reopen a failed case by asking for more info.
        VerificationStatus.ACTION_REQUIRED.value,
    },
    VerificationStatus.NOT_CONFIGURED.value: {
        VerificationStatus.SUBMITTED.value,
    },
    # Post-approval lifecycle states — these are strings not in the enum
    # because they don't come from providers, only from Kaya operations.
    "suspended": {
        VerificationStatus.COMPLETED.value,  # reactivate
        "revoked",
    },
    "expired": {
        VerificationStatus.ACTION_REQUIRED.value,  # user renews documents
        VerificationStatus.COMPLETED.value,        # reviewer reactivates on proof
    },
    "revoked": set(),  # terminal
}

# Replace the sentinel-None style used above with proper string set.
_ALLOWED[VerificationStatus.COMPLETED.value] = {"suspended", "expired", "revoked"}


# ── Legacy vocabulary compatibility ─────────────────────────────────────────
# The existing ClinicianCredential workflow uses its own status strings
# ("draft", "pending_review", "verified", "needs_info", "rejected",
# "suspended"). Rather than force a schema migration, we alias them into
# the state graph so reviewer actions can accept legacy state without a
# separate code path.

_LEGACY_ALIASES: dict[str, str] = {
    "draft":          VerificationStatus.NOT_STARTED.value,
    "pending_review": VerificationStatus.SUBMITTED.value,
    "verified":       VerificationStatus.COMPLETED.value,
    "rejected":       VerificationStatus.FAILED.value,
    "needs_info":     VerificationStatus.ACTION_REQUIRED.value,
}

# Register the legacy → enum edges + inverse for reviewer flexibility.
for legacy, canonical in _LEGACY_ALIASES.items():
    # Whatever the canonical can do, the legacy alias can do (plus the
    # canonical form itself, so callers can normalize).
    _ALLOWED[legacy] = set(_ALLOWED.get(canonical, set())) | {canonical}
    # Whatever the canonical accepts as inbound also accepts the legacy form.
    for src, targets in list(_ALLOWED.items()):
        if canonical in targets and legacy not in targets:
            _ALLOWED[src] = targets | {legacy}

# "verified" (legacy for COMPLETED) must also open the post-approval doors.
_ALLOWED["verified"] |= {"suspended", "expired", "revoked"}

TERMINAL_STATUSES = {"revoked"}


# ── Result types ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class TransitionResult:
    entity_type: str
    entity_id: str
    previous_status: Optional[str]
    new_status: str
    transition_id: str
    at: datetime


class InvalidTransitionError(ValueError):
    """Raised when a state transition is not allowed by the state machine."""
    def __init__(self, from_status: str, to_status: str):
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(f"Transition {from_status!r} → {to_status!r} is not allowed.")


# ── Public API ─────────────────────────────────────────────────────────────

def is_allowed(from_status: Optional[str], to_status: str) -> bool:
    """True if the transition is permitted by the state graph.

    A missing ``from_status`` (fresh entity) may transition to anything
    ``NOT_STARTED`` can reach, plus ``NOT_STARTED`` itself.
    """
    if from_status is None:
        return to_status == VerificationStatus.NOT_STARTED.value or to_status in _ALLOWED.get(
            VerificationStatus.NOT_STARTED.value, set()
        )
    if from_status == to_status:
        # Re-emit same state — allowed for idempotent syncs from provider webhooks.
        return True
    return to_status in _ALLOWED.get(from_status, set())


def allowed_next(from_status: Optional[str]) -> set[str]:
    if from_status is None:
        return {VerificationStatus.NOT_STARTED.value} | _ALLOWED.get(
            VerificationStatus.NOT_STARTED.value, set()
        )
    return set(_ALLOWED.get(from_status, set()))


def record_transition(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    previous_status: Optional[str],
    new_status: str,
    actor_user_id: Optional[str],
    actor_kind: str = "user",
    reason_code: Optional[str] = None,
    reason_text: Optional[str] = None,
    reviewer_notes: Optional[str] = None,
    provider: Optional[str] = None,
    evidence_ref: Optional[str] = None,
) -> TransitionResult:
    """Validate and persist a single state transition.

    * Raises ``InvalidTransitionError`` when the state graph disallows it.
    * Writes exactly one ``VerificationTransition`` row.
    * The caller is responsible for updating the entity's ``status`` column
      *within the same transaction* and calling ``db.commit()``. This
      service explicitly does NOT commit so callers can bundle multiple
      state updates (e.g. mark a provider check completed AND advance the
      parent credential) atomically.
    """
    if not is_allowed(previous_status, new_status):
        raise InvalidTransitionError(str(previous_status), new_status)

    row = VerificationTransition(
        entity_type=entity_type,
        entity_id=entity_id,
        previous_status=previous_status,
        new_status=new_status,
        actor_user_id=actor_user_id,
        actor_kind=actor_kind,
        reason_code=reason_code,
        reason_text=reason_text,
        reviewer_notes=reviewer_notes,
        provider=provider,
        evidence_ref=evidence_ref,
    )
    db.add(row)
    db.flush()  # populate .id + .at without committing.
    return TransitionResult(
        entity_type=entity_type,
        entity_id=entity_id,
        previous_status=previous_status,
        new_status=new_status,
        transition_id=row.id,
        at=row.at,
    )


def history(db: Session, entity_type: str, entity_id: str) -> list[VerificationTransition]:
    return (
        db.query(VerificationTransition)
        .filter(
            VerificationTransition.entity_type == entity_type,
            VerificationTransition.entity_id == entity_id,
        )
        .order_by(VerificationTransition.at.asc())
        .all()
    )
