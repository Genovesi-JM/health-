"""Transactional booking: hold-to-confirm, idempotency, and single-owner
capacity (Phase 23). Domain-pure logic; the production conflict prevention must
be enforced at the DATABASE level (a unique constraint on the reserved slot),
not with process-local locks, and proven on PostgreSQL (see the note below).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

# Booking states and transitions.
STATES = {"hold", "confirmed", "cancelled", "rescheduled", "no_show", "expired", "failed"}
_TRANSITIONS = {
    "hold": {"confirmed", "expired", "cancelled", "failed"},
    "confirmed": {"cancelled", "rescheduled", "no_show"},
    "rescheduled": {"confirmed", "cancelled"},
    "cancelled": set(),
    "no_show": set(),
    "expired": set(),
    "failed": set(),
}

HOLD_TTL = timedelta(minutes=10)


def can_transition(src: str, dst: str) -> bool:
    return src in _TRANSITIONS and dst in _TRANSITIONS.get(src, set())


@dataclass
class Hold:
    hold_id: str
    slot_id: str
    owner_id: str
    idempotency_key: str
    created_at: datetime
    quoted_terms: dict
    state: str = "hold"

    def expired(self, now: datetime) -> bool:
        return now - self.created_at > HOLD_TTL


class IdempotencyStore:
    """A lost-response retry with the same key returns the ORIGINAL result and
    never creates a duplicate appointment/payment/notification/audit record."""

    def __init__(self) -> None:
        self._results: dict[str, Any] = {}

    def run(self, key: str, produce) -> Any:
        if key in self._results:
            return self._results[key]           # replay original; no duplicate side effect
        result = produce()
        self._results[key] = result
        return result

    def seen(self, key: str) -> bool:
        return key in self._results


class CapacityConflict(Exception):
    pass


class CapacityLedger:
    """At most one active booking owns a constrained slot. In production this is a
    DB unique constraint on (slot_id) for active bookings; here it models the
    single-owner invariant."""

    def __init__(self) -> None:
        self._owner: dict[str, str] = {}

    def reserve(self, slot_id: str, owner_id: str) -> None:
        existing = self._owner.get(slot_id)
        if existing is not None and existing != owner_id:
            raise CapacityConflict(f"slot {slot_id} already owned")
        self._owner[slot_id] = owner_id

    def release(self, slot_id: str, owner_id: str) -> None:
        if self._owner.get(slot_id) == owner_id:
            del self._owner[slot_id]

    def owner(self, slot_id: str) -> Optional[str]:
        return self._owner.get(slot_id)


@dataclass
class ConfirmRevalidation:
    credentials_current: bool
    privilege_granted: bool
    org_can_operate: bool
    consent_effective: bool
    service_active: bool
    age_capacity_ok: bool
    jurisdiction_ok: bool


def can_confirm(hold: Hold, rv: ConfirmRevalidation, now: datetime) -> bool:
    """Confirmation revalidates every authority/consent condition and the hold
    must be unexpired. Fail closed."""
    if hold.state != "hold" or hold.expired(now):
        return False
    return all((
        rv.credentials_current, rv.privilege_granted, rv.org_can_operate,
        rv.consent_effective, rv.service_active, rv.age_capacity_ok, rv.jurisdiction_ok,
    ))


def ui_shows_confirmed(transaction_committed: bool) -> bool:
    """The UI never shows 'confirmed' until the server transaction has committed
    the capacity reservation."""
    return transaction_committed


def replay_before_write(external_outcome_known: bool) -> bool:
    """After an unknown response, reconcile the external payment/notification
    outcome BEFORE replaying an uncertain write."""
    return external_outcome_known


# The production conflict prevention is a DB-level unique constraint, not a
# process lock; PostgreSQL concurrency evidence is required for the release gate.
CONFLICT_ENFORCEMENT = "database_unique_constraint"
POSTGRES_CONCURRENCY_EVIDENCE_REQUIRED = True
