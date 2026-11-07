# KAYA Response — failed-escalation handling & fallback (Phase R4)

When an escalation cannot reach or be acknowledged by a responder, the system
fails **safe and loud** (`backend/app/response_fallback.py`, domain-pure). A
failed escalation is a zero-tolerance **boundary event** (risk register R15) — it
is never absorbed silently.

## Invariants enforced

- **Ack deadline.** `ack_deadline_exceeded` flags a delivered-but-unacknowledged
  escalation past the window (and a never-delivered one immediately).
- **Failure classification.** `is_failed_escalation` = not delivered, or delivered
  but unacknowledged past the deadline.
- **Boundary event.** `is_boundary_event(True)` — a failed escalation is tracked as
  a zero-tolerance boundary event.
- **Safe-and-loud fallback.** `handle_failure` always re-shows the reporter the
  emergency redirect (Phase 21 guidance) and the boundary notice, escalates to a
  supervisor tier, records a boundary event, and sets `silently_dropped=False`.
- **Reporter always informed.** `reporter_always_informed` is the invariant: a
  failure always gives the reporter emergency guidance; the incident is never
  dropped.

## Tests — `backend/phaseR4_tests/test_response_fallback.py` (5, all passing)

Ack-deadline detection; failed-escalation classification; failed-escalation is a
boundary event; safe-and-loud fallback (reporter informed, supervisor escalation,
boundary event, no silent drop); reporter-always-informed invariant.

## Human intervention / external gates (owner-bound)

- **Supervisor tier & drill evidence.** A named operations owner must staff the
  secondary/supervisor tier and run failed-escalation drills (Phase R11) with
  **zero** boundary events before any activation (R15).
- **Approved emergency numbers.** The emergency registry must be populated with
  approved, verified local numbers (Phase 21); until then the reporter gets the
  generic "contact local emergency services" guidance.
- **Clinical release stays HOLD; Response stays DISABLED.**
