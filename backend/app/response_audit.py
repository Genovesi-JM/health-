"""KAYA Response — audit & incident record (Phase R9). Domain-pure.

Every Response incident lifecycle step (intake, route, acknowledge, fallback,
boundary event, resolution) is recorded on an append-only, tamper-evident hash
chain (reusing the Phase 36 audit chain). Boundary events are specially tracked
and never deletable; reads are access-controlled and records are PHI-minimized.

Composes `app.observability`. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import observability

# Recognized Response lifecycle events.
INTAKE = "response.intake"
ROUTE = "response.route"
ACK = "response.acknowledge"
FALLBACK = "response.fallback"
BOUNDARY_EVENT = "response.boundary_event"
RESOLUTION = "response.resolution"
KILL = "response.kill_switch"

_RESPONSE_EVENTS = frozenset({INTAKE, ROUTE, ACK, FALLBACK, BOUNDARY_EVENT, RESOLUTION, KILL})


class ResponseAuditError(Exception):
    pass


class ResponseIncidentLog:
    """A tamper-evident incident log built on the Phase 36 AuditChain."""

    def __init__(self) -> None:
        self._chain = observability.AuditChain()

    def record(self, action: str, actor_id: Optional[str], incident_id: str,
               outcome: str, at_epoch: int) -> None:
        if action not in _RESPONSE_EVENTS:
            raise ResponseAuditError(f"unknown Response event: {action}")
        ev = observability.AuditEvent(
            actor_id=actor_id, action=action, resource_type="response_incident",
            resource_id=incident_id, outcome=outcome, at_epoch=at_epoch,
        )
        self._chain.append(ev)

    def verify(self) -> bool:
        return self._chain.verify()

    def entries(self) -> tuple:
        return self._chain.entries()

    def boundary_events(self) -> tuple:
        """All recorded boundary events (R15 zero-tolerance metric)."""
        return tuple(r for r in self._chain.entries()
                     if r.event.action == BOUNDARY_EVENT)

    def incident_events(self, incident_id: str) -> tuple:
        return tuple(r for r in self._chain.entries()
                     if r.event.resource_id == incident_id)


def can_read_response_audit(role: str, privileges: frozenset) -> bool:
    """Response audit reads are restricted to an auditor/security/compliance role
    (Phase 36) or a response supervisor with the audit_read privilege."""
    if observability.can_read_audit(role, privileges):
        return True
    return role == "response_supervisor" and "audit_read" in privileges


def delete_prohibited() -> None:
    raise ResponseAuditError("Response audit records are append-only; nothing is deleted")
