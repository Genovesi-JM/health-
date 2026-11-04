"""KAYA Response — escalation routing to authorized humans (Phase R3). Domain-pure.

An accepted incident is routed to an authorized on-call human. Every escalation is
human-in-the-loop: it is delivered to a responder who must explicitly acknowledge
it; nothing is auto-dispatched, auto-contacted, or auto-resolved. If no authorized
responder is available, routing fails closed to the fallback path (Phase R4) — an
incident is never silently dropped.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

# Responder professions authorized to receive a Response escalation.
_AUTHORIZED_PROFESSIONS = frozenset({"doctor", "nurse", "clinician", "response_coordinator"})


class RoutingError(Exception):
    """A routing precondition failed (fail-closed)."""


@dataclass(frozen=True)
class Responder:
    responder_id: str
    profession: str
    on_shift: bool
    jurisdictions: frozenset
    credentials_current: bool


def responder_eligible(r: Responder, jurisdiction: str) -> bool:
    """A responder may receive an escalation only when on shift, credential-current,
    of an authorized profession, and covering the jurisdiction."""
    return (
        r.on_shift
        and r.credentials_current
        and r.profession in _AUTHORIZED_PROFESSIONS
        and jurisdiction in r.jurisdictions
    )


@dataclass(frozen=True)
class Escalation:
    incident_id: str
    jurisdiction: str
    assigned_to: Optional[str]
    delivered: bool
    acknowledged: bool
    to_fallback: bool
    reasons: tuple = ()


def route(incident_id: str, jurisdiction: str, candidates: list[Responder]) -> Escalation:
    """Route to the first eligible responder. If none is eligible, fail closed to
    the fallback path — never a silent drop, never an auto-dispatch."""
    eligible = [r for r in candidates if responder_eligible(r, jurisdiction)]
    if not eligible:
        return Escalation(incident_id, jurisdiction, assigned_to=None, delivered=False,
                          acknowledged=False, to_fallback=True,
                          reasons=("no eligible responder available",))
    chosen = eligible[0]
    # Delivery does not imply acknowledgement — the human must still ack (R3 loop).
    return Escalation(incident_id, jurisdiction, assigned_to=chosen.responder_id,
                      delivered=True, acknowledged=False, to_fallback=False)


def acknowledge(esc: Escalation, responder_id: str) -> Escalation:
    """Only the assigned responder may acknowledge; acknowledgement is the explicit
    human-in-the-loop step. Nothing acts before it."""
    from dataclasses import replace
    if esc.assigned_to is None or responder_id != esc.assigned_to:
        raise RoutingError("only the assigned responder may acknowledge")
    return replace(esc, acknowledged=True)


def auto_dispatch_possible() -> bool:
    """There is NO automatic dispatch/contact. Always False."""
    return False


def escalation_open(esc: Escalation) -> bool:
    """An escalation stays open (visible, unresolved) until a human acknowledges or
    the fallback path takes ownership."""
    if esc.to_fallback:
        return True                       # owned by fallback, still open
    return not esc.acknowledged
