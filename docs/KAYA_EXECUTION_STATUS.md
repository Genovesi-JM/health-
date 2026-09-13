# Kaya execution status

**Phase 0 COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD.** Completed 14 September 2026. The reproducible repository baseline, local safety freeze, evidence ledgers and verification are complete. Existing application failures remain measured remediation work; no clinical or external approval is implied. Phase 1 has not started.

## Repository and preservation

Target `/Users/genovesimaria/Documents/kaya-web`, branch `fix/nurse-queue-and-i18n`, starting HEAD `a860f8bae48095fb97abf493e37e6340111652e3`. Canonical remote is `https://github.com/Genovesi-JM/health-.git`. The local tracking ref was five commits behind this branch at the start; no fetch or push occurred. See [final repository evidence](evidence/phase0-completion-2026-09-14/repository-final.json) and the Phase 0 checkpoint commit named `Complete Kaya Phase 0 baseline and clinical launch hold`.

The existing modified `backend/email_log.txt` and untracked `frontend/src/components/DocumentUpload.test.tsx`, `frontend/src/components/OnboardingShell.test.tsx`, and `frontend/src/pages/AdminExpiryPage.test.tsx` are preserved and excluded from the checkpoint. Their original hashes are in the dated baseline evidence; final hashes are independently compared. The email log and local databases were never copied into tests. The three frontend tests were measured separately without adopting or editing them.

## Local launch freeze

The default `app.main:app` returns 503 with no-store on every HTTP request, including health/readiness, authentication, webhooks and unknown routes; WebSocket access is denied. It imports no clinical settings, routers or database initialization. The original clinical factory is retained in `app.synthetic_runtime`, with an identical AST to the starting version. Its module now checks the isolated test selector before clinical imports and exposes no eager ASGI app.

Synthetic tests require ENV=test, KAYA_EXECUTION_MODE=synthetic and no backend/.env. This selector is a development control, not a security sandbox. Use the disposable audit harness; never expose it to real users or install real provider credentials in it. Default Docker/Python startup no longer migrates, stamps or repairs databases. Compose and Render pin HOLD, Pages deployment and Render Git autodeploy are disabled in source, and manual deployment scripts exit before SSH or remote commands. All 38 freeze tests pass.

Existing remote deployments, provider configurations, native installations and previously built clients remain UNKNOWN. No remote state was altered. Source controls cannot change an already running service, guarantee external Blueprint settings, or prevent an operator from editing a hold. Infrastructure ownership and exact-environment evidence remain OPEN release gates.

## Evidence-backed surface inventory

| Surface | Classification and current evidence |
| --- | --- |
| Backend | Active FastAPI/SQLAlchemy/Pydantic source; default clinical HTTP entry held; preserved factory tested with synthetic records |
| Web/PWA | Active React/Vite source; fresh locked install, tracked tests and build pass; public copy and lint debt remain |
| Expo mobile | Active source; fresh locked install and typecheck pass; physical-device and store distribution unverified |
| Native iOS | Reference SwiftUI/WebView source described by ios-native/README.md; no native build or launch claim |
| Main database | Main SQLAlchemy Base plus health models; SQLite used only in disposable tests; hosted PostgreSQL configuration is reference source |
| Accounts database | Separate Base/URL in app/accounts/database.py; separate synthetic SQLite path supplied by audit harness |
| Migration systems | Alembic has onboarding_verification_v1 as its single head; legacy scripts and preserved runtime drift repair remain; no upgrade/restore was executed |
| File stores/providers | Local/S3/Azure and AI/video/payment/credential adapter source; default API held; real operational/provider approval state unknown |
| Infrastructure | Azure Bicep compiled and 12 offline tests passed; historical cloud notes do not verify current resources |
| Release channels | Docker, Compose, Render, Pages and manual scripts inventoried; local hold controls tested; remote runtime and distribution state unknown |
| Generated/local state | dotenv and database filenames, dependency folders, caches and build outputs inventoried; contents of live/local data stores excluded |
| Documentation | Existing deployment/product/provider notes are references; these maintained ledgers and dated command evidence govern Phase 0 status |

## Reproducible measured baseline

The [before/after comparison](evidence/phase0-completion-2026-09-14/backend-comparison.json) uses starting-commit and current-source snapshots under the same Python 3.12 environment installed fresh from `backend/requirements.phase0.lock`, with hashes enforced. Installed versions are checked against every locked package before reuse. The lock is for the audit environment, not a new production release specification.

| Check | Result |
| --- | --- |
| Full backend suite, original and current | 242 collected; 180 passed, 62 failures, 0 errors, 0 skipped; identical failing case IDs, no timeout |
| Backend focused security | 120 passed, no skipped SDK module |
| Local launch/release freeze | 38 passed |
| Alembic heads | One head; graph inspection only |
| Azure Bicep compilation/tests | 12 passed offline |
| Frontend/mobile npm ci | Both fresh installs passed, original lockfiles unchanged |
| Tracked frontend tests | 17 passed |
| Existing untracked frontend tests | 12 passed, 3 failed; ambiguous selectors reproduced, files preserved |
| Frontend build/mobile typecheck | Passed |
| Frontend lint | 115 errors, 11 warnings; pre-existing source debt |
| Frontend dependency audit | 15 affected package entries: 1 critical, 8 high, 6 moderate |
| Mobile dependency audit | 42 affected package entries: 1 critical, 16 high, 25 moderate |
| Complete locked backend audit | 77 packages covered, none skipped; 35 advisory entries across 4 packages |
| Gitleaks source and local history | Zero findings with 222 pinned rules; tracked dotenv included and redacted; scope and latest counts in scan evidence |

[Client evidence](evidence/phase0-completion-2026-09-14/client-summary.json), [backend audit](evidence/phase0-completion-2026-09-14/backend-audit-summary.json), [freeze review](evidence/phase0-completion-2026-09-14/freeze-review.json), and [secret-scan review](evidence/phase0-completion-2026-09-14/secret-scan-review.md) record exact commands, limitations and hashes. Advisory counts are not equivalent to exploitable production vulnerabilities; reachability and repairs remain assigned release blockers.

The backend harness explicitly binds the local tests namespace, uses separate disposable databases, clears inherited configuration and denies Python TCP/UDP/DNS calls before tests. No OS-level sandbox or arbitrary subprocess-network denial is claimed. Only repeated demo seed password hashing is cached in the legacy suite to bound fixture cost; real bcrypt still runs for the first seed hash and application authentication. The test is not a startup-performance or per-account seed-salt evaluation. Both comparison runs use this same fixture. Earlier incomplete diagnostics are historical evidence, not passing results.

## Resume commands

Use Python 3.12 and the recorded Node/npm versions. From the repository, run `python3.12 scripts/kaya_phase0_baseline.py /absolute/new-empty-directory-outside-repository` for fresh backend/client installs and measurements. The individual `kaya_phase0_backend.py` and `kaya_phase0_clients.py` scripts allow separate runs. Public package installation/audits contact their registries with dependency metadata only. Client checks block Node networking; no application browser or live API is started.

For an original-source comparison, run `python3.12 scripts/kaya_phase0_backend.py /absolute/new-before-directory --source-revision a860f8bae48095fb97abf493e37e6340111652e3 --venv /absolute/completed-backend-directory/venv --checks backend-full backend-focused`. Reuse verifies the exact installed lock versions. All paths must be disposable and outside the repository.

Run `python scripts/kaya_phase0_audit.py --output /absolute/evidence-directory` in a separate environment with the recorded pip-audit 2.10.1. Run the pinned Gitleaks command in its review document. Package/scanner tool installation is separate from application code; audits do not activate providers. Baseline script completion means measurements were captured, not that legacy checks passed or a release was approved.

## Phase gate and rollback

All Phase 0 controlled acceptance criteria are satisfied: reproducible isolated baseline, preserved work, classified surfaces/release channels, visible hazards and external owners, tested local freeze, retained evidence and one local phase-owned checkpoint. Existing failures and vulnerabilities belong to later remediation phases and remain blocked from clinical release. Every human/external gate remains OPEN; roles are proposed accountability, not fabricated human approvals.

**Safe to paste Phase 1 YES**, for isolated technical work under the retained hold. Clinical use, pushing, deployment, live migrations, provider activation, payments and real enrollment remain outside this task. No schema or records changed. Reverting the freeze would re-expose unresolved behavior; preserve it during recovery and use the checkpoint to restore audited source. Startup migration removal is a temporary Phase 0 control, not migration-readiness evidence.
