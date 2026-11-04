# KAYA — Azure deployment runbook

Two Bicep templates, deployed in order:

1. **`main.bicep`** — foundation (VNet + private PostgreSQL 16, ACR, Key Vault,
   managed identity, Storage, Log Analytics, Container Apps *environment*).
   Runtime-free by design.
2. **`app.bicep`** — the runtime **Container App** that runs the real API
   (`gunicorn app.operational:app`), pulls its image from ACR with the managed
   identity, and reads `DATABASE_URL` from Key Vault.

All commands assume `az login` and a target resource group `RG`.

## 1 — Deploy the foundation

```bash
az deployment group create -g "$RG" -f infra/azure/main.bicep \
  -p location=spaincentral postgresAdministratorLogin=kayaowner \
     postgresAdministratorPassword="$PG_PASSWORD"   # supplied securely, never committed
```

Capture the outputs (`registryLoginServer`, `managedEnvironmentId`,
`identityResourceId`, `keyVaultUri`, `postgresHost`, `databaseName`).

## 2 — Store the database URL in Key Vault (no secret in any template)

```bash
# PostgreSQL is private; the app reaches it over the VNet.
DB_URL="postgresql+psycopg2://kayaowner:${PG_PASSWORD}@${POSTGRES_HOST}:5432/${DATABASE_NAME}?sslmode=require"
az keyvault secret set --vault-name "$KV_NAME" --name database-url --value "$DB_URL"
```

The managed identity already holds **Key Vault Secrets User** (granted in the
foundation), so the Container App can read it at runtime.

## 3 — Build and push the image

```bash
TAG=$(git rev-parse --short HEAD)           # immutable tag — never "latest"
az acr login --name "$ACR_NAME"
docker build -t "${ACR_LOGIN_SERVER}/kaya-backend:${TAG}" backend/
docker push "${ACR_LOGIN_SERVER}/kaya-backend:${TAG}"
```

The image's default `CMD` is the Phase-0 hold (`app.main:app`); the Container App
**overrides** it with `app.operational:app`, so the deployed service runs the
real API while the image stays safe by default.

## 4 — Deploy the app

```bash
az deployment group create -g "$RG" -f infra/azure/app.bicep \
  -p managedEnvironmentId="$MANAGED_ENV_ID" \
     identityResourceId="$IDENTITY_ID" \
     registryLoginServer="$ACR_LOGIN_SERVER" \
     keyVaultUri="$KV_URI" \
     imageTag="$TAG" \
     corsOrigins="https://genovesi-jm.github.io" \
     frontendBase="https://genovesi-jm.github.io/health-"
```

The deployment outputs `appUrl` — point the web client's `VITE_API_URL` at it and
rebuild the frontend.

## Runtime configuration (set by `app.bicep`)

| Var | Value | Purpose |
| --- | --- | --- |
| `ENV` | `production` | disables demo seed, enables HTTPS redirect |
| `KAYA_EXECUTION_MODE` | `operational` | intent marker (the operational entry does not gate on it) |
| `SEED_DEMO_DATA` | `false` | no demo users in production |
| `DATABASE_URL` | Key Vault `database-url` | private PostgreSQL, TLS required |
| `CORS_ORIGINS` | web origin(s) | browser access |

## Notes / still owner-bound

- **Migrations:** run Alembic against the PostgreSQL server as a one-off job before
  first traffic (the operational app calls `ensure_legacy_schema()` for additive
  drift, but the migration history should be applied explicitly in production).
- **ACR / Storage / Key Vault public access:** the foundation leaves these network-
  reachable for bootstrap (see `KAYA_INFRA_POSTURE.md`); close them with private
  endpoints before real PHI.
- Deploying to Azure is an outward-facing action; run these commands yourself. The
  templates are compile-verified offline (`infra/azure/tests`, 18 checks).
