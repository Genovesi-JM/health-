# KAYA Response — escalation routing to authorized humans (Phase R3)

An accepted incident is routed to an authorized on-call human, human-in-the-loop,
with no auto-dispatch and a fail-closed fallback (`backend/app/response_routing.py`,
domain-pure).

## Invariants enforced

- **Responder eligibility.** `responder_eligible` requires on-shift,
  credential-current, an authorized profession (doctor/nurse/clinician/response
  coordinator), and jurisdiction coverage.
- **Human-in-the-loop.** `route` delivers to the first eligible responder but
  delivery is not acknowledgement; `acknowledge` (assigned responder only) is the
  explicit human step, and nothing acts before it.
- **Fail-closed fallback.** With no eligible responder, `route` returns
  `to_fallback=True` — the incident is never silently dropped (handed to Phase R4).
- **No auto-dispatch.** `auto_dispatch_possible()` is always False.
- **Stays open.** `escalation_open` is true until a human acknowledges or the
  fallback takes ownership.

## Tests — `backend/phaseR3_tests/test_response_routing.py` (7, all passing)

Eligibility rules; route to eligible; delivery != acknowledgement; only-assigned
may ack; no-responder fails closed to fallback; no auto-dispatch; picks first
eligible.

## Human intervention / external gates (owner-bound)

- **On-call roster & responder authority** (Phase R5) defined by named operations/
  clinical owners; no responder exists by default.
- **Fallback path** operationalized (Phase R4).
- **Clinical release stays HOLD; Response stays DISABLED.**
