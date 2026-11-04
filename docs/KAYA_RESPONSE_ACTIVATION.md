# KAYA Response — activation gate & kill-switch (Phase R0)

The KAYA Response track is the emergency-adjacent subsystem. Per risk-register
R15 it is **excluded/deferred** and stays **synthetic and disabled**. This phase
builds the enforced activation gate; it ships no emergency dispatch, hospital
contact, or auto-escalation — only the boundary that keeps Response off.

## Invariants enforced (`backend/app/response_activation.py`, domain-pure)

- **Disabled by default.** `DISABLED` is the default state; `is_active` is
  fail-closed — anything ambiguous is inactive.
- **Asymmetric arming.** `can_activate` requires **two distinct named humans**
  (neither the agent), an **approved signed scope**, an **approved jurisdiction**,
  and a **bounded window** (≤ 12h dead-man window). `activate` raises on any
  violation.
- **Easy, single-actor kill-switch.** `kill` lets one named actor deactivate
  immediately — off is the safe direction.
- **No auto-activation.** `auto_activation_possible()` is always `False`; no flag,
  config value, or code path can arm Response on its own.
- **Windowed.** `is_active` is true only while armed, un-killed, and within the
  activation window; it expires automatically.

## Tests — `backend/phaseR0_tests/test_response_activation.py` (10, all passing)

Disabled by default; valid two-person activation; agent-cannot-approve; approvers
must be distinct; scope + jurisdiction required; window bounded; activate raises
on invalid; activation expires (and not-before-start); single-actor kill-switch
(empty actor rejected); no auto-activation.

## Human intervention / external gates (owner-bound)

- **Two-person activation ceremony** is a governance event owned by named humans
  (see Phase R13); the agent can never be an approver and never activates Response.
- **Approved Response scope & jurisdiction** must exist before any activation
  (ties to R09/R15). Until they do, Response stays disabled.
- **Clinical release stays HOLD; Response stays DISABLED.**
