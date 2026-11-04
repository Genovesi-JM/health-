# KAYA Response — drills & readiness evidence (Phase R11)

Response may not be considered ready without drilled evidence
(`backend/app/response_drills.py`, domain-pure): recent signed drills covering
every required failure scenario, all passing, with **zero boundary events** (risk
register R15 is zero-tolerance).

## Invariants enforced

- **Required scenarios.** `REQUIRED_SCENARIOS` — no responder available,
  acknowledgement timeout, coverage gap, out-of-area report, provider/channel down.
- **Fail-closed readiness.** `drills_ready` requires at least `MIN_DRILLS` valid
  (signed) drills, every required scenario covered, all within the recency window,
  every drill passed, and **zero total boundary events**; otherwise it returns the
  blocking reasons.

## Tests — `backend/phaseR11_tests/test_response_drills.py` (7, all passing)

Full clean set ready; missing scenario blocks; any boundary event blocks; failed
drill blocks; stale drill blocks; unsigned drill not counted; too few drills.

## Human intervention / external gates (owner-bound)

- **Run the drills.** A named operations/clinical owner must actually run the
  failed-escalation drills and sign the records with zero boundary events before
  any activation (R15). No drill was run here — this is the enforcement, not the
  evidence.
- **Clinical release stays HOLD; Response stays DISABLED.**
