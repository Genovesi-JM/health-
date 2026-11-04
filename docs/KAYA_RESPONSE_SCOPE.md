# KAYA Response — scope & exclusion boundary (Phase R1)

Defines what Response IS and, more importantly, what it is NOT
(`backend/app/response_scope.py`, domain-pure, composing the Phase 21 emergency
guards). Response is never a substitute for emergency services.

## Invariants enforced

- **Permanent exclusions.** `EXCLUDED_CAPABILITIES` — ambulance/emergency/police
  dispatch, hospital admission/contact, guaranteed response time, overriding
  emergency services, triage override — can **never** be enabled by any scope,
  flag, or approval. `scope_is_valid` rejects a scope that tries to approve one.
- **Fail-closed capability allowlist.** `capability_permitted` grants a capability
  only when Response is active, the capability is explicitly in the scope's
  allowlist, the jurisdiction is approved, and it is not permanently excluded.
- **Unknown jurisdiction → information only.** `exposure_for_jurisdiction` returns
  `information_only` for any unsupported/None jurisdiction.
- **Always-present boundary notice.** `boundary_notice` states Response does not
  substitute emergency services, dispatch ambulances, contact hospitals, or
  guarantee response times.
- **No external-action copy.** `content_within_boundary` delegates to the Phase 21
  emergency guard (no dispatch/hospital/ETA/wait claims).

## Tests — `backend/phaseR1_tests/test_response_scope.py` (10, all passing)

Scope validity; scope cannot approve excluded capabilities; unsigned scope
rejected; excluded capability never permitted; capability requires active
Response + approved jurisdiction + allowlist membership; unknown jurisdiction
information-only; boundary notice present/non-emergency; no-external-action copy.

## Human intervention / external gates (owner-bound)

- **Signed Response scope.** A named human must define and sign the approved
  jurisdictions and the (necessarily minimal) capability allowlist; nothing is
  approved by default.
- **Copy localization.** The boundary/emergency copy guard is English-only; a named
  clinical/language owner must localize it (Angolan Portuguese) and review the
  boundary notice (ties to R15/R28).
- **Clinical release stays HOLD; Response stays DISABLED.**
