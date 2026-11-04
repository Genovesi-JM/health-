# Kaya web/PWA client safety & truthful UX (Phase 37)

The web client must not leak PHI, present stale clinical data as live, perform a
clinical action without server authority, or make unproven clinical claims.
`frontend/src/phase37/clientSafety.ts` holds reusable predicates; a paired
contract test asserts the real Vite/PWA config and source keep the controls. The
clinical runtime is held server-side (503) and the client is gated by
`assertOperationalAccess`; this phase adds client-side defence-in-depth.

## Invariants enforced / confirmed

- **No clinical response cached (PWA).** The contract test asserts `vite.config.ts`
  routes `(api|auth|admin|me)` through **NetworkOnly**, `globIgnores` `**/api/**`
  and `**/auth/**` from precache, and sets a `navigateFallbackDenylist` for
  `/api/` — so the service worker never serves a stale clinical/auth response.
- **No PHI/tokens in URLs.** `urlCarriesSensitiveData` flags query/fragment tokens,
  email, phone, DOB, MRN, etc.; the source-hygiene test asserts `api.ts` sends the
  bearer token via the `Authorization` header and never as a query param.
- **No PHI in client storage.** `storageKeyAllowed` rejects clinical/PHI storage
  keys (patient/clinical/note/diagnosis/prescription/triage/record/phi).
- **No client-finalized clinical action.** `clientMayFinalizeClinicalAction()` is
  always false — the server is authoritative.
- **Offline honesty.** `offlineClinicalDisplayAllowed` requires an explicit
  "not live"/stale marker before any clinical data is shown offline.
- **Truthful copy.** `copyHasForbiddenClaim` flags unproven clinical/marketing
  claims (diagnose/guarantee/cure/emergency-dispatch/pre-alert/reduced-wait/
  100%-safe), extending the Phase 3 copy contract.

## Tests — `frontend/src/phase37/clientSafety.test.ts` (9, all passing)

Clinical-path detection; sensitive-data-in-URL rejection; disallowed storage keys;
no client-finalized clinical action; offline stale-marker requirement; forbidden
claim detection; the real PWA config contract (NetworkOnly + globIgnores +
navigateFallbackDenylist); and `api.ts` token-in-header (not URL). `tsc --noEmit`
is clean.

## Known client risk & human intervention

- **R18 — bearer token in `localStorage`.** The app stores `ht_token` in
  `localStorage`, which is exfiltratable via XSS. This is an accepted, tracked risk
  (see risk register R18); a named security owner must decide the mitigation
  (httpOnly cookie + CSRF, short-lived tokens + rotation, or a strict CSP) before
  real patient use. Not changed in this phase.
- **CSP / security headers.** Setting a strict Content-Security-Policy and the
  standard security headers at the edge is an owner/infra task.
- **Accessibility & comprehension.** The truthful-copy and non-emergency
  comprehension study (risk register R16) remains owner-bound.
- **Clinical release stays HOLD.**
