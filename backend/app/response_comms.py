"""KAYA Response — communication boundary (Phase R6). Domain-pure.

Every outbound Response communication (to a reporter or between responders) must
carry the non-emergency boundary notice, make no external-action or timing
promise, and leak no PHI/secret to an unintended channel. A responder message can
never imply that Response dispatched help or contacted a hospital.

Composes Phase 21 emergency guards, Phase R1 scope, and the Phase 30 PHI guard.
Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import emergency
from . import response_scope
from .ai_egress import contains_phi_or_secret


class CommsBoundaryError(Exception):
    """An outbound Response message violated the communication boundary."""


@dataclass(frozen=True)
class OutboundMessage:
    body: str
    include_boundary_notice: bool = True


def message_within_boundary(body: str) -> bool:
    """No external-action claim and no wait/ETA promise (Phase 21 guard)."""
    return emergency.claims_no_external_action(body)


def compose_reporter_message(body: str) -> str:
    """Build a reporter-facing message: refuse a boundary-violating body, then
    always append the boundary notice."""
    if not message_within_boundary(body):
        raise CommsBoundaryError("message implies external action or a timing promise")
    return f"{body}\n\n{response_scope.boundary_notice()}"


def responder_message_ok(body: str, to_external_channel: bool) -> tuple[bool, tuple]:
    """A responder message must stay within boundary and must not carry PHI/secret
    to an external channel."""
    reasons: list[str] = []
    if not message_within_boundary(body):
        reasons.append("implies external action or timing promise")
    if to_external_channel and contains_phi_or_secret(body):
        reasons.append("PHI/secret must not go to an external channel")
    return (not reasons, tuple(reasons))


def boundary_notice_always_present(message: str) -> bool:
    """A composed reporter message must contain the boundary notice."""
    return response_scope.boundary_notice() in message
