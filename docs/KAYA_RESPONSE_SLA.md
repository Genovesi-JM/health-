# KAYA Response — SLA & timing governance (Phase R8)

Response timing targets are **internal governance thresholds, not promises**
(`backend/app/response_sla.py`, domain-pure). They are measured to review
performance and flag breaches for a named owner; they are never surfaced to a
reporter as an ETA or guarantee.

## Invariants enforced

- **Targets are hypotheses until signed.** `targets_approved` requires a named
  signer and positive ack/resolution targets; Response may not operate against
  unsigned/unset targets.
- **Never a promise.** `sla_target_is_a_promise()` is always False;
  `reporter_message_makes_no_time_promise` reuses the Phase 21 guard to keep
  ETA/wait language out of reporter messages.
- **Internal measurement only.** `ack_within_target`, `resolution_within_target`,
  and `is_breach` compute governance signals (None when pending) — a breach is a
  signal for a named owner, never a reporter-facing event.

## Tests — `backend/phaseR8_tests/test_response_sla.py` (6, all passing)

Targets require signature + values; SLA is never a promise; reporter messages make
no time promise; ack/resolution within-target (pending→None); internal breach
detection (pending-overdue and late-ack).

## Human intervention / external gates (owner-bound)

- **Signed SLA targets.** A named operations/clinical owner must set and sign the
  internal ack/resolution targets, validated by drills (Phase R11) — until then
  the targets are hypotheses (ties to R14).
- **No reporter-facing ETA** ever; product/copy must not display timing promises.
- **Clinical release stays HOLD; Response stays DISABLED.**
