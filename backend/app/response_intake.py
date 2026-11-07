"""KAYA Response — incident intake & red-flag detection (Phase R2). Domain-pure.

Accepts a Response incident report ONLY when Response is active and the intake
capability is permitted for the scope/jurisdiction; detects emergency red-flags
and always surfaces the emergency redirect; and NEVER auto-acts — an incident is
data routed to an authorized human, never a command that dispatches, contacts, or
triggers anything on its own.

Composes the Phase 28 messaging red-flags and the Phase R0/R1 gates. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from . import clinical_messaging
from . import response_scope

INTAKE_CAPABILITY = "symptom_intake"


class ResponseIntakeError(Exception):
    """An intake precondition failed (fail-closed)."""


@dataclass(frozen=True)
class IncidentReport:
    reporter_id: str
    jurisdiction: str
    text: str
    consented: bool
    reported_at_epoch: int
    external_id: Optional[str] = None


@dataclass(frozen=True)
class IntakeResult:
    accepted: bool
    emergency_redirect: bool
    routed_for_human_review: bool
    boundary_notice: str
    reasons: tuple = ()


def emergency_redirect_required(text: str) -> bool:
    """Reuse the Phase 28 red-flag detector."""
    return clinical_messaging.requires_emergency_redirect(text)


def incident_auto_actionable(report: IncidentReport) -> bool:
    """ALWAYS False — an incident report never auto-executes any Response action."""
    return False


def intake(report: IncidentReport, scope: response_scope.ResponseScope,
           response_active: bool) -> IntakeResult:
    """Fail-closed intake. Accept only when Response is active, the intake
    capability is permitted for the jurisdiction, the report is consented and
    non-empty. An accepted report is ROUTED for human review — never acted on.
    The emergency redirect and boundary notice are always computed."""
    reasons: list[str] = []
    redirect = emergency_redirect_required(report.text)
    notice = response_scope.boundary_notice()

    if not response_active:
        reasons.append("Response is not active")
    if not response_scope.capability_permitted(scope, INTAKE_CAPABILITY,
                                               report.jurisdiction, response_active):
        reasons.append("intake capability not permitted for this scope/jurisdiction")
    if not report.consented:
        reasons.append("no consent to record the incident")
    if not report.text or not report.text.strip():
        reasons.append("empty report")

    accepted = not reasons
    return IntakeResult(
        accepted=accepted,
        emergency_redirect=redirect,
        routed_for_human_review=accepted,     # accepted reports go to a human, never auto-act
        boundary_notice=notice,
        reasons=tuple(reasons),
    )


class IncidentLedger:
    """Idempotent intake: a repeated external id is ignored (no duplicate
    incidents from a retried submission)."""

    def __init__(self) -> None:
        self._seen: set[tuple] = set()

    def accept(self, reporter_id: str, external_id: Optional[str]) -> bool:
        if not external_id:
            return True
        key = (reporter_id, external_id)
        if key in self._seen:
            return False
        self._seen.add(key)
        return True
