# Kaya architecture index (Phase 4)

**Delivery decision updated 4 October 2026:** Angola first, Portugal prepared in parallel. The selected stack is React web/PWA, React Native/Expo standalone mobile apps and FastAPI. The table below remains the 14 September source inventory; current mobile build and device validation are outstanding. See the [current product plan](../PRODUCT_AND_LAUNCH_PLAN.md#launch-market-and-delivery-decision).

Evidence date 14 September 2026. This index makes the repository safe to evolve:
one authoritative source, a precise status for every surface, and explicit edit
boundaries. History is preserved; nothing user-owned was deleted.

## Repository identity and source of truth

- **Canonical repository:** `Genovesi-JM/health-` on GitHub. The verified local
  checkout is `/Users/genovesimaria/Documents/kaya-web`; the checkout path is not
  the repository identity.
- **Product source of truth:** [`PRODUCT_AND_LAUNCH_PLAN.md`](../PRODUCT_AND_LAUNCH_PLAN.md).
  Where code, copy, or docs conflict with the plan and the governance policy, the
  plan plus the machine-checkable policy govern.
- Naming: `health-` (repo) / `kaya-web` (checkout) are the same product. `kaya`
  is the product name. No rename is performed here (external identifiers may
  depend on `health-`); a rename must preserve history and update package,
  migration, CI, and deployment references together.

## Surface status recorded on 14 September 2026

| Surface | Path | Status |
| --- | --- | --- |
| API backend | `backend/app` (FastAPI/SQLAlchemy) | **Supported** — default HTTP entry held (Phase 0/1) |
| Web / PWA | `frontend/src` (React/Vite) | **Supported** — default entry is informational-only (Phase 1) |
| Legacy clinical web app | `frontend/src/LegacyApp.tsx` | **Disabled/preserved** — byte-for-byte, not mounted |
| Synthetic dev runtime | `backend/app/synthetic_runtime.py` | **Dev-only** — isolated audit harness, never a public path |
| Expo mobile | `mobile/` | **Supported (unverified device/store)** — informational-only entry |
| Native iOS prototype | `ios-native/` | **Reference-only** — no build/launch claim |
| Infrastructure | `infra/` Azure Bicep | **Supported (foundation only)** — not a deployed clinical runtime |
| Migrations | `backend/alembic` | **Supported** — single head; startup drift-repair removed under hold |
| Governance & evidence | `backend/app/governance.py`, `backend/app/kaya_governance.json`, `docs/` | **Supported** |
| Phase evidence logs | `docs/evidence/**` | **Generated evidence (intentionally tracked)** |
| Build outputs / caches | `**/node_modules`, `dist`, `coverage`, `__pycache__` | **Generated (ignored)** |

## Hygiene actions taken (Phase 4)

- **Runtime email log quarantined:** `backend/email_log.txt` is no longer
  tracked (`git rm --cached`) and is added to `.gitignore`. The local file is
  preserved, not deleted. It is a runtime artifact, not source.
- **`.gitignore` hardened** to cover the email log and `*.sqlite` in addition to
  the existing `.env`, `*.db`, `*.sqlite3`, `backend/uploads/`, `*.log`,
  `coverage/`, and `__pycache__/` rules.
- **Deploy misconfiguration removed:** `.github/workflows/deploy.yml` no longer
  defaults `VITE_API_URL` to `https://health.geovisionops.com`; it now requires
  the variable to be set (fails closed if unset). The workflow's autodeploy
  remains disabled from Phase 0.
- **Env templates** (`.env.production`, `backend/.env.example`) are retained as
  documented **templates only**; they contain `CHANGE_ME`/empty placeholders, no
  filled secrets (test-guarded). `.env.production` describes an older
  DigitalOcean path and is reference/stale — the supported infrastructure
  direction is Azure (see infra/ and the human gates).

## Retained GeoVision-legacy references

The backend still contains GeoVision-origin strings and legacy routers (e.g.
`ai.py`, `kpi.py`, `contacts.py`, seed data, comments). These are **retained on
purpose** to preserve history and avoid a risky mass rewrite under the hold. They
are not on any reachable Kaya clinical path (default API is held) and no Kaya
setup path depends on them. A scoped removal belongs to the later capability and
migration phases with usage and rollback evidence, not to this hygiene pass. The
only GeoVision reference that could actively **misconfigure** a Kaya build (the
deploy default domain) has been removed above.

## Edit boundaries and generated-file rules

- **Safe to edit:** `backend/app` (excluding held entry semantics), `frontend/src`
  (excluding the held default entry and `LegacyApp.tsx` byte-for-byte
  preservation), `docs/`, tests, migrations (additive), CI config.
- **Do not edit as source:** anything under `docs/evidence/**` (immutable
  evidence), generated/build/cache directories, and quarantined runtime files.
- **Preserve:** the Phase 0/1 held entry points and `LegacyApp.tsx`; do not
  reconnect them as a rollback shortcut.

## Pre-existing untracked tests (not adopted)

Three untracked frontend tests remain preserved but **not adopted**: authorship
is unverified and they include ambiguous/failing selectors (Phase 0 measured 12
passed / 3 failed). They stay out of the tracked suite until an owner reviews and
fixes them:
`frontend/src/components/DocumentUpload.test.tsx`,
`frontend/src/components/OnboardingShell.test.tsx`,
`frontend/src/pages/AdminExpiryPage.test.tsx`.
