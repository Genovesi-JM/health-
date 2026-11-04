# KAYA Response — readiness board & final gate (Phase R14)

The consolidated register of every Response-track gate (R0–R13), each mapped to an
accountable owner role and a fail-closed status. Backed by
`backend/app/response_readiness.py`. **Response is DISABLED and NOT READY.**

## Overall status — **NOT READY / DISABLED**

- Total gates: **14**  ·  READY: **0**  ·  OPEN: **14**  ·  `response_ready`: **false**.
- `response_may_activate` is **false** — and even when every gate is READY, it is
  necessary, not sufficient: activation still requires the live Phase R13
  two-person ceremony.

The KAYA Response subsystem stays synthetic and disabled (risk register R15). The
agent has prepared enforceable, fail-closed policy and tests; it has not — and
cannot — mark any gate READY, run the activation ceremony, or activate Response.

## The Response register

| Gate | Phase | What a named owner must do | Owner role | Status |
| --- | --- | --- | --- | --- |
| R0-ACTIVATION | R0 | Two-person activation gate & kill-switch signed procedure | release_board | OPEN |
| R1-SCOPE | R1 | Signed Response scope with permanent exclusions | clinical_safety | OPEN |
| R2-INTAKE | R2 | Incident intake red-flag list validated/localized | clinical_safety | OPEN |
| R3-ROUTING | R3 | Escalation routing to authorized humans operational | operations | OPEN |
| R4-FALLBACK | R4 | Failed-escalation fallback with supervisor tier | operations | OPEN |
| R5-ROSTER | R5 | Signed on-call roster with gap-free coverage | operations | OPEN |
| R6-COMMS | R6 | Response communication copy reviewed/localized | clinical_safety | OPEN |
| R7-GEOGRAPHY | R7 | Signed coverage map + location-confirmation UX | operations | OPEN |
| R8-SLA | R8 | Signed internal SLA targets (never promised) | operations | OPEN |
| R9-AUDIT | R9 | Tamper-evident incident audit store + retention | security | OPEN |
| R10-CONSENT | R10 | Signed Response ROPA + specific consent document | data_controller | OPEN |
| R11-DRILLS | R11 | Failed-escalation drills passed with zero boundary events | operations | OPEN |
| R12-METRICS | R12 | Zero-boundary-event evidence + R16 comprehension study | accessibility | OPEN |
| R13-CEREMONY | R13 | Two-person activation ceremony run with all gates green | release_board | OPEN |

## The path to activation (all human, all owner-bound)

1. Each named owner clears their R-track gate with dated evidence and signs it
   READY (the agent can never sign).
2. When all 14 are READY, `response_may_activate` becomes true — necessary, not
   sufficient.
3. Two distinct named humans in different governance roles run the Phase R13
   two-person ceremony; only then does the Phase R0 gate arm Response for a
   bounded, killable window.
4. Any boundary event, coverage gap, or failed drill trips the gate back to
   disabled.

**Clinical release stays HOLD. KAYA Response stays DISABLED.**
