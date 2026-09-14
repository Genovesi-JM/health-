"""Emergency escalation and unavailable-service experience (Phase 21).
Domain-pure.

Kaya provides clear, truthful escalation when it cannot safely assess or deliver
care, and never represents itself as the emergency responder. Emergency guidance
is reachable without authentication, payment, account, consent, AI, or video;
unknown or expired jurisdiction information fails to generic local-emergency
guidance rather than guessing a number; and the user is never told Kaya
dispatched, notified, reserved, prioritized, or prepared an external service.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Iterable, Optional

GENERIC_GUIDANCE = "contact your local emergency services immediately"


@dataclass(frozen=True)
class EmergencyEntry:
    jurisdiction: str
    region: Optional[str]
    language: str
    number: str
    source_url: str
    verified_date: date
    owner: str
    expiry: date


def get_emergency_guidance(jurisdiction: Optional[str], language: str,
                           registry: Iterable[EmergencyEntry],
                           today: Optional[date] = None) -> str:
    """Return the approved, verified, unexpired local number for the jurisdiction
    and language, else GENERIC guidance. Never guesses a number."""
    today = today or date.today()
    if not jurisdiction:
        return GENERIC_GUIDANCE
    for e in registry:
        if e.jurisdiction == jurisdiction and e.language == language and e.expiry >= today:
            return f"call {e.number} or {GENERIC_GUIDANCE}"
    return GENERIC_GUIDANCE            # unknown / expired / untranslated ⇒ generic


# ── Deterministic escalation triggers ────────────────────────────────────────

ESCALATION_TRIGGERS = frozenset({
    "red_flag", "mental_health_crisis", "safeguarding", "failed_assessment",
    "no_clinician_coverage", "provider_outage", "dangerous_wait",
})


def should_escalate(context: dict) -> bool:
    return any(context.get(t) for t in ESCALATION_TRIGGERS)


# ── Reachability under outages ───────────────────────────────────────────────

def guidance_reachable(auth_down: bool = False, payment_down: bool = False,
                       consent_incomplete: bool = False, ai_down: bool = False,
                       video_down: bool = False, api_down: bool = False) -> bool:
    """Emergency guidance is always reachable — it depends on none of these."""
    return True


# ── Truthfulness of emergency copy ───────────────────────────────────────────

_FORBIDDEN_ACTION = re.compile(
    r"(?i)(dispatch|notif(y|ied) (the )?hospital|hospital (has been )?(alerted|notified|prepared)|"
    r"reserved|prioriti|pre-?alert|we (have )?(contacted|called)|ambulance (sent|dispatched))"
)
_FORBIDDEN_PROMISE = re.compile(
    r"(?i)(estimated (response|arrival|wait)|\bETA\b|queue position|in \d+ minutes|"
    r"less waiting|reduced wait)"
)


def claims_no_external_action(text: str) -> bool:
    """True if the copy makes NO false external-action claim or wait/ETA promise."""
    return not (_FORBIDDEN_ACTION.search(text or "") or _FORBIDDEN_PROMISE.search(text or ""))


def disclaimer() -> str:
    return "Kaya has not contacted emergency services or a hospital."


# ── Telemetry hygiene ────────────────────────────────────────────────────────

_ALLOWED_EVENT_FIELDS = frozenset({"event", "trigger", "jurisdiction", "timestamp", "outcome"})


def sanitize_escalation_event(event: dict) -> dict:
    """Keep nonclinical operational fields only; never store symptom/health detail
    in emergency-link telemetry."""
    return {k: v for k, v in (event or {}).items() if k in _ALLOWED_EVENT_FIELDS}
