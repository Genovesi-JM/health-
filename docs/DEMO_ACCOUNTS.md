# KAYA — demo accounts and URLs (2026-11-07)

## Where the site is published

| What | URL | Notes |
|---|---|---|
| Azure site (current build, **login works**) | https://stkayainfo4319.z43.web.core.windows.net/ | Deployed by hand from the `organise/kaya-nov7` branch; talks to the demo API below |
| Demo API (synthetic mode, demo data only) | https://ca-kaya-demo-api.livelyplant-1f32338a.spaincentral.azurecontainerapps.io | Azure Container Apps `ca-kaya-demo-api`, rg `rg-kaya-pilot-weu`; SQLite in the container, so data resets when it restarts |
| GitHub Pages | https://genovesi-jm.github.io/health-/ | Auto-deploys from `main`; has no API configured, so login shows an "unreachable" message |
| Pull request | https://github.com/Genovesi-JM/health-/pull/8 | Merging it updates GitHub Pages too |

## Demo accounts

Password for every account: `SeedDefault@1234`

| Role | Email |
|---|---|
| Patient | paciente@health.com |
| Patient | joao.paciente@health.com |
| Doctor | medico@health.com |
| Doctor | dra.ana@health.com |
| Admin | genovesi.maria@geovisionops.com |

These are created by `backend/app/seed_data.py` when the backend starts outside production.
The demo API runs the backend's **synthetic test mode** (`KAYA_EXECUTION_MODE=synthetic`,
`ENV=test`): no real patients, no real clinical service, no external providers. The clinical
staging API (`ca-kaya-staging-api`) stays held and internal.

## Running the backend locally

From a clone that has **no** `backend/.env` file:

```bash
cd backend && KAYA_EXECUTION_MODE=synthetic ENV=test uvicorn app.main:app --port 8000
```

Then start the frontend with `npm run dev` in `frontend/` (it proxies `/auth`, `/api`,
`/me`, `/admin` to port 8000) and open http://localhost:5173/health-/login.

## Redeploying the demo API

```bash
# build (the backend .dockerignore excludes the synthetic runtime, so build from a full copy of backend/app)
az acr build --registry acrkaypilotiloie6xix66qg --image kaya-demo:<tag> --target production --file <ctx>/Dockerfile <ctx>
az containerapp update -n ca-kaya-demo-api -g rg-kaya-pilot-weu --image acrkaypilotiloie6xix66qg.azurecr.io/kaya-demo:<tag>
```

The app runs gunicorn with a single worker (two workers race on SQLite table creation).
