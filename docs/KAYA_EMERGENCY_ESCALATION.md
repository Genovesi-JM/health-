# Kaya emergency escalation & unavailable-service (Phase 21)

Evidence date 14 September 2026. Truthful escalation when Kaya cannot safely
assess or deliver care — never representing Kaya as the emergency responder.
Enforced by [`backend/app/emergency.py`](../backend/app/emergency.py); tested in
[`backend/phase21_tests`](../backend/phase21_tests).

- **Server-owned versioned registry** by jurisdiction/region/language with source
  URL, verification date, owner and expiry. `get_emergency_guidance` returns the
  approved, verified, unexpired local number only for a matching jurisdiction +
  language; **unknown, expired, or untranslated → generic local-emergency
  guidance with no guessed number**.
- **Always reachable** without auth, payment, account, consent, AI, or video, and
  during API/auth/AI/video/payment/clinician outages (`guidance_reachable`).
- **Deterministic triggers** (`should_escalate`): red flags, mental-health crisis,
  safeguarding, failed assessment, no clinician coverage, provider outage,
  dangerous wait — routed to approved guidance, **no unverified hospital alert**.
- **Truthful copy** (`claims_no_external_action`): no dispatch/notify/prepare/
  reserve/prioritize claim and no estimated-response/queue/wait promise; the
  disclaimer states Kaya has not contacted emergency services or a hospital.
- **Telemetry hygiene** (`sanitize_escalation_event`): nonclinical operational
  fields only; no symptom/health detail in emergency-link telemetry.

**Human gate (BLOCKED_EXTERNAL):** emergency numbers, pathways, translations, and
service claims require dated verification by the jurisdictional clinical/
operational owner; all language variants need human safety review.
