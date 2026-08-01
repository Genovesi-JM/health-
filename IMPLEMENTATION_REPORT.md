# KAYA — Onboarding & Verification Implementation Report

This report answers the 20-point completion standard (§30) for the multi-role
onboarding + verification build. Work was delivered in four phases, each
committed separately with tests green and the app building.

**Session commits** (`main`):

| Commit | Phase |
|--------|-------|
| `264c199` | Email brand fix (GeoVision → KAYA) |
| `4d75a46` | Phase 1 — resumable onboarding + patient flow + role picker |
| `59376c2` | Phase 2a — provider adapter interfaces + sandbox foundation |
| `8174876` | Phase 2b — 17-status state machine + reviewer actions + audit |
| `614e5cf` | Phase 2c — 17-step professional wizard + provider actions + webhooks |
| `ab5cd6d` | Phase 3a — compliance reviewer dashboard UI |
| `0fcbe15` | Phase 3b — document-expiry monitoring |
| `8ebe1fd` | Phase 3c — MFA (TOTP + recovery codes) |
| `6872d86` | Phase 3d — organisation (clinic/lab/pharmacy) onboarding |
| Phase 4 | Entra VID adapter shell + documentation (this commit) |

---

## 1. Files created

**Backend**
- `app/routers/onboarding.py` — resumable wizard API
- `app/routers/compliance_review.py` — reviewer actions + case list/detail + expiry endpoints
- `app/routers/verification_actions.py` — `/verification/*` provider actions
- `app/routers/verification_webhooks.py` — Sumsub/Veremark/Certn webhook receivers
- `app/routers/mfa.py` — TOTP MFA endpoints
- `app/routers/organisations.py` — organisation onboarding
- `app/services/verification/base.py` — Protocol interfaces + value types + status enum
- `app/services/verification/sandbox.py` — deterministic mock providers
- `app/services/verification/sumsub.py` — identity + liveness
- `app/services/verification/veremark.py` — qualification
- `app/services/verification/certn.py` — qualification (alternative)
- `app/services/verification/manual_registry.py` — AO/ES/PT regulator config
- `app/services/verification/entra.py` — Entra Verified ID (optional VC)
- `app/services/verification/state_machine.py` — transition graph + audit
- `app/services/verification/__init__.py` — config-driven selectors
- `app/services/document_expiry.py` — expiry scanner
- `app/services/mfa.py` — RFC 6238 TOTP + recovery codes
- Tests: `test_onboarding.py`, `test_verification_providers.py`,
  `test_state_machine.py`, `test_verification_actions.py`,
  `test_compliance_dashboard.py`, `test_document_expiry.py`, `test_mfa.py`,
  `test_organisations.py`

**Frontend**
- `pages/ChooseAccountTypePage.tsx` — "How will you use Kaya?" entry
- `pages/PatientOnboardingPage.tsx` — 8-step patient flow
- `pages/ProfessionalOnboardingPage.tsx` — 17-step professional flow
- `pages/OrganisationOnboardingPage.tsx` — 5-step organisation flow
- `pages/AdminCompliancePage.tsx` — compliance queue
- `pages/SecurityMfaPage.tsx` — MFA setup/manage
- `components/OnboardingShell.tsx` — reusable stepper (autosave/resume)
- `components/DocumentUpload.tsx` — file/camera upload widget
- `components/ExtractedDataConfirmation.tsx` — extracted-vs-corrected UI
- `components/CaseDetailDrawer.tsx` — reviewer drill-down + actions

**Docs**
- `docs/ONBOARDING_AND_VERIFICATION.md` — architecture (§27)
- `docs/PROVIDER_SETUP.md` — per-provider setup guides
- `IMPLEMENTATION_REPORT.md` — this report

## 2. Files modified
`app/main.py` (routers wired), `app/config.py` (provider env vars),
`app/health_models.py` (11 new models), `app/health_schemas.py` (roles),
`app/rbac.py` (compliance-reviewer gate), `app/routers/auth.py` (MFA login
gate + posture flags), `app/routers/credentials.py` (transition audit on
decision), `app/schemas.py` (MFA flags), `app/mail.py` (brand);
frontend `App.tsx`, `ProtectedRoute.tsx`, `Sidebar.tsx`, `Navbar.tsx`,
`LoginPage.tsx`, `i18n/translations.ts`; `backend/.env.example`.

## 3. Database migrations
New tables auto-created via `Base.metadata.create_all()` (SQLite dev) — no
Alembic migration required for new tables; the existing drift-migration
pattern in `database.py` handles added columns. New tables:
`onboarding_drafts`, `verification_transitions`,
`verification_webhook_events`, `document_expiry_reminders`,
`mfa_credentials`, `mfa_recovery_codes`, `organisation_profiles`,
`organisation_locations`, `organisation_documents`. **For production
Postgres, add the equivalent Alembic revision** (see Limitations).

## 4. External APIs integrated (adapters written, real HTTP wired)
- **Sumsub** — identity + liveness (HMAC-signed requests, webhook verify)
- **Azure AI Document Intelligence** — document field extraction
- **Veremark** — education/employment/qualification checks
- **Certn** — qualification alternative
- All fall back to sandbox when unconfigured.

## 5. External APIs prepared but awaiting credentials
- Sumsub, Veremark, Certn, Azure DI — code complete; need vendor keys.
- **Microsoft Entra Verified ID** — request/verify lifecycle shell; live
  HTTP calls stubbed pending an Entra tenant.

## 6. Features using sandbox / mock mode
- All identity/qualification checks run against deterministic in-process
  sandbox providers until vendor keys are set (`mode=mock`, cannot final-
  approve).
- Regulatory registry is **always** manual review (by design).
- Email falls back to `email_log.txt` without SMTP creds.

## 7. Environment variables required
See `backend/.env.example`. Verification-specific:
`KAYA_VERIFICATION_MODE`, `IDENTITY_PROVIDER`, `QUALIFICATION_PROVIDER`,
`SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_WEBHOOK_SECRET`,
`SUMSUB_LEVEL_NAME`, `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`,
`AZURE_DOCUMENT_INTELLIGENCE_KEY`, `AZURE_DOCUMENT_MODEL_ID`,
`VEREMARK_API_KEY`, `VEREMARK_WEBHOOK_SECRET`, `CERTN_API_KEY`,
`CERTN_WEBHOOK_SECRET`, `AZURE_ENTRA_TENANT_ID`, `AZURE_ENTRA_CLIENT_ID`,
`AZURE_ENTRA_CLIENT_SECRET`.

## 8. Tests added
144 new backend test functions across 9 files:
onboarding (12), verification providers (32), state machine (18),
verification actions + webhooks (11), compliance dashboard (12),
document expiry (12), MFA (19), organisations (14), caregiver (14).

## 9. Tests passed / failed
**All passing.** Full backend suite green at the end of each phase (see
per-commit messages: 104 → 122 → 133 → 145 → 157 → 176 → 190 → 195 → 209).
No known failing tests. Frontend `tsc -b` clean; production build succeeds.

## 10. Remaining limitations
- Live vendor calls need real credentials (sandbox until then).
- Entra VID live HTTP calls stubbed (shell complete).
- SMS OTP not wired (no SMS provider); email + TOTP cover the pilot.
- Production Postgres needs Alembic revisions for the new tables.
- Expiry scanner runs on demand / external cron (no in-app scheduler).

  (The caregiver dedicated wizard, previously listed here, is now fully
  implemented — see Phase 5 / §6.)

## 11. How to run the application
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in what you need; blanks → sandbox
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173

# Tests
cd backend && KAYA_DISABLE_RATE_LIMIT=1 python -m pytest tests/ -q
```

## 12–16. Provider configuration
See `docs/PROVIDER_SETUP.md` for exact step-by-step instructions to
configure **Sumsub**, **Azure Document Intelligence**, **Veremark**,
**Certn**, and **Microsoft Entra Verified ID**, including where to obtain
keys, which env vars to set, and the webhook callback URLs to register.

## 17. Completed flows (browser-verified)
- Patient: role picker → 8-step flow → advance → back preserves data →
  full reload resumes at correct step.
- Professional: role picker → login → 17-step wizard → Step 3 Sumsub
  sandbox call returns a real provider reference with a SANDBOX badge.
- Organisation: "clínica" → login → 5-step wizard → profile persisted
  (confirmed via `GET /organisations/me`), clinic-specific document set.
- MFA: `/security/mfa` shows status + mandatory notice + working setup
  (real generated secret); full enrol→login-challenge→token flow proven
  via curl end to end.
- Compliance dashboard route auth-gated; endpoints covered by 12 tests.

## 18. Confirmation — pending professionals cannot provide services
`require_verified_clinician` / `require_verified_doctor` gate every clinical
surface on `ClinicianCredential.status`. A pending / expired / suspended /
revoked credential returns 403 from doctor/nurse dashboards, prescribing,
and patient access. Tests: `test_clinician_credentials.py` (pre-existing) +
`test_document_expiry.py::test_scanner_expires_verified_credential_on_due_date`.
Sandbox (`mode=mock`) evidence can never final-approve — only a human
compliance reviewer grants `verified`.

## 19. Confirmation — forgot-password / reset works
`/auth/forgot-password` (anti-enumeration 202), `/auth/reset-password`
(single-use, expiring token), `/auth/change-password` — pre-existing and
covered. MFA adds `/auth/mfa/challenge` for the second factor at login.

## 20. Confirmation — registration is multi-step, role-specific, resumable
`ChooseAccountTypePage` asks "How will you use Kaya?" and routes to distinct
flows (patient 8 / professional 17 / organisation 5). `OnboardingDraft` +
`OnboardingShell` provide autosave, back-navigation without data loss, and
resume-after-reload — verified in the browser and by
`test_onboarding.py::test_resume_after_reconnect_returns_prior_data`.
