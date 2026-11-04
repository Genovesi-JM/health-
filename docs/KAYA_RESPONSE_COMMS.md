# KAYA Response — communication boundary (Phase R6)

Every outbound Response communication must carry the non-emergency boundary
notice, make no external-action or timing promise, and leak no PHI/secret to an
unintended channel (`backend/app/response_comms.py`, domain-pure, composing the
Phase 21 emergency guards, Phase R1 scope, and the Phase 30 PHI guard).

## Invariants enforced

- **In-boundary content.** `message_within_boundary` reuses the Phase 21 guard (no
  dispatch/hospital/ETA/wait claims).
- **Reporter notice always present.** `compose_reporter_message` refuses a
  boundary-violating body and always appends the boundary notice;
  `boundary_notice_always_present` verifies it.
- **Responder messages.** `responder_message_ok` requires the message to stay in
  boundary and blocks PHI/secret going to an external channel.

## Tests — `backend/phaseR6_tests/test_response_comms.py` (5, all passing)

Within-boundary detection; reporter message appends notice; compose refuses a
boundary violation; responder message boundary; responder message blocks PHI to an
external channel (internal allowed).

## Human intervention / external gates (owner-bound)

- **Copy localization/review** (Angolan Portuguese) of all Response messages by a
  named clinical/language owner (ties to R15/R28); the English guard is a
  mechanism, not localized copy.
- **Approved external channels** (if any) with DPAs before any responder message
  leaves the platform.
- **Clinical release stays HOLD; Response stays DISABLED.**
