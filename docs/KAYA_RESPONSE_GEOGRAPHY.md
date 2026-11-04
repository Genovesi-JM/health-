# KAYA Response — geographic coverage limits (Phase R7)

Response operates only inside explicitly approved coverage areas
(`backend/app/response_geography.py`, domain-pure). Outside a covered area — or
when the location is unknown or merely inferred — the reporter gets information
only plus the boundary notice.

## Invariants enforced

- **Location never inferred.** `location_is_trusted` accepts only an explicitly
  `user_confirmed` location; IP-inferred/coarse/unknown are not trusted for a
  coverage decision.
- **Signed coverage map.** `area_covered` requires a signed map and explicit area
  membership; an unsigned map covers nothing.
- **Fail-closed exposure.** `exposure_for_location` returns `capabilities` only for
  a trusted, covered location; everything else is `information_only`.
- **Out-of-area notice.** `out_of_area_message` returns the boundary notice when
  Response cannot cover the location (None when covered).

## Tests — `backend/phaseR7_tests/test_response_geography.py` (5, all passing)

Covered+confirmed → capabilities; out-of-area → information-only + notice;
inferred/coarse not trusted; unknown location information-only; unsigned map
covers nothing.

## Human intervention / external gates (owner-bound)

- **Signed coverage map.** A named operations owner must define and sign the
  approved coverage areas (necessarily small) before any activation.
- **Location confirmation UX.** The reporter's location must be explicitly
  confirmed, never inferred from IP; the confirmation flow is an owner/product task.
- **Clinical release stays HOLD; Response stays DISABLED.**
