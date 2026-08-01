# KAYA — Onboarding & Verification Architecture

This document covers the multi-role onboarding system, the credential
verification pipeline, the provider-adapter layer, the verification state
machine, and the operational surfaces (compliance dashboard, expiry
monitoring, MFA). It is the reference for §27 of the onboarding spec.

> **Golden rule:** KAYA owns every registration interface, profile, workflow,
> status, audit record, and review tool. External APIs are used only to
> *adapt* specialist technology (identity, extraction, qualification,
> digital credentials). No external API is ever presented as doing more
> than it does — e.g. Azure extracts document *fields*; it does not prove a
> certificate is authentic, and the regulatory registry step is always
> confirmed by a human reviewer.

---

## 1. Roles

`RoleEnum` (`backend/app/health_schemas.py`) — the pilot ships 10 of the
spec's 12 roles:

| Role | MFA mandatory | Notes |
|------|:---:|-------|
| `patient` | no | 8-step onboarding |
| `caregiver` | no | manages dependants (draft steps defined) |
| `doctor` | **yes** | 17-step professional flow + credential dossier |
| `nurse` | **yes** | professional flow (12 steps) |
| `pharmacist` | **yes** | professional flow (12 steps) |
| `corporate_admin` | **yes** | employer dashboards |
| `corporate_analyst` | no | read-only corporate |
| `compliance_reviewer` | **yes** | reviews credential + org cases; **cannot** be a plain support agent |
| `admin` | **yes** | full platform admin |
| `support` | no | help only — **may not approve professionals** |

Organisations (clinic / laboratory / pharmacy / health institution) are
modelled separately (`OrganisationProfile`) and owned by a normal user
account acting as the representative.

---

## 2. Onboarding flows

### Resumable draft engine
`OnboardingDraft` (one row per user+role) stores `current_step`,
`completed_steps`, and a step-keyed `data` JSON. The `/api/v1/onboarding/*`
router (`start`, `status`, `steps/{n}`, `save`, `submit`, `review`) drives
the wizard; the frontend `OnboardingShell` component autosaves (900 ms
debounce), supports back-navigation without data loss, and resumes at the
correct step after a full reload or reconnect.

| Flow | Steps | Page |
|------|:---:|------|
| Patient | 8 | `PatientOnboardingPage` |
| Professional (doctor/nurse/pharmacist) | 17 | `ProfessionalOnboardingPage` |
| Organisation (clinic/lab/pharmacy/health org) | 5 | `OrganisationOnboardingPage` |

Entry point: `ChooseAccountTypePage` ("How will you use Kaya?") routes each
choice to the matching flow. All wizards are Portuguese-first with en/fr/es
(and zh where present).

### Conditional logic (§15)
Steps and fields adapt to prior answers: a pharmacy org sees the
pharmacy-licence upload; a lab sees lab accreditation; identity/qualification
steps require the provider call to have started before advancing; consent
toggles are individual (mandatory vs optional never bundled).

---

## 3. Verification data model

`backend/app/health_models.py`:

- `ClinicianCredential` — the private dossier gating all clinical access.
- `CredentialEvidence` — uploaded professional documents.
- `CredentialProviderCheck` — per-provider check records.
- `VerificationTransition` — **immutable audit row** for every status change
  (polymorphic: `entity_type` + `entity_id`), capturing previous/new status,
  actor + actor_kind (user/system/webhook/provider), reason_code, applicant-
  visible `reason_text`, internal-only `reviewer_notes`, provider, timestamp.
- `VerificationWebhookEvent` — `(provider, event_id)` unique index for
  idempotent webhook processing.
- `DocumentExpiryReminder` — `(entity, kind, threshold_days)` unique index
  so the expiry scanner never double-notifies.
- `MfaCredential` / `MfaRecoveryCode` — TOTP secret + hashed recovery codes.
- `OrganisationProfile` / `OrganisationLocation` / `OrganisationDocument` —
  organisation onboarding with multi-location and document store.

Secrets (API keys) are **never** stored in DB rows or the client — only in
environment variables read by `app/config.py`.

**Migrations:** dev/SQLite uses `create_all()` + drift-migrations; production
Postgres applies `alembic/versions/onboarding_verification_v1.py`, which
creates all 11 new tables idempotently and is reversible.

---

## 4. Verification state machine

`backend/app/services/verification/state_machine.py` defines the allowed
transition graph over the 17-status vocabulary (`VerificationStatus` in
`base.py`) plus post-approval lifecycle states:

```
not_started → consent_required → submitted → processing ⇄ action_required
                                     │             │
                                     ├→ manual_review → {completed, partially_verified,
                                     │                    unable_to_verify, action_required, failed}
                                     └→ {completed, partially_verified, unable_to_verify, failed}
completed(verified) → {suspended, expired, revoked}
suspended → {completed(reactivate), revoked}
expired   → {action_required(renew), completed(reactivate)}
revoked   → (terminal)
```

- `record_transition(...)` validates the edge, writes the audit row, and
  `flush()`es (never commits) so callers can bundle the status update + audit
  atomically. Illegal edges raise `InvalidTransitionError` → HTTP 409 with
  the allowed-next set.
- Legacy statuses (`draft`, `pending_review`, `verified`, `needs_info`,
  `rejected`, `suspended`) are aliased into the graph so the pre-existing
  credential workflow interoperates without a schema migration.

### Decision rule (§25)
A professional is **never** fully verified just because a document uploaded,
Azure extracted text, a selfie matched, or a licence number was typed. Final
activation requires the configured combination (identity + contacts +
required documents + registry confirmation + qualification checks +
insurance where required + accepted agreements + payout where needed +
**final human compliance approval**). `require_verified_clinician` gates
dashboard/prescribing/patient access on the credential status, so an
`expired`, `suspended`, or `revoked` credential automatically loses access.

---

## 5. Provider-adapter layer

`backend/app/services/verification/` — every vendor sits behind a `Protocol`
interface, so callers never learn a vendor's name and vendors are swappable
by env var.

| Interface | Live adapter | Fallback | Env selector |
|-----------|--------------|----------|--------------|
| `IdentityVerificationProvider` | `SumsubIdentityProvider` | Sandbox | `IDENTITY_PROVIDER` |
| `QualificationVerificationProvider` | `Veremark` / `Certn` | Sandbox | `QUALIFICATION_PROVIDER` |
| `RegulatoryRegistryProvider` | `ManualRegistryProvider` | Sandbox | (always manual) |
| `DocumentIntelligenceProvider` | Azure DI (in `/verification/documents/extract`) | NOT_CONFIGURED | — |
| `DigitalCredentialProvider` | `EntraVerifiedIdProvider` | NOT_CONFIGURED | — |

Selectors: `get_identity_provider()`, `get_qualification_provider()`,
`get_registry_provider()`, `get_digital_credential_provider()`.

- `KAYA_VERIFICATION_MODE=sandbox` forces the in-process deterministic
  providers globally (staging demos).
- Every adapter transparently falls back to Sandbox / NOT_CONFIGURED when
  its credentials are unset — the app runs end-to-end with zero contracts.
- **Sandbox results always carry `mode=mock`** so the compliance layer can
  refuse to final-approve on mock-only evidence.
- The **registry step is always `manual_review`**, even in sandbox — KAYA
  never simulates an official regulator API that does not exist.

### Action + webhook endpoints
- `POST /api/v1/verification/identity/start`, `GET .../identity/status`
- `POST /api/v1/verification/qualifications/start`, `GET .../qualifications/status`
- `POST /api/v1/verification/documents/extract`
- `POST /api/v1/verification/registry/check`
- Webhooks: `POST /api/v1/webhooks/{sumsub,veremark,certn}` — verify the
  vendor signature (tampered → 401, no leaked reason), dedupe on
  `(provider, event_id)`, parse to a `VerificationResult`, and record a
  transition. Idempotent and replay-safe.

---

## 6. Regulatory registry configuration

`manual_registry.py` holds `REGULATORY_AUTHORITIES` keyed by
`(country_iso2, profession)`. Shipped: **Angola** (Ordem dos Médicos /
Enfermeiros / Farmacêuticos de Angola), **Spain** (CGCOM, Consejo General de
Enfermería, Consejo General de Colegios Farmacéuticos), **Portugal** (Ordem
dos Médicos / Enfermeiros). Each entry carries the authority name, home URL,
public-search URL (where one exists), and language-appropriate reviewer
notes.

### Adding a new regulator
Add a `(country, profession): {...}` entry to `REGULATORY_AUTHORITIES`. No
code change beyond the table. If a country later exposes an official API,
implement a new `RegulatoryRegistryProvider` and route to it in
`get_registry_provider()`.

### Adding a new verification provider
1. Implement the relevant `Protocol` in a new module under
   `services/verification/`.
2. Register it in the `_IDENTITY_REGISTRY` / `_QUALIFICATION_REGISTRY` map in
   `__init__.py`.
3. Add its env vars to `config.py` + `.env.example`.
4. Add a webhook receiver in `verification_webhooks.py` if it calls back.

---

## 7. Compliance dashboard

`/admin/compliance` (admin + compliance_reviewer only):
- `GET /api/v1/compliance/cases` — filter by status / country / profession /
  search, paginated.
- `GET /api/v1/compliance/cases/{id}/detail` — evidence, provider checks,
  **entered-vs-extracted diff**, full transition history, allowed-next states.
- Reviewer actions (all audited via the state machine):
  `request-information`, `manual-review-complete`, `suspend`, `reactivate`,
  `revoke`, plus approve/reject on the existing `credentials/admin/{id}/decision`.
- Reviewer notes are separated from applicant-visible reason text.

---

## 8. Document-expiry monitoring (§14)

`services/document_expiry.py` — `scan_credentials()` fires graduated
reminders at **90 / 60 / 30 / 14 / 7 / 0** days, one `Notification` each
(typed info → warning → error), and on the expiry day transitions a
`verified` credential to `expired` (privileges drop automatically, history
preserved). Idempotent per threshold. Triggered by
`POST /api/v1/compliance/expiry/scan` (cron-friendly) or listed via
`GET /api/v1/compliance/expiry/upcoming?days=N`.

---

## 9. Multi-factor authentication (§9)

`services/mfa.py` — RFC 6238 TOTP with the standard library (no dependency),
compatible with Google Authenticator / Authy / Microsoft Authenticator.
Mandatory for clinical + admin roles. Recovery codes are single-use and
stored SHA-256-hashed. Endpoints under `/auth/mfa/*`
(`setup`, `verify`, `disable`, `recovery-codes`, `challenge`, `status`).
When MFA is enabled, `POST /auth/login` returns `{mfa_required, mfa_token}`
instead of tokens; the client completes via `/auth/mfa/challenge`.

---

## 10. Sandbox vs live

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| **mock** | vendor creds unset, or `KAYA_VERIFICATION_MODE=sandbox` | in-process deterministic results, `mode=mock`, cannot final-approve |
| **live** | vendor creds present, `KAYA_VERIFICATION_MODE=live` | real vendor API calls, real webhooks |

Mock verification can never activate a real professional — the compliance
reviewer must approve, and mock-mode evidence is flagged in the case detail.

---

## 11. Security posture

- Passwords hashed (passlib); TOTP secrets base32, recovery codes hashed.
- Webhook signatures verified (HMAC) per vendor; replays deduped.
- Documents: magic-byte + size validation, stored via `health_storage`
  (local dev / DO Spaces prod) with signed URLs; full IBAN never returned
  (last-4 only).
- RBAC + capability gates; support agents cannot approve professionals.
- Rate limiting + anti-enumeration on auth; audit logging throughout.
- No secrets in DB rows, client bundle, or logs.

---

## 12. Known limitations

- Live vendor calls (Sumsub/Veremark/Certn/Azure/Entra) require real
  credentials; until then everything runs in sandbox/NOT_CONFIGURED.
- Entra Verified ID is a working *shell* (request/verify lifecycle wired,
  live HTTP calls stubbed pending a tenant) — intentional, since few
  institutions issue compatible credentials.
- Caregiver flow has draft steps defined but not a full dedicated wizard yet.
- SMS OTP is not wired (no SMS provider contracted); email + TOTP cover the
  pilot.
- The expiry scanner is triggered on demand / by external cron; no in-app
  scheduler process ships.

See `docs/PROVIDER_SETUP.md` for exact per-provider configuration steps and
`IMPLEMENTATION_REPORT.md` for the full delivery summary.
