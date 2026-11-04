# KAYA Response — activation two-person ceremony & governance (Phase R13)

The single choke point that can arm Response (`backend/app/response_ceremony.py`,
domain-pure). A ceremony proceeds only when every R-track readiness gate is green
AND two distinct, non-agent humans in different governance roles jointly approve.
It composes the Phase R0 activation gate, so success still yields only a bounded,
killable activation.

## Invariants enforced

- **All gates green.** `gates_all_green` requires every R-track readiness flag
  (R1–R12) to be signed-off True; defaults are the not-ready value.
- **Two-person, different roles.** `ceremony_ok` requires two valid approvers who
  are distinct people in different governance roles (separation of duties); the
  agent can never be an approver.
- **R0 preconditions composed.** The ceremony also enforces the Phase R0 activation
  preconditions (approved scope + jurisdiction + bounded window).
- **Fail-closed arming.** `run_ceremony` raises unless everything holds and then
  returns a bounded, killable Phase R0 `ActivationState`.

## Tests — `backend/phaseR13_tests/test_response_ceremony.py` (7, all passing)

Gates-all-green helper; valid ceremony arms a bounded killable state; missing gate
blocks; agent cannot be approver; approvers must be distinct and different roles;
R0 preconditions composed; run raises when not ready.

## Human intervention / external gates (owner-bound)

- **The ceremony itself is a human governance event.** Two named humans in
  different roles must jointly run it, and only after every R-track gate is
  genuinely signed off with evidence. The agent prepares the enforcement; it never
  runs the ceremony or supplies an approver.
- **Clinical release stays HOLD; Response stays DISABLED.**
