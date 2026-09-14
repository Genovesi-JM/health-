# Kaya execution status

**Phase 0 COMPLETE_WITH_EXTERNAL_GATES. Phase 1 COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD.** Updated 14 September 2026. The user selected Angola — Luanda for planning only. No operator, clinic, clinical owner, data controller or formal jurisdiction adoption is approved. The Phase 0 baseline remains historical evidence; Phase 1 records below govern the current local source.

## Repository and preservation

Target `/Users/genovesimaria/Documents/kaya-web`, branch `fix/nurse-queue-and-i18n`, starting HEAD `a860f8bae48095fb97abf493e37e6340111652e3`. Canonical remote is `https://github.com/Genovesi-JM/health-.git`. The local tracking ref was five commits behind this branch at the start; no fetch or push occurred. See [final repository evidence](evidence/phase0-completion-2026-09-14/repository-final.json) and the Phase 0 checkpoint commit named `Complete Kaya Phase 0 baseline and clinical launch hold`.

The existing modified `backend/email_log.txt` and untracked `frontend/src/components/DocumentUpload.test.tsx`, `frontend/src/components/OnboardingShell.test.tsx`, and `frontend/src/pages/AdminExpiryPage.test.tsx` are preserved and excluded from the checkpoint. Their original hashes are in the dated baseline evidence; final hashes are independently compared. The email log and local databases were never copied into tests. The three frontend tests were measured separately without adopting or editing them.

## Local launch freeze

At the Phase 0 checkpoint, default `app.main:app` returned 503 with no-store on every HTTP request, including health/readiness, authentication, webhooks and unknown routes; WebSocket access is denied. It imports no clinical settings, routers or database initialization. The original clinical factory is retained in `app.synthetic_runtime`, with an identical AST to the starting version. Its module now checks the isolated test selector before clinical imports and exposes no eager ASGI app.

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

**At the Phase 0 checkpoint: Safe to paste Phase 1 YES**, for isolated technical work under the retained hold. Clinical use, pushing, deployment, live migrations, provider activation, payments and real enrollment remain outside this task. No schema or records changed. Reverting the freeze would re-expose unresolved behavior; preserve it during recovery and use the checkpoint to restore audited source. Startup migration removal is a temporary Phase 0 control, not migration-readiness evidence.

## Phase 1 — Angola/Luanda planning perimeter

The starting Phase 1 checkpoint is `d6d99953846602ab411822cfa616e4c753f41ed7`, on the same branch and canonical origin. The local branch began six commits ahead of its remote tracking branch after the separately requested GitHub comparison. No fetch, pull, push, branch switch, merge, deployment or external communication occurred in Phase 1. The four original dirty files remain excluded from this phase; see [starting repository evidence](evidence/phase1-2026-09-14/repository-start.json).

The user's exact answer, “Angola — Luanda,” is a product-planning selection. [The jurisdiction decision](KAYA_JURISDICTION_DECISION.md) compares the Spain-first alternative across operator, clinic, clinical ownership, controller, emergency pathway, language, payments, provider contracts and hosting/transfers. Formal signed adoption is BLOCKED_EXTERNAL. Language, currency, timezone, IP, headers and cloud region are not jurisdiction permission.

[The canonical policy](../policy/kaya_phase1_policy.json), [generated capability matrix](KAYA_CAPABILITY_MATRIX.md) and [draft pilot scope](KAYA_PILOT_SCOPE.md) define invited adult primary-care appointment coordination through one named clinic, with human confirmation. Operator/clinic/clinical owner/controller and operating dates remain null. Proposed hours, capacity, staffing and ten metric thresholds are draft hypotheses. Emergency/urgent care, minors/proxies, clinical advice, prescriptions, AI, video, payments, public marketplace, devices and Kaya Response are excluded. No actual participant workflow is activated in Phase 1.

There are 22 capability flags, all false, bound to 258 preserved mounted API method/path declarations and every declared legacy web path. Three generated JSON copies keep the backend, web and Expo source aligned. The generator verifies exact declaration coverage and copy drift. It is a source check, not deployed-runtime attestation. Existing clinical implementation is classified as preserved source; this does not claim all features work or pass tests.

The default backend still denies clinical, auth, webhook, health/readiness and unknown requests with 503/no-store. Its sole informational exception is GET `/api/v1/public/pilot-scope`, which validates packaged policy and returns planning/capability metadata without clinical settings, database or provider imports. Missing/malformed policy, enabled flags and approval-state mutations fail closed. The preserved Phase 0 synthetic factory remains isolated development source, not a public activation path.

Web and Expo entrypoints now render information only at every route/profile. The legacy applications are preserved byte-for-byte as `LegacyApp.tsx` but are not imported or mounted. Public metadata is neutral; enrollment, auth/session restoration, routing into clinical pages and background health registration are absent. Direct API/video/device/native-sync helpers reject operational access. Static assets and service-worker registration/update may still use networking; clinical/provider/session egress is blocked by the tested boundary. Source Expo permissions/configuration are informational; installed SDKs, compiled entitlements, native binaries and existing deployed clients remain unverified. Native iOS is outside the pilot.

Draft metric evaluation is offline simulation only. Missing/invalid values and insufficient samples block, zero-tolerance incidents require HOLD, capacity/coverage/support breaches stop affected work, and synthetic respondents cannot supply human comprehension evidence. Individual comprehension failures cannot be overridden by an aggregate score. Every evaluator result retains release HOLD; there is no auto-resume or admission implementation. Independent review caught and closed weakened operator/evidence/ownership/staffing validation and route-inventory coverage gaps.

Final command evidence, source digests and review limits are retained under `docs/evidence/phase1-2026-09-14`. Phase 0 legacy failures, lint debt and dependency advisories remain open; this phase does not repair them or claim a fresh full-suite/audit result. The new policy/default entrypoints and unchanged synthetic factory receive focused regression checks. Final engineering checks pass: 38 original hold tests, 74 Phase 1 API tests, 120 focused backend security tests, 20 policy/inventory tests, 38 web tests across seven files, web build, mobile typecheck and targeted new-web-code lint (zero errors/warnings). Browser checks at 1280 and 390 pixel widths report no overflow, page errors or clinical/external request attempts. Evidence records the exact lock reuse, commands, source copies and limitations.

Restoration must preserve the Phase 0 backend/deployment hold. Restore reviewed Phase 1 artifacts from the local checkpoint and regenerate mirrors; do not reconnect LegacyApp, register background tasks, or clear a false flag as a rollback shortcut. No data/schema migration was executed. A code rollback is not approval to reopen care.


**Phase 1 engineering gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 2 accountable governance, risk ownership and evidence-system work in isolation. Phase 2 has not started. Formal adoption and all P1-G01–P1-G08 gates remain OPEN / BLOCKED_EXTERNAL; no gate is approved by the local checkpoint. The checkpoint is identified by commit message `Define Kaya Phase 1 Angola Luanda pilot perimeter` and its hash in the completion report.
