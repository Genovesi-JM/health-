# KAYA Response — responder identity, on-call roster & authority (Phase R5)

A responder holds Response authority only within a signed on-call shift, while
credential-current and Response-privileged, for an approved jurisdiction. An
active Response window must have continuous coverage; any gap fails closed
(`backend/app/response_roster.py`, domain-pure).

## Invariants enforced

- **Time-bounded authority.** `responder_authorized` requires the shift to be
  active, not revoked, credential-current, Response-privileged, an authorized
  profession, and the matching jurisdiction.
- **No coverage gap.** `coverage_ok` samples the window and requires at least one
  eligible responder at every instant (and a signed roster); any gap → false.
  `coverage_gaps` lists the uncovered instants for owner review.
- **Substitute chain.** `substitute_available` returns the next eligible responder
  that is not the primary.

## Tests — `backend/phaseR5_tests/test_response_roster.py` (6, all passing)

Authority rules (shift/credentials/privilege/revoked/jurisdiction); unsigned
roster has no coverage; full coverage ok; coverage gap fails closed (+ gap
listing); overlapping slots close the gap; substitute is next eligible.

## Human intervention / external gates (owner-bound)

- **Signed roster & rota.** A named operations/clinical owner must author and sign
  the on-call roster with continuous coverage and a substitute chain before any
  activation (ties to R14).
- **Responder credentialing & Response privilege** granted through the privileging
  process (Phase 17).
- **Clinical release stays HOLD; Response stays DISABLED.**
