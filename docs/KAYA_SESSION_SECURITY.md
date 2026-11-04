# Kaya session & browser security (Phase 13)

Evidence date 14 September 2026. Authentication must resist takeover and prove
recent, role-appropriate authentication for high-impact actions.

## Controls already in the runtime (verified by contract tests)

- **MFA mandatory** for doctor, nurse, pharmacist, corporate_admin,
  compliance_reviewer, admin (`services/mfa.MFA_MANDATORY_ROLES`). Public
  registration of these is refused before account creation (Phase 12).
- **Partial/challenge tokens fail closed**: `assert_mfa_session` rejects a token
  carrying `mfa_challenge` — a challenge token can never reach protected work.
- **OAuth cannot bypass MFA**: `_build_auth_response` runs `assert_mfa_session`
  for password *and* OAuth logins.
- **Recovery codes** are hashed (`hash_recovery_code`), single-use (`used_at`),
  and regeneration replaces the set.
- **Refresh-token families**: rotation on refresh, and **reuse of a rotated token
  revokes the whole family** (`family_id` update to `revoked=True`).
- Refresh currently does **not** carry MFA assurance forward — it conservatively
  requires a fresh MFA login for assurance-bearing access (safe default until
  assurance-aware families land).

## Step-up freshness (canonical policy — `backend/app/authsecurity.py`)

High-impact actions require a fresh MFA step-up within a bounded age:

| Action | Max MFA age |
| --- | --- |
| credential_decision, prescription, data_export, payment, privilege_change, recovery_code_regenerate | 5 min |
| break_glass | 2 min |

`is_auth_fresh` fails closed: a step-up action with no or expired MFA is denied.

## Refresh-family reuse detection (`detect_family_reuse`)

A presented refresh token that is already revoked, or is not the family's current
active token, is reuse → the whole family is revoked and a security event is
raised. Session revocation must also propagate on account disablement, credential
suspension, organization removal, or a high-risk security change.

## Browser storage — KNOWN RISK (R18) and target design

The current web client stores a bearer/user object in `localStorage`
(script-accessible). For a clinical app this is **not an acceptable long-lived
design**: any XSS can exfiltrate the token.

**Target (launch-blocking):** move to **HttpOnly, Secure, SameSite** session
cookies with a thin BFF (backend-for-frontend), CSRF tokens for state-changing
requests, a strict redirect allowlist, and short access-token lifetimes with the
refresh family held server-side. Until then, script-accessible storage must not
hold a long-lived bearer credential. This is tracked as **R18** and is a Phase-13
external/engineering gate; browser CSRF and no-long-lived-bearer tests are
required before any web exposure.

## Auth error hygiene

Authentication errors must reveal no account existence, MFA state, provider, or
credential secret — generic messages only. The redaction control
([`redaction.py`](../backend/app/redaction.py)) additionally strips secrets/tokens
from any logged auth error.

## Human / external gate

The browser-storage migration (cookies/BFF), OAuth PKCE/nonce/state hardening,
and the assurance-aware refresh family are engineering gates that must be
completed and tested before web exposure; they remain OPEN under the hold.
