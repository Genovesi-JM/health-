# Kaya invitation onboarding & deep-link safety (Phase 16)

Evidence date 14 September 2026. Onboarding is resumable, but **onboarding state
never grants authority**. Enforced by
[`backend/app/onboarding_tokens.py`](../backend/app/onboarding_tokens.py); tested in
[`backend/phase16_tests`](../backend/phase16_tests).

## Separate states

`application → invitation → identity_verification → profile_completion →
credentialing → membership → privilege → consent → activation`. The
authority-granting states (credentialing, membership, privilege, activation)
require an authorized, gated human process — never a wizard step. Advancing
cannot skip steps into an authority state.

## Invitation tokens

Hashed (SHA-256, constant-time compare), single-use, expiring, and bound to an
**exact recipient and purpose**, with server-side revocation and replay
detection. Every failure — tampering, replay, wrong recipient, wrong purpose,
revocation, expiry, or unknown — returns **one generic reason** ("invitation
invalid or expired"), so nothing reveals account state or creates an oracle.
Acceptance is audited and rate-limited.

## Wizard cannot grant capability

`wizard_completion_grants` denies any UI step from setting a privileged role, a
verified credential, an active membership, or a clinical privilege. A
professional account stays restricted until identity, MFA, credential,
organization, and privilege gates all complete
(`professional_restricted_until_gates`).

## Deep-link safety

A deep link must bind to a typed destination, must not carry the token in a
referrer-exposed URL, and may only redirect within an allowlist
(`is_deep_link_safe`). Tokens and sensitive draft content are kept out of logs,
analytics, URLs, and notifications (see [redaction](../backend/app/redaction.py)).

## Canonical state, web + mobile

The same canonical onboarding state is the single source rendered by web and
mobile; drafts are minimally scoped and expiring. Recovery paths (expired invite,
interrupted onboarding, email change, duplicate application, rejected/needs-info)
are accessible and low-bandwidth.
