# Kaya AI/LLM egress and clinical-content boundary (Phase 30)

The assistant helps patients navigate care, but its use of an external model must
not leak PHI, must not diagnose or prescribe, must not be steered by
prompt-injection, and must never trigger a clinical action. `backend/app/ai_egress.py`
(domain-pure) is the canonical, fail-closed egress boundary; it composes
`app.redaction` (secrets) and adds PHI scrubbing.

## Invariants enforced

- **Egress disabled by default.** `egress_enabled` requires an operator flag AND
  the patient's AI-sharing consent AND a provider DPA — all three, or nothing
  patient-specific leaves the platform.
- **Scrub + fail-closed guard.** `scrub_phi` removes email, phone, dates (DOB),
  MRN and national-ID shapes plus secrets/tokens; `assert_outbound_safe` refuses
  egress if any PHI/secret marker remains after scrubbing. Patient context is
  included in a request ONLY when egress is permitted, and always scrubbed.
- **Untrusted content is data.** The safety system prompt always leads; the user
  message is fenced (`[USER_CONTENT_START]…END]`) so it cannot be read as
  instructions. `injection_detected` flags jailbreak attempts ("ignore previous
  instructions", "reveal your system prompt", "you are now…") — they are flagged
  and fenced but never obeyed, and the system prompt is unchanged.
- **Output is advisory only.** `finalize_output` appends a non-diagnostic
  disclaimer (idempotently); `ai_may_execute_action()` is always `False` so model
  output never auto-executes triage disposition, booking, or prescribing;
  `output_requires_emergency_redirect` surfaces emergencies instead of handling
  them.
- **PHI-free audit.** `audit_record` captures booleans/labels (egress ok, context
  included, injection flagged, provider, consent, DPA) with no message content.

## Tests — `backend/phase30_tests/test_ai_egress.py` (16, all passing)

Egress disabled by default and requires flag+consent+DPA; scrubbing of
email/phone/date/MRN/ID; residual-PHI detection and fail-closed guard; patient
context excluded when not permitted and scrubbed when permitted; user message
fenced and PHI-scrubbed; injection detection; injection flagged-but-fenced with
the safety prompt intact; AI never executes an action; disclaimer appended once;
emergency-redirect flag; PHI-free audit.

## Human intervention / external gates

- **Provider DPA + region/transfer (BLOCKED_EXTERNAL).** Sending any patient
  context to an external model (OpenAI/other) requires a signed DPA, a decided
  data region/transfer basis, and a named privacy owner's approval. Until then the
  authenticated flow runs without patient context (generic guidance/fallback).
- **De-identification validation.** `scrub_phi` is a safety net, not certified
  de-identification; a named privacy owner must validate it (and decide whether
  free-text egress is permitted at all) before real patient-context egress.
- **Clinical-content sign-off.** A named clinical owner must approve the assistant's
  scope and the non-diagnostic system prompt as fit for patients.
- **Runtime adoption verification** — a harness-verified task must confirm
  `chatbot.py` routes external calls through `build_outbound` /
  `assert_outbound_safe` and the disabled-by-default gate.
- R03 provider-egress risk: **AI sub-source reduced** (disabled-by-default egress
  boundary landed); payment providers remain under their own phase.
- **Clinical release stays HOLD.**
