# KAYA — Verification Provider Setup

Configuration references for the verification providers. Credentials alone
do not prove live operation or an end-to-end clinical workflow. Each selected
provider needs its implemented adapter, consent, contract, webhook correlation,
sandbox tests and release approval. Unavailable adapters remain unavailable
even when credentials are supplied.

For local development only, use untracked `backend/.env`; hosted credentials
belong in the project's secret vault, never source control, browser builds or
chat. `KAYA_VERIFICATION_MODE=live` selects configured implemented vendors;
it is not validation evidence. `sandbox` selects mock identity and qualification
providers, not real vendor sandboxes or clinical verification.

`{BACKEND}` below = your public backend base URL, e.g. `https://api.kaya.ao`.

---

## Sumsub — identity + liveness (professional Step 3)

1. Create an account at <https://sumsub.com> and open the dashboard
   (<https://cockpit.sumsub.com>).
2. Build a verification **level** (document + selfie/liveness). Note its name
   (default expected: `basic-kyc-level`).
3. **Dev space → App Tokens** → generate an App Token + Secret Key.
4. **Dev space → Webhooks** → add a webhook pointing to
   `POST {BACKEND}/api/v1/webhooks/sumsub`; copy the signing secret.
5. Set:
   ```
   IDENTITY_PROVIDER=sumsub
   SUMSUB_APP_TOKEN=...
   SUMSUB_SECRET_KEY=...
   SUMSUB_WEBHOOK_SECRET=...
   SUMSUB_LEVEL_NAME=basic-kyc-level
   ```
6. Verify: `POST /api/v1/verification/identity/start` returns `mode: "live"`
   and a provider reference / SDK token.

---

## Azure AI Document Intelligence — field extraction (professional Step 6)

1. In the Azure portal, create a **Document Intelligence** (formerly Form
   Recognizer) resource.
2. **Keys and Endpoint** → copy the endpoint URL and one key.
3. (Optional) Train/compose a custom model for KAYA credential layouts and
   note its model id; otherwise use a prebuilt model id.
4. Set:
   ```
   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<resource>.cognitiveservices.azure.com/
   AZURE_DOCUMENT_INTELLIGENCE_KEY=...
   AZURE_DOCUMENT_MODEL_ID=kaya-credential-v1
   AZURE_DOCUMENT_API_VERSION=2024-11-30
   ```
5. Verify: `POST /api/v1/verification/documents/extract` (multipart file)
   returns `status: "processing"` with an `operation_url` instead of
   `not_configured`.

> Azure extracts fields only. The user always confirms/corrects the
> extracted values, and extraction never counts as authenticity proof.

---

## Veremark — education / employment / qualification (professional Step 7)

1. Create an account at <https://veremark.com> and open
   <https://app.veremark.com>.
2. **Settings → API** → generate an API key.
3. Configure a webhook to `POST {BACKEND}/api/v1/webhooks/veremark`; copy the
   signing secret.
4. Set:
   ```
   QUALIFICATION_PROVIDER=veremark
   VEREMARK_API_KEY=...
   VEREMARK_WEBHOOK_SECRET=...
   ```
5. Verify: `POST /api/v1/verification/qualifications/start` returns
   `mode: "live"` and `status: "submitted"`.

---

## Certn — Veremark alternative (same Step 7 interface)

1. Create an account at <https://certn.co> and open <https://app.certn.co>.
2. **Settings → API keys** → generate a key.
3. Webhook → `POST {BACKEND}/api/v1/webhooks/certn`; copy the secret.
4. Set:
   ```
   QUALIFICATION_PROVIDER=certn
   CERTN_API_KEY=...
   CERTN_WEBHOOK_SECRET=...
   ```
5. Switching between Veremark and Certn is a single env-var change —
   `QUALIFICATION_PROVIDER` — no code change.

---

## Microsoft Entra Verified ID — optional digital credential (professional Step 8)

Only relevant when an institution issues an Entra-compatible verifiable
credential. Most PDF diplomas do not, so this step is always optional.

1. In the **Microsoft Entra admin center**, set up **Verified ID** and
   create a verification authority.
2. Create an **App registration**; grant it the
   `VerifiableCredential.Create.All` application permission and admin consent.
3. Create a **client secret** for the app.
4. Set:
   ```
   ENTRA_TENANT_ID=...
   ENTRA_CLIENT_ID=...
   ENTRA_CLIENT_SECRET=...
   ```
5. Do not provision these credentials as an activation step yet. The current
   adapter always reports `mode: "unavailable"`, `status: "not_configured"`,
   and accepts no callbacks. Document upload/manual review remain separate
   and are not automatically approved.

> Live HTTP exchange, authority/issuer trust, callback correlation and
> expiry/revocation checks must be implemented and validated first. A tenant
> and a secret alone do not complete this integration.

---

## Regulatory registries (always manual)

No API keys. KAYA never simulates an official regulator API. The registry
step records the correct authority (from `manual_registry.py`) and drops into
the compliance dashboard as `manual_review`, where a reviewer confirms the
licence via the authority's public registry, partnership, or direct contact.
Configured authorities: Angola, Spain, Portugal (see
`ONBOARDING_AND_VERIFICATION.md` §6). Add more by editing the
`REGULATORY_AUTHORITIES` table.

---

## Email (password reset, notifications)

Office 365 SMTP is wired; without credentials it writes to `email_log.txt`.
```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=no-reply@kaya.ao
SMTP_PASSWORD=...
SMTP_FROM=no-reply@kaya.ao
SMTP_USE_TLS=true
```

---

## MFA (TOTP)

No provider needed — TOTP is computed in-process and works with any
authenticator app. Mandatory for doctor, nurse, pharmacist, corporate_admin,
compliance_reviewer, and admin. No configuration required.

---

## Quick verification checklist after configuring

| Provider | Command | Live signal |
|----------|---------|-------------|
| Sumsub | `POST /api/v1/verification/identity/start` | `mode: "live"` |
| Azure DI | `POST /api/v1/verification/documents/extract` | `status: "processing"` |
| Veremark/Certn | `POST /api/v1/verification/qualifications/start` | `mode: "live"` |
| Entra | `get_digital_credential_provider().mode` | `live` |

Any provider still returning `mode: "mock"` / `not_configured` simply has
its credentials unset — safe, and the rest of the app keeps working.
