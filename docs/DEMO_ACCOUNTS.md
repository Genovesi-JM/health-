# KAYA — demo accounts and URLs (2026-11-07)

## Where the site is published

| What | URL | Notes |
|---|---|---|
| Azure (current build) | https://stkayainfo4319.z43.web.core.windows.net/ | Deployed by hand from the `organise/kaya-nov7` branch |
| GitHub Pages | https://genovesi-jm.github.io/health-/ | Auto-deploys from `main` |
| Pull request | https://github.com/Genovesi-JM/health-/pull/8 | Merging it updates GitHub Pages too |

## Why no public login works

Both published sites are frontend-only. The clinical backend (Azure Container Apps
`ca-kaya-staging-api`, Spain Central) is deliberately **held and internal** under the
clinical HOLD, and the old backend address used by GitHub Pages
(`health.geovisionops.com`) is offline. Until a backend is exposed, the login page on the
public sites cannot authenticate anyone. Exposing it is a business/regulatory decision,
not a code change.

## Demo accounts (local backend)

Password for every account: `SeedDefault@1234`
(unless the environment variable `ADMIN_PASSWORD` is set, in which case that value is used).

| Role | Email |
|---|---|
| Patient | paciente@health.com |
| Patient | joao.paciente@health.com |
| Doctor | medico@health.com |
| Doctor | dra.ana@health.com |
| Admin | genovesi.maria@geovisionops.com |

These are created by `backend/app/seed_data.py` when the backend starts outside production.

## Running the backend locally

From a clone that has **no** `backend/.env` file:

```bash
cd backend && KAYA_EXECUTION_MODE=synthetic ENV=test uvicorn app.main:app --port 8000
```

Then start the frontend with `npm run dev` in `frontend/` (it proxies `/auth`, `/api`,
`/me`, `/admin` to port 8000) and open http://localhost:5173/health-/login.
