"""AI/LLM egress and clinical-content boundary (Phase 30). Domain-pure.

The assistant may help patients navigate care, but its use of an external model
must not leak PHI, must not diagnose or prescribe, must not be steered by
prompt-injection, and must never trigger a clinical action. This module is the
canonical, fail-closed egress boundary; it composes `app.redaction` (secrets) and
adds PHI scrubbing.

Enforced invariants:

  * External egress is DISABLED by default. Sending patient context to an external
    model requires an operator enable flag AND the patient's AI-sharing consent
    AND a provider DPA in place — all three, or nothing patient-specific leaves.
  * Before any egress the payload is scrubbed of PHI and secrets, and a final
    guard BLOCKS egress if any PHI/secret marker remains (fail-closed).
  * Untrusted content (the user message) is fenced as data and can never override
    the safety instructions; prompt-injection attempts are detected and neutralized
    but never obeyed.
  * The model's output is advisory only, carries a non-diagnostic disclaimer, and
    can NEVER auto-execute a clinical action (triage disposition, booking,
    prescribing). Emergencies are redirected, not handled by the model.

Stdlib-only (plus the in-repo redaction module) and importable without the app.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from . import redaction

PHI = "«PHI»"

AI_DISCLAIMER = (
    "Esta é uma orientação informativa e não substitui uma avaliação clínica. "
    "Não constitui diagnóstico nem prescrição."
)


# ── Errors ───────────────────────────────────────────────────────────────────

class EgressBlocked(Exception):
    """Egress refused because a safety precondition failed (fail-closed)."""


# ── Enable gate ──────────────────────────────────────────────────────────────

def egress_enabled(enabled_flag: Optional[str], consent_ai_sharing: bool,
                   dpa_in_place: bool) -> bool:
    """Patient-specific egress requires the operator flag, patient consent, and a
    provider DPA — all three."""
    flag_on = bool(enabled_flag) and enabled_flag.strip().lower() in {"true", "1", "yes", "on"}
    return flag_on and bool(consent_ai_sharing) and bool(dpa_in_place)


# ── PHI scrubbing ────────────────────────────────────────────────────────────

_PHI_PATTERNS = [
    re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"),          # email
    re.compile(r"(?<!\d)(?:\+?\d[\s\-]?){9,15}(?!\d)"),                        # phone/long number
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),                                      # ISO date (DOB)
    re.compile(r"\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b"),                          # d/m/y date
    re.compile(r"(?i)\bMRN[:#\s]*[A-Za-z0-9\-]{4,}\b"),                        # medical record no.
    re.compile(r"\b\d{6,}[A-Z]{2}\d{3}\b"),                                    # Angola BI-style id
    re.compile(r"(?i)\b(?:bilhete|BI|passport|passaporte)[:#\s]*[A-Za-z0-9\-]{5,}\b"),
]


def scrub_phi(text: str) -> str:
    """Replace PHI-shaped substrings and secrets. Not a guarantee of
    de-identification — a named privacy owner must validate before real egress."""
    if not isinstance(text, str):
        text = str(text)
    out = redaction.redact(text)                 # secrets/tokens/signed URLs first
    for rx in _PHI_PATTERNS:
        out = rx.sub(PHI, out)
    return out


def contains_phi_or_secret(text: str) -> bool:
    """Residual-marker check used as the final egress guard."""
    if not isinstance(text, str):
        text = str(text)
    if redaction.redact(text) != text:
        return True
    return any(rx.search(text) for rx in _PHI_PATTERNS)


def assert_outbound_safe(text: str) -> None:
    """Final fail-closed guard: refuse egress if any PHI/secret remains."""
    if contains_phi_or_secret(text):
        raise EgressBlocked("outbound payload still contains PHI or secret material")


# ── Prompt-injection resistance ──────────────────────────────────────────────

_INJECTION_PATTERNS = [
    re.compile(r"(?i)ignore\s+(?:\w+\s+){0,3}(instructions|rules|prompt)"),
    re.compile(r"(?i)disregard\s+(?:\w+\s+){0,3}(system|previous|above|instructions|rules)"),
    re.compile(r"(?i)you are now\b"),
    re.compile(r"(?i)developer mode"),
    re.compile(r"(?i)reveal (your|the) (system )?(prompt|instructions)"),
    re.compile(r"(?i)act as (an?|the) \w+"),
    re.compile(r"(?i)pretend (to be|you are)"),
]


def injection_detected(text: str) -> bool:
    return any(rx.search(text or "") for rx in _INJECTION_PATTERNS)


def fence_untrusted(text: str) -> str:
    """Fence user content as DATA so it cannot be read as instructions."""
    safe = (text or "").replace("`", "'")
    return f"[USER_CONTENT_START]\n{safe}\n[USER_CONTENT_END]"


# ── Outbound assembly (fail-closed) ──────────────────────────────────────────

@dataclass(frozen=True)
class Outbound:
    messages: tuple
    included_patient_context: bool
    injection_flagged: bool


def build_outbound(system_safety_prompt: str, user_message: str,
                   patient_context: Optional[str], egress_ok: bool) -> Outbound:
    """Assemble the model request. The safety prompt leads; user content is fenced
    as data; patient context is included ONLY when egress is permitted, and always
    scrubbed. The assembled non-system content is guarded for residual PHI."""
    flagged = injection_detected(user_message)
    messages = [{"role": "system", "content": system_safety_prompt}]

    included = False
    if patient_context and egress_ok:
        ctx = scrub_phi(patient_context)
        assert_outbound_safe(ctx)                 # never leak PHI even scrubbed
        messages.append({"role": "system", "content": f"Contexto (anonimizado): {ctx}"})
        included = True

    fenced = fence_untrusted(scrub_phi(user_message))
    assert_outbound_safe(fenced)
    messages.append({"role": "user", "content": fenced})

    return Outbound(tuple(messages), included, flagged)


# ── Output boundary ──────────────────────────────────────────────────────────

def ai_may_execute_action() -> bool:
    """ALWAYS False — model output never auto-executes a clinical action."""
    return False


_EMERGENCY_RE = re.compile(
    r"(?i)\b(chest pain|dor no peito|can'?t breathe|não consigo respirar|falta de ar|"
    r"suicid|stroke|avc|unconscious|inconsciente|anaphyla)\b"
)


def output_requires_emergency_redirect(text: str) -> bool:
    return bool(_EMERGENCY_RE.search(text or ""))


def finalize_output(ai_text: str) -> str:
    """Advisory-only: append the non-diagnostic disclaimer if not already present."""
    text = ai_text or ""
    if "não substitui uma avaliação clínica" in text:
        return text
    return f"{text}\n\n{AI_DISCLAIMER}".strip()


@dataclass(frozen=True)
class EgressAudit:
    egress_ok: bool
    included_patient_context: bool
    injection_flagged: bool
    provider: str
    consent: bool
    dpa: bool


def audit_record(outbound: Outbound, provider: str, consent: bool, dpa: bool,
                 egress_ok: bool) -> EgressAudit:
    """A minimal, PHI-free record that an egress occurred (or was blocked)."""
    return EgressAudit(
        egress_ok=egress_ok, included_patient_context=outbound.included_patient_context,
        injection_flagged=outbound.injection_flagged, provider=provider,
        consent=consent, dpa=dpa,
    )
