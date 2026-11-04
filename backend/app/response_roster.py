"""KAYA Response — responder identity, on-call roster & authority (Phase R5).
Domain-pure.

A responder holds Response authority only within a signed on-call shift, while
credential-current and privileged, for an approved jurisdiction. An active
Response window must have continuous coverage: any gap with no eligible on-call
responder fails closed (Response may not operate over a gap). A named substitute
chain covers absences. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

_AUTHORIZED_PROFESSIONS = frozenset({"doctor", "nurse", "clinician", "response_coordinator"})


@dataclass(frozen=True)
class OnCallSlot:
    responder_id: str
    profession: str
    jurisdiction: str
    start_epoch: int
    end_epoch: int
    credentials_current: bool
    response_privileged: bool           # explicitly privileged for Response
    revoked: bool = False


def slot_active(slot: OnCallSlot, at_epoch: int) -> bool:
    return slot.start_epoch <= at_epoch < slot.end_epoch


def responder_authorized(slot: OnCallSlot, at_epoch: int, jurisdiction: str) -> bool:
    """Authority holds only within the shift, credential-current, Response-privileged,
    of an authorized profession, in the jurisdiction, and not revoked."""
    return (
        not slot.revoked
        and slot_active(slot, at_epoch)
        and slot.credentials_current
        and slot.response_privileged
        and slot.profession in _AUTHORIZED_PROFESSIONS
        and slot.jurisdiction == jurisdiction
    )


@dataclass(frozen=True)
class Roster:
    roster_id: str
    jurisdiction: str
    slots: tuple
    signed_off_by: Optional[str] = None


def roster_signed(roster: Roster) -> bool:
    return bool(roster.signed_off_by)


def eligible_at(roster: Roster, at_epoch: int) -> tuple:
    return tuple(s for s in roster.slots
                 if responder_authorized(s, at_epoch, roster.jurisdiction))


def coverage_ok(roster: Roster, window_start: int, window_end: int, step: int = 60) -> bool:
    """Every sampled instant of the window must have at least one eligible
    responder. A gap fails closed. The roster must also be signed."""
    if not roster_signed(roster):
        return False
    if window_end <= window_start:
        return False
    t = window_start
    while t < window_end:
        if not eligible_at(roster, t):
            return False                # coverage gap
        t += step
    return True


def coverage_gaps(roster: Roster, window_start: int, window_end: int, step: int = 60) -> tuple:
    """Return the sampled instants with no eligible responder (for owner review)."""
    gaps = []
    t = window_start
    while t < window_end:
        if not eligible_at(roster, t):
            gaps.append(t)
        t += step
    return tuple(gaps)


def substitute_available(roster: Roster, at_epoch: int, primary_id: str) -> Optional[str]:
    """A named substitute is the next eligible responder that is not the primary."""
    for s in eligible_at(roster, at_epoch):
        if s.responder_id != primary_id:
            return s.responder_id
    return None
