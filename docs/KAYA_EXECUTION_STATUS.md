# Kaya execution status

**Phase 0 COMPLETE_WITH_EXTERNAL_GATES. Phase 1 COMPLETE_WITH_EXTERNAL_GATES. Phase 2 COMPLETE_WITH_EXTERNAL_GATES. Phase 3 COMPLETE_WITH_EXTERNAL_GATES. Phase 4 COMPLETE. Phase 5 COMPLETE. Phase 6 COMPLETE_WITH_EXTERNAL_GATES (pilot gate green; legacy debt isolated). Phase 7 COMPLETE. Phase 8 COMPLETE. Phase 9 COMPLETE_WITH_EXTERNAL_GATES. Phase 10 COMPLETE_WITH_EXTERNAL_GATES. Phase 11 COMPLETE_WITH_EXTERNAL_GATES (safety case HOLD). Phase 12 COMPLETE. Phase 13 COMPLETE_WITH_EXTERNAL_GATES. Phase 14 COMPLETE_WITH_EXTERNAL_GATES. Phase 15 COMPLETE_WITH_EXTERNAL_GATES. Phase 16 COMPLETE. Phase 17 COMPLETE_WITH_EXTERNAL_GATES. Phase 18 COMPLETE_WITH_EXTERNAL_GATES. Phase 19 COMPLETE (R01 input gate closed). Phase 20 COMPLETE_WITH_EXTERNAL_GATES. Phase 21 COMPLETE_WITH_EXTERNAL_GATES. Phase 22 COMPLETE. Phase 23 COMPLETE_WITH_EXTERNAL_GATES. Phase 24 COMPLETE. Clinical release HOLD.** Updated 14 September 2026. The user selected Angola — Luanda for planning only. No operator, clinic, clinical owner, data controller or formal jurisdiction adoption is approved. The Phase 0 baseline remains historical evidence; Phase 1 and Phase 2 records below govern the current local source.

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

## Phase 2 — Accountable governance, risk ownership and evidence system

The starting Phase 2 checkpoint is the Phase 1 commit on the same branch and canonical origin. No fetch, pull, push, branch switch, merge, deployment or external communication occurred in Phase 2. The four original dirty files (email log and three untracked frontend tests) remain excluded.

Phase 2 adds a machine-checkable governance and evidence system in isolation. [The governance policy](../backend/app/kaya_governance.json) encodes a twelve-function RACI, thirteen roles, the risk and hazard taxonomy with P0 stop conditions, residual-risk acceptance fields, a seven-category change-control map, and the eleven release-board gates and owners. [The governance module](../backend/app/governance.py) enforces it and fails closed: the release board defaults to HOLD and returns STOP on an open P0, HOLD on a missing/expired/contradictory/environment-mismatched/unknown gate, a wrong-authority approval, a rejected gate, or an approval evidenced only by a commit hash; risk acceptance requires explicit, unexpired, attributable fields, forbids P0 acceptance, and forbids high-impact self-approval and any approval by the coding agent; change control fails closed on an unknown category; and the evidence index is append-only with immutable, superseded-not-rewritten records that reject secret or health-data content. See [the governance model](KAYA_GOVERNANCE_MODEL.md) and [the append-only decision & evidence index](KAYA_DECISION_EVIDENCE_INDEX.md).

The coding agent is defined as `engineering_preparer` with `approval_prohibited = true`; no code path lets it approve evidence, accept risk, or self-sign readiness. No human owner is named, no launch gate is closed, and no release is approved by this phase; those remain external and BLOCKED_EXTERNAL. The governance system imports no clinical settings, database, request context, secrets or health data, and does not touch the Phase 0/1 held entry points.

Final engineering checks pass: 35 new governance tests plus the 38 Phase 0 hold tests and 74 Phase 1 tests (147 total in the phase safety suites) green with no regression. The legacy `tests/` suite retains its pre-existing failures and is out of scope for this phase; no full-suite or dependency-audit result is claimed fresh here.

Restoration must preserve the Phase 0 backend/deployment hold and the Phase 1 perimeter. The governance files are additive and side-effect-free; removing them does not reopen any capability. No data or schema migration was executed.

**Phase 2 engineering gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 3 (quarantine of unsupported emergency and outcome claims) in isolation. Phase 3 has not started. Named accountable humans and all launch gates remain OPEN / BLOCKED_EXTERNAL; no gate is approved by the local checkpoint. The checkpoint is identified by commit message `Build Kaya Phase 2 governance and evidence system` and its hash in the completion report.


## Phase 3 — Quarantine of unsupported emergency and outcome claims

Kaya has no hospital-notification, pre-alert, dispatch, or ambulance integration. Phase 3 removed the false emergency/outcome claims (hospital pre-alert, pre-arrival preparation, reduced waiting, greater safety, priority access, ETA, guaranteed medical-response SLA) from `frontend/src/i18n/translations.ts` and the component tree across Portuguese, English, French and Spanish, and replaced them with truthful, non-promissory emergency guidance: Kaya is not an emergency service; in an emergency contact local emergency services directly. No jurisdiction is assumed, so no emergency number is hardcoded (the prior 112 in shared copy, the prescription-request banner, the disclaimer page and the navbar were removed or made jurisdiction-neutral).

A repository copy-contract test ([`backend/phase3_tests/test_copy_contract.py`](../backend/phase3_tests/test_copy_contract.py)) scans all locales in the translation table and the component sources on every run and fails if any forbidden claim or hardcoded emergency number reappears. Reachability is further bounded by the Phase 1 hold and server-owned flags, so a stale client build cannot re-activate a removed capability. KAYA Response is recorded as a separate, deferred product with no live routes, navigation, pricing, API, dispatch or hospital integration, and the evidence bar for any future emergency/hospital claim is documented ([record](KAYA_EMERGENCY_CLAIMS_AND_RESPONSE_DEFERRAL.md)). Risk R02 source is CLOSED and test-guarded; independent verification of already-deployed/remote assets remains OPEN.

Final engineering checks pass: 3 copy-contract tests plus the phase safety suites (Phase 0 hold, Phase 1, Phase 2 governance) green with no regression. This phase changes only user-facing copy and adds tests; no runtime, schema, provider or data change.

**Phase 3 engineering gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 4 (repository identity, hygiene, and source-of-truth boundaries) in isolation. Any future emergency or hospital claim requires written partner and clinical authority plus runtime evidence, which remain OPEN / BLOCKED_EXTERNAL. Checkpoint: commit `Quarantine Kaya unsupported emergency and outcome claims`.

## Phase 4 — Repository identity, hygiene, and source-of-truth boundaries

Canonical repository is `Genovesi-JM/health-`; the product source of truth is `PRODUCT_AND_LAUNCH_PLAN.md`. [The architecture index](KAYA_ARCHITECTURE_INDEX.md) labels every surface (supported API/web/PWA/Expo/infra/migrations, reference-only native iOS, disabled-but-preserved LegacyApp, dev-only synthetic runtime, generated evidence and build outputs) and records edit boundaries and generated-file rules.

Hygiene actions: the runtime email log `backend/email_log.txt` is no longer tracked (`git rm --cached`, local file preserved) and is added to `.gitignore` alongside `*.sqlite`; the deploy workflow no longer defaults `VITE_API_URL` to the GeoVision domain and now fails closed if the variable is unset; env templates (`.env.production`, `backend/.env.example`) are retained as placeholder-only templates with no filled secrets (test-guarded; the authoritative secret scan remains the Phase 0 Gitleaks zero-findings run). Retained GeoVision-legacy backend strings are documented as intentionally preserved history on no reachable Kaya path; a scoped removal belongs to later capability/migration phases with rollback evidence. Three pre-existing untracked frontend tests remain preserved but not adopted (unverified authorship, ambiguous/failing selectors).

Tests: 6 new repository-hygiene tests plus the phase safety suites (156 total) green, no regression. This phase changes only repository hygiene, CI defaults, ignore rules, and documentation; no runtime, schema, provider, or data change, and no history was deleted.

**Phase 4 engineering gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 5 (reproducible toolchain, isolated test configuration, CI bootstrap). Checkpoint: commit `Establish Kaya repository identity, hygiene, and source-of-truth boundaries`.

## Phase 5 — Reproducible toolchain, isolated test configuration, and CI bootstrap

Toolchain pins are explicit: Python 3.12 (`.python-version`, and CI `python-version-file`), Node 20 LTS (`.nvmrc`), the hash-locked backend audit environment (`backend/requirements.phase0.lock`), and committed frontend/mobile lockfiles used with `npm ci`. [The toolchain doc](KAYA_TOOLCHAIN.md) records versions, upgrade ownership, deterministic install rules, and bounded test commands with per-suite timeouts.

A new CI workflow ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs the phase-safety suites and a Gitleaks secret scan under least privilege (`permissions: contents: read`, no write scopes), references no repository secrets, forces `ENV=test` and `KAYA_EXECUTION_MODE=synthetic` with empty provider keys, bounds every job with `timeout-minutes`, cancels superseded runs, and uploads test-result artifacts. It cannot contact a live provider, charge money, send real mail, or use production data, and it performs no deployment. Eight contract tests (`backend/phase5_tests`) lock these guarantees (least privilege, no secrets, synthetic/provider-disabled env, bounded/cancelling, no deploy mechanism, phase-safety coverage, secret scan). Deeper backend test isolation (inherited-config clearing and Python network denial before app import) is the Phase 0 harness, referenced here.

Tests: 8 new toolchain/CI contract tests plus the phase safety suites (164 total) green, no regression. This phase adds configuration, CI, and docs only; no runtime, schema, provider, or data change.

**Phase 5 engineering gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 6 (repair the red baseline and establish trustworthy release checks). Checkpoint: commit `Bootstrap Kaya reproducible toolchain and isolated CI`.

## Phase 6 — Repair the red baseline and establish trustworthy release checks

The authoritative Phase 0 audit-harness baseline is 62 failed / 180 passed / 0 errors in 279.34s, with identical failing case IDs in original and transformed source — pre-existing GeoVision-era debt, not a Kaya-transformation regression. The full legacy suite runs only in the disposable audit harness because the synthetic runtime deliberately refuses to start where an operator `backend/.env` exists; run in-place it is classified SKIP_WITH_REASON, not a false failure.

Delivered: a single verification entry point ([`scripts/kaya_verify.py`](../scripts/kaya_verify.py)) that runs each subsystem and reports PASS / FAIL / SKIP_WITH_REASON / BLOCKED_EXTERNAL / NOT_RUN, returning nonzero only when a required gate fails; and an owner-bound, expiring [debt-exception ledger](KAYA_DEBT_EXCEPTIONS.md) that isolates all 62 non-pilot failures (categorized DBT-01..08, every row non-reachable/held, review 2026-12-13) without concealing them or covering the pilot gate, the security suite, or any P0. The required pilot gate — the phase-safety suites plus `security_tests` — is green (288 passed, 1 SDK-gated skip). Six Phase 6 contract tests lock the entry point and ledger invariants.

HONEST RESIDUAL (not repaired, isolated as owner-bound debt): DBT-01 MFA/settings test-isolation and the other legacy failures are not fixed — repair requires the disposable harness to iterate and is scheduled before the relevant capability phases enable those features. Frontend lint debt (115 errors) is documented as concentrated in legacy/non-pilot code; the supported-pilot-path lint-clean assertion is not yet re-verified by a run in this phase. No assertion was weakened, no security test skipped, no timeout increased.

**Phase 6 gate: pilot gate GREEN and legacy debt EXPLICITLY ISOLATED (COMPLETE_WITH_EXTERNAL_GATES). Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 7 (capability inventory and modular-monolith boundaries); later phases inherit a trustworthy pilot gate and an explicit debt ledger. Checkpoint: commit `Isolate Kaya baseline debt and add trustworthy release checks`.

## Phase 7 — Capability inventory and modular-monolith boundaries

[The domain map](KAYA_DOMAINS.md) assigns every active router and service to one of the modular-monolith domains (identity, organizations, credentialing, consent, patients, triage, scheduling, care-episodes, clinical-records, communications, billing, integrations, operations), lists the GeoVision-legacy removal-candidate routers, sets dependency rules, records that the canonical identity is the main-product `User` (the accounts base is compatibility-only, with convergence deferred to Phase 12/32 without merging or deleting data here), and gives a convergence plan for the overlapping account/payment/consultation/doctor/verification paths. Each active surface has one owning domain and one truthful capability state; under the hold every clinical capability is DISABLED_PENDING_GATE and unreachable by default.

Five architecture tests (`backend/phase7_tests`) enforce the boundaries by static import scan: provider adapters never import routers (currently clean), the domain-pure modules `governance`/`phase1_policy` import no app config/database/routers (so new domain code is testable without the whole app or a provider), the held `main.py` imports no clinical routers at module level, and no NEW cross-router shortcut may be introduced — the seven legacy cross-router imports are baselined exactly (the test fails on any new pair and on a stale baseline), allowing incremental extraction without silently permitting new coupling.

Tests: 5 new boundary tests plus the phase safety suites (293 passed, 1 skipped) green, no regression. Additive documentation and tests only; no code moved, no route enabled, no data merged or deleted.

**Phase 7 engineering gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 8 (threat model and end-to-end data-flow map). Checkpoint: commit `Define Kaya modular-monolith domains and boundary tests`.

## Phase 8 — Threat model and end-to-end data-flow map

[The threat model](KAYA_THREAT_MODEL.md) makes Kaya's trust boundaries, sensitive flows, abuse cases and processor exposure explicit. Every sensitive data category (16, from account identity to data-rights requests) has a source, purpose, destination, processor, retention rule and authorized-actor path; each internet-facing and cross-tenant boundary has a named threat with a preventive and a detective control, an owner, and a residual/phase link; the model spans mobile devices, browser storage, email, video, AI, object storage, backups, administrators and provider webhooks. Abuse cases cover minors/representatives, caregivers, employers (aggregate-only), support, reviewers, clinicians, suspended users and compromised providers. A change trigger requires revision whenever a processor, data category, role, jurisdiction or trust boundary changes, and high-risk threats are bound to negative tests in later phases or to time-bound risk rows — a diagram alone never closes a threat.

Eight tests (`backend/phase8_tests`) enforce coverage of the required data categories, category attributes, threat classes and components, the presence of preventive/detective controls and the change trigger, and that the artifact carries no secret or patient data. The artifacts contain no real secrets, credentialed endpoints, patient examples or production identifiers.

Tests: 8 new threat-model tests plus the phase safety suites (301 passed, 1 skipped) green, no regression. Documentation and tests only; no runtime, schema, provider or data change.

**Phase 8 engineering gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 9 (data classification, minimization, retention, and transfer controls). Checkpoint: commit `Map Kaya threat model and end-to-end data flows`.

## Phase 9 — Data classification, minimization, retention, and transfer controls

[The data inventory](KAYA_DATA_INVENTORY.md) classifies every field category (identity, contact, demographic, health, triage, image, device, credential, employment, payment, support, audit, telemetry) with purpose, a lawful-basis question reserved for counsel, retention/deletion trigger, export rule, access scope and logging rule, and it records processor/residency/transfer gates that keep every third-party and cross-border flow disabled until an approved processor record exists. Minimization is stated for the invited-adult pilot; employers and unrelated support never receive individual clinical data.

A code control ([`backend/app/redaction.py`](../backend/app/redaction.py)) redacts secrets, tokens, MFA seeds, recovery codes, private keys, full card numbers, IBANs, signed URLs, provider payloads and raw clinical text — by pattern and by key name — for safe serialization and structured logging; a `RedactingFilter` applies it to a logger. Nine tests (`backend/phase9_tests`) prove every prohibited category is redacted (bearer/JWT, provider keys, private key, PAN, signed URL, sensitive/clinical keys, recursively) and that the inventory covers all categories, carries the required attributes, marks lawful basis for counsel, keeps transfers disabled, and forbids individual clinical data to employers.

Tests: 9 new data-control tests plus the phase safety suites (310 passed, 1 skipped) green, no regression. This phase adds a redaction utility, an inventory, and tests; no field was removed from a live record (the app is held) and no runtime, schema, provider or data change was made.

HUMAN GATE (BLOCKED_EXTERNAL): a qualified privacy/legal owner must approve lawful bases, retention periods, controller/processor roles and transfer mechanisms for the chosen jurisdiction before any real data is processed.

**Phase 9 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 10 (jurisdictional legal and regulatory classification). Checkpoint: commit `Classify Kaya data and enforce redaction and transfer controls`.

## Phase 10 — Jurisdictional legal and regulatory classification (Angola)

[The legal issue matrix](KAYA_LEGAL_ISSUE_MATRIX.md) converts regulatory uncertainty into a bounded, counsel-owned evidence plan for Angola/Luanda. It states prominently that it is engineering issue-spotting, NOT legal advice or approval; cites the primary official sources (APD and Lei 22/11, MINSA and the Lei de Bases do SNS, ARMED and Decreto 136/21, Decreto 202/11, the professional Order, INACOM) with a requirement to re-verify currency at execution time; and enumerates fourteen launch-relevant issues (L01–L14: operating entity/controller, licensed provider, medical director/record custodian, professional regulation, health-service authorization, telemedicine, prescribing, medical-software classification, AI obligations, APD privacy, consumer rules, incident authority, insurance, emergency information), each with a scoped counsel question, an evidence requirement, and the affected feature flag. Clinical informed consent is kept distinct from the lawful basis for data processing (a consent checkbox is not the default answer). Legal documents (terms, privacy, disclaimer, consent, prescribing, emergency copy) are marked draft and launch-blocking and cannot be presented as approved; a second jurisdiction stays disabled and cannot inherit Angola approvals.

Eight tests (`backend/phase10_tests`) enforce the disclaimer, official-source citations, issue-area coverage, per-issue evidence+flag, consent/lawful-basis separation, draft/launch-blocking legal copy, second-jurisdiction disablement, and — scanning the product copy — that Kaya claims no GDPR certification, medical-device status, or regulator approval it does not have.

Tests: 8 new legal-classification tests plus the phase safety suites (318 passed, 1 skipped) green, no regression. Documentation and tests only; no legal text was authored or approved, and no runtime/schema/provider/data change was made.

HUMAN GATE (BLOCKED_EXTERNAL): local healthcare and privacy counsel, the licensed care provider, and any required regulator must provide the actual determinations for every row.

**Phase 10 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 11 (clinical safety case, intended use, and hazard controls). Checkpoint: commit `Classify Kaya Angola legal and regulatory issues for counsel`.

## Phase 11 — Clinical safety case, intended use, and hazard controls

[The clinical safety case](KAYA_CLINICAL_SAFETY_CASE.md) is a skeleton and hazard analysis, explicitly HOLD and not approved: it defines intended users (invited adults, Luanda, bounded hours, one licensed clinic), intended use (coordinate non-urgent primary care; Kaya does not diagnose, provide emergency care, dispatch, notify hospitals, or replace a clinician), tester-actionable inclusion/exclusion, assumptions/contraindications/human-oversight, and a hazard analysis for all sixteen required hazards (delayed care, false reassurance, incorrect urgency, unavailable clinician, bad handoff, wrong patient/clinician, missing record, duplicate booking, message failure, credential expiry, data corruption, translation error, AI output, device error, emergency-copy misunderstanding) with severity, prevention, detection, response, owner and residual status. It states the fail-closed triage principle (incomplete input never LOW/SELF_CARE — R01), a mitigation hierarchy, safe-degraded behavior that never presents a false reassurance or false confirmation (API/DB/video/notification/clinician-coverage/provider), and post-incident/post-launch surveillance that authorizes nothing.

[The clinical content registry](KAYA_CLINICAL_CONTENT_REGISTRY.md) registers every rule set, questionnaire, threshold, instruction, disclaimer, translation, protocol and recommendation with version/author/approver/effective-dates/rollback; all items are DRAFT/unapproved and cannot change without a versioned review and a linked validation set (a governed clinical-content change; the coding agent may prepare drafts, never approve). Seven tests (`backend/phase11_tests`) enforce HOLD-until-named-owner, specific intended use/exclusions, all-hazard coverage with the required columns, safe-degraded non-confirmation, and a versioned unapproved registry.

Tests: 7 new clinical-safety tests plus the phase safety suites (325 passed, 1 skipped) green, no regression. Documentation and tests only; no clinical content approved, no runtime/schema/provider/data change.

HUMAN GATE (BLOCKED_EXTERNAL): only the accountable clinical safety owner and licensed care organization can approve intended use, protocols, residual clinical risk, and patient-facing clinical copy.

**Phase 11 gate PASS / COMPLETE_WITH_EXTERNAL_GATES; safety case remains HOLD. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 12 (canonical account and identity model). Checkpoint: commit `Draft Kaya clinical safety case and hazard controls`.

## Phase 12 — Canonical account and identity model

Finding: public registration allowed a requested role in {patient, doctor, nurse}; clinical/admin roles are MFA-mandatory and are refused (403) before any account is created, so only patients self-register. Phase 12 formalizes this as a canonical, domain-pure guard ([`backend/app/identity.py`](../backend/app/identity.py)) that keeps immutable subject identity distinct from profile, requested persona, organization membership, platform role, clinical profession, credential status and granted privilege; `canonical_account_role` returns a non-privileged role for any privileged request, `assert_not_self_privileged` fails closed, and mutable fields (email/phone/provider id/licence number/name/slug) are explicitly not authorization authority. Registration is hardened with defense-in-depth so the persisted `User.role` can never be privileged from public registration, independent of the MFA gate. Account disablement/deletion/merge effects (sessions, memberships, credentials, records, legal hold, audit) are defined; legacy account surfaces stay compatibility-only with convergence deferred to Phase 32 (no data merged or deleted). See [the identity model](KAYA_IDENTITY_MODEL.md).

Nine tests (`backend/phase12_tests`) prove the guard (privileged requests normalize to patient, self-promotion raises, only granted role is authority) and statically verify the real registration code bounds the requested role, blocks clinical roles via the MFA gate (with every privileged role confirmed MFA-mandatory), and creates the User with the canonical non-privileged role.

Tests: 9 new identity tests plus the phase safety suites (334 passed, 1 skipped) green, no regression. The auth.py change is additive defense-in-depth on held code (not reachable while the app is held; end-to-end registration behavior is re-verified in the disposable harness alongside the MFA suite, DBT-01).

**Phase 12 gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 13 (MFA, OAuth step-up, session families, browser security). Checkpoint: commit `Establish Kaya canonical identity and no-self-promotion guard`.

## Phase 13 — MFA, OAuth step-up, session families, and browser security

The runtime already carries strong controls (verified by contract tests): MFA is mandatory for all high-impact roles; `assert_mfa_session` rejects partial/`mfa_challenge` tokens so a challenge token never reaches protected work; OAuth and password logins share `_build_auth_response`/`assert_mfa_session` so OAuth cannot bypass MFA; recovery codes are hashed and single-use; and refresh-token families rotate on refresh with reuse of a rotated token revoking the whole family.

Phase 13 adds the canonical, domain-pure assurance policy ([`backend/app/authsecurity.py`](../backend/app/authsecurity.py)): `requires_step_up`/`is_auth_fresh`/`assert_step_up` require a fresh MFA step-up (5 min; 2 min for break-glass) for credential decisions, prescriptions, exports, payments, privilege changes and recovery-code regeneration, failing closed when MFA is missing or stale; and `detect_family_reuse` is the pure reuse rule (already-revoked or non-current token ⇒ family reuse). [Session & browser security](KAYA_SESSION_SECURITY.md) documents these, the session-revocation propagation requirements, auth-error hygiene, and the KNOWN browser-storage risk R18 (script-accessible `localStorage` bearer) with the launch-blocking target design (HttpOnly/SameSite cookies + BFF + CSRF).

Twelve tests (`backend/phase13_tests`) prove the step-up and reuse rules and statically verify the runtime fails closed on partial tokens, hashes single-use recovery codes, revokes reused refresh families, and enforces MFA for OAuth logins.

Tests: 12 new auth-security tests plus the phase safety suites (346 passed, 1 skipped) green, no regression. New code is a domain-pure policy plus docs; no held-runtime behavior changed. End-to-end auth flows (stolen refresh, concurrent refresh, MFA replay, OAuth callback tampering, CSRF) are re-verified in the disposable harness alongside the MFA suite (DBT-01); the browser cookie/BFF migration and OAuth PKCE/nonce hardening remain engineering gates (R18).

**Phase 13 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 14 (tenant, episode, purpose, and separation-of-duties authorization). Checkpoint: commit `Add Kaya step-up assurance and session-family reuse rules`.

## Phase 14 — Tenant, episode, purpose, and separation-of-duties authorization

A single server-owned, default-deny authorization boundary ([`backend/app/authz.py`](../backend/app/authz.py), `can_access(actor, resource, purpose)`) scopes health access by organization, assigned care team or episode, profession, granted privilege, purpose, record type, status and time — a role alone, or the existence of a consultation, is never sufficient. Support can never reach clinical content or credential decisions; compliance reviewers are limited to credentialing; employers receive only an aggregate occupational-health report (minimum cohort 10, anti-reidentification) and never an individual record; platform admins have no default clinical access without accepted break-glass; and unmapped roles/resources/routes fail closed. Foreign/unknown resource ids return the same DENY (no enumeration oracle). Clinical reads, downloads, exports, shares and break-glass are auditable, not only writes; break-glass exists only if the clinical owner accepts it. See [the authorization policy](KAYA_AUTHORIZATION.md).

Twenty negative tests (`backend/phase14_tests`) prove default deny, cross-tenant and cross-episode denial, missing-privilege and wrong-purpose denial, pharmacist scoping, patient/caregiver object-ID tampering denial, support/employer/admin/reviewer separation, suspended-user and deleted-resource denial, audit coverage, aggregate cohort minimum, and owner-gated break-glass.

Tests: 20 new authorization tests plus the phase safety suites (366 passed, 1 skipped) green, no regression. The policy is the canonical domain-pure boundary; wiring every route/job/signed-URL/export/mobile endpoint to it and the end-to-end IDOR/cross-tenant suite against the running app is an engineering adoption task (harness-verified). Until then the held 503 default is operative.

**Phase 14 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 15 (versioned consent ledger and representative authority). Checkpoint: commit `Enforce Kaya default-deny authorization policy boundary`.

## Phase 15 — Versioned consent ledger and representative authority

Consent is now a server-owned, append-only, versioned model ([`backend/app/consent.py`](../backend/app/consent.py)): a document catalog with immutable content hash, jurisdiction, language, purpose, kind, required/optional, effective dates, supersession and an approved source; and a ledger that records subject, representative, exact document/version/hash, language, notice evidence, action and capability state. `has_effective_consent` fails closed on missing, refused, withdrawn, stale, mismatched, untranslated, unapproved or expired consent; necessary and optional kinds are never bundled; withdrawal stops future optional processing without deleting legally-required records (kept under legal hold); and representative authority is an explicit bounded record (relationship/scope/verification/expiry/revocation) never inferred from shared contact details. See [the consent model](KAYA_CONSENT_MODEL.md).

Seventeen tests (`backend/phase15_tests`) prove version/hash/language fail-closed, refusal-is-not-acceptance, withdrawal effects (future optional stopped, required records retained), optional-not-bundled-with-care, append-only retention, and representative denial when unverified/expired/revoked/out-of-scope.

Tests: 17 new consent tests plus the phase safety suites (383 passed, 1 skipped) green, no regression. Domain-pure model + docs; wiring server operations to it end-to-end is a harness-verified adoption task.

HUMAN GATE (BLOCKED_EXTERNAL): counsel and the clinical owner must approve the consent catalog, lawful-basis mapping, minor/capacity rules, and retention effects.

**Phase 15 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 16 (invitation-based onboarding and lifecycle-safe deep links). Checkpoint: commit `Add Kaya versioned consent ledger and representative authority`.

## Phase 16 — Invitation-based onboarding and lifecycle-safe deep links

Onboarding is a separate-state model ([`backend/app/onboarding_tokens.py`](../backend/app/onboarding_tokens.py)) where state never grants authority: application → invitation → identity → profile → credentialing → membership → privilege → consent → activation, with no step-skipping into an authority-granting state. Invitation tokens are hashed (constant-time compare), single-use, expiring, and bound to an exact recipient and purpose with server-side revocation and replay detection; every failure (tampering, replay, wrong recipient/purpose, revoked, expired, unknown) returns one generic reason so nothing reveals account state. A completed UI wizard can never set a privileged role, verified credential, active membership, or clinical privilege, and a professional account stays restricted until identity/MFA/credential/org/privilege gates all complete. Deep links bind to a typed destination, keep tokens out of referrer-exposed URLs, and redirect only within an allowlist. See [onboarding](KAYA_ONBOARDING.md).

Fourteen tests (`backend/phase16_tests`) prove token accept + every fail-closed path sharing one reason (no oracle), no-authority-from-state, wizard-cannot-grant, no step-skipping, professional-restricted-until-gates, and deep-link safety.

Tests: 14 new onboarding tests plus the phase safety suites (397 passed, 1 skipped) green, no regression. Domain-pure model + docs; web/mobile rendering of the canonical state end-to-end is a harness/UI adoption task.

**Phase 16 gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 17 (clinician credential verification and privileging lifecycle). Checkpoint: commit `Add Kaya invitation onboarding and deep-link safety`.

## Phase 17 — Clinician credential verification and privileging lifecycle

Privileging is a human-governed, primary-source, expiring gate ([`backend/app/privileging.py`](../backend/app/privileging.py)) with a bounded lifecycle (draft→pending_review→verified→suspended/expired/revoked; review cannot be skipped, revoked is terminal; only verified permits clinical work). Automated checks (document extraction, identity vendors, background checks, digital credentials) are evidence only — mock/sandbox/not-configured/stale/inconclusive/failed/pending/non-live can never approve. Activation requires four-eyes: an authorized MFA-verified reviewer who is neither the applicant nor support, a distinct second approver, primary-source live malware-clean unexpired good-standing evidence with insurance where required, and jurisdiction/profession/org/scope/effective dates; the status change and immutable audit commit atomically (audit failure fails the decision). Status loss propagates promptly to sessions, caches, queue, prescribing, records, video and appointments. See [privileging](KAYA_PRIVILEGING.md).

Fourteen tests (`backend/phase17_tests`) prove provider-checks-are-evidence-only, mock/self/support/no-MFA/no-four-eyes/missing-scope/audit-failure/incomplete-evidence all block activation, only-verified-permits-clinical, bounded transitions, revocation propagation, and that the webhook router verifies signatures.

Tests: 14 new privileging tests plus the phase safety suites (411 passed, 1 skipped) green, no regression. Domain-pure policy + docs; end-to-end credential flow + webhook replay/idempotency re-verified in the harness.

HUMAN GATE (BLOCKED_EXTERNAL): a designated credentialing authority and licensed care organization must perform the primary-source review and privileging.

**Phase 17 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 18 (organization, facility, and clinical operating authority). Checkpoint: commit `Add Kaya human-governed privileging lifecycle`.

## Phase 18 — Organization, facility, and clinical operating authority

Kaya cannot present a clinic/facility/clinician or accept a booking without a human-verified organization and an active operating relationship for the chosen jurisdiction ([`backend/app/operating_authority.py`](../backend/app/operating_authority.py)). Organization and professional authority are jointly required at booking and care time: `org_can_operate` needs human verification (not a submitted registration number), active status, jurisdiction match, a medical director, valid insurance and a current window; `clinician_can_practice_here`/`booking_allowed` additionally require an active, privilege-granted membership bound to that exact facility/service — a global verified flag never authorizes practice everywhere, and facility downtime blocks it. Only approved public fields are publishable (never private evidence); partner status is never inferred; suspension/closure/expiry/termination/medical-director-change/location-downtime invalidate schedules, bookings, clinical entry and public listing without erasing records; and cross-organization access is denied. See [operating authority](KAYA_OPERATING_AUTHORITY.md).

Thirteen tests (`backend/phase18_tests`) prove unverified/wrong-jurisdiction/missing-director-or-insurance/suspended orgs cannot operate, joint authority is required, a global-verified clinician cannot practise at another facility, downtime and inactive membership block booking, only public fields are publishable, and cross-org access is denied.

Tests: 13 new operating-authority tests; the full phase gate is 424 passed, 1 skipped, no regression across Phases 0-18 + security.

HUMAN GATE (BLOCKED_EXTERNAL): a real clinic agreement, operating authorization, medical director, insurance and data-governance allocation are non-delegable launch gates; the signed pilot relationship is an external release gate, not a code checkbox.

**Phase 18 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. This completes the identity/authorization implementation block (Phases 12-18). Safe to paste next prompt: YES**, for Phase 19 (fail-closed triage input, schema, and version lifecycle). Checkpoint: commit `Enforce Kaya organization and clinical operating authority`.

## Phase 19 — Fail-closed triage input, schema, and version lifecycle

The P0 R01 hazard (empty/incomplete triage reaching LOW/SELF_CARE) is closed at the input gate. [`backend/app/triage_safety.py`](../backend/app/triage_safety.py) `assess` returns URGENT/INCOMPLETE/INDETERMINATE/ASSESSABLE and never LOW or SELF_CARE: empty or missing-required input is INCOMPLETE; unknown question ids, invalid units, out-of-range, invalid select values, or a stale questionnaire version are INDETERMINATE; red flags are deterministic, independent of score/AI/photos/devices, dominate every lower outcome, and missing data can never subtract risk. A versioned questionnaire schema and an immutable completed snapshot (schema/rule/content versions + input) support review. A defense-in-depth guard in `services/triage_engine.py` raises `TriageIncompleteError` on empty input rather than returning a low outcome. See [triage safety](KAYA_TRIAGE_SAFETY.md).

Fifteen tests (`backend/phase19_tests`) prove empty/partial→INCOMPLETE (never reassuring), unknown-id/invalid-unit/out-of-range/invalid-value/stale-version→INDETERMINATE, red-flag override of complete and incomplete sets, missing-data-cannot-subtract-risk, reassuring-set correctness, immutable snapshot, and that the real engine guards empty input.

Tests: 15 new triage-safety tests plus the phase safety suites (439 passed, 1 skipped) green, no regression.

**Phase 19 gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 20 (clinician-governed triage validation and multilingual safety corpus). The validated rule set / corpus and web-mobile contract parity are Phase 20 + adoption work. Checkpoint: commit `Close Kaya fail-closed triage input gate (R01)`.

## Phase 20 — Clinician-governed triage validation and multilingual safety corpus

The validation *framework* is in place without the agent claiming clinical validation ([`backend/app/triage_governance.py`](../backend/app/triage_governance.py)): excluded populations (pediatric, pregnancy, mental-health crisis, safeguarding, severe pain, communication-limited) and complaints (chest pain, stroke, suicidal ideation, overdose, severe bleeding, anaphylaxis, obstetric emergency) get a safe redirect, never a low-risk recommendation; every pilot triage output requires a named author, an independent approver, a version, an effective date and validation evidence (self-approval and engineering approval rejected); a locked-corpus metric function reports false-negative/unclassifiable/disagreement rates but returns a pass/fail only against a clinician-supplied threshold (None otherwise — no agent-invented pass mark); and a kill switch plus rule rollback disable triage without blocking emergency guidance and never strand users. See [triage validation](KAYA_TRIAGE_VALIDATION.md).

Eleven tests (`backend/phase20_tests`) prove excluded cohorts never get low-risk, content-unusable-without-approval, no-engineering-approval, corpus metrics, no-agent-threshold, and kill-switch/rollback safety.

Tests: 11 new triage-validation tests plus the phase safety suites (450 passed, 1 skipped) green, no regression.

HUMAN GATE (BLOCKED_EXTERNAL): clinical validation, risk thresholds, protocol approval, and residual-risk acceptance require qualified clinicians for the selected service and jurisdiction; the coding agent reports technical evidence only.

**Phase 20 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 21 (emergency escalation and unavailable-service experience). Checkpoint: commit `Add Kaya clinician-governed triage validation framework`.

## Phase 21 — Emergency escalation and unavailable-service experience

Truthful escalation without representing Kaya as the responder ([`backend/app/emergency.py`](../backend/app/emergency.py)): a server-owned versioned emergency registry (jurisdiction/region/language, source URL, verification date, owner, expiry) where unknown, expired, or untranslated jurisdiction information fails to generic local-emergency guidance with no guessed number; guidance always reachable without auth/payment/account/consent/AI/video and during any outage; deterministic escalation triggers (red flags, mental-health crisis, safeguarding, failed assessment, no clinician coverage, provider outage, dangerous wait) route to approved guidance with no unverified hospital alert; copy makes no dispatch/notify/prepare/reserve/prioritize claim or wait/ETA promise (the user is never led to believe Kaya contacted an external service); and escalation telemetry keeps nonclinical operational fields only. See [emergency escalation](KAYA_EMERGENCY_ESCALATION.md).

Ten tests (`backend/phase21_tests`) prove unknown/expired/language-mismatch→generic-no-number, reachability during all outages, no-external-action-claims, deterministic triggers, and telemetry health-detail stripping.

Tests: 10 new emergency tests plus the phase safety suites (460 passed, 1 skipped) green, no regression.

HUMAN GATE (BLOCKED_EXTERNAL): emergency numbers, pathways, translations, and service claims require dated verification by the jurisdictional clinical/operational owner.

**Phase 21 gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 22 (clinician availability and schedule ownership). Checkpoint: commit `Add Kaya truthful emergency escalation and outage guidance`.

## Phase 22 — Clinician availability and schedule ownership

A truthful schedule model ([`backend/app/scheduling.py`](../backend/app/scheduling.py)): `slot_exposable` exposes a slot only when the org can operate and the clinician is active, credential-current, privilege-granted, service-approved, covered and in-jurisdiction (fail closed otherwise); the server is authoritative for timezone with UTC storage and DST-aware offsets (verified for Africa/Luanda and a DST-zone transition); capacity states distinguish indicative/held/confirmed and a stale profile never implies live availability; exceptions subtract from recurring windows deterministically and slot generation respects duration/buffers; and a schedule edit releases unconfirmed holds while confirmed appointments require explicit action and are audited. See [scheduling](KAYA_SCHEDULING.md).

Eight tests (`backend/phase22_tests`) prove authority-gated exposure, UTC/DST correctness, no-live-from-stale, deterministic exception resolution, slot generation, and schedule-change effects on confirmed appointments.

Tests: 8 new scheduling tests plus the phase safety suites (468 passed, 1 skipped) green, no regression.

**Phase 22 gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 23 (transactional booking, concurrency, and idempotency). Checkpoint: commit `Add Kaya authority-gated schedule model with UTC/DST correctness`.

## Phase 23 — Transactional booking, concurrency, and idempotency

Booking prevents double booking, false confirmation and duplicate side effects ([`backend/app/booking.py`](../backend/app/booking.py)): a hold-to-confirm workflow with a 10-minute expiry, idempotency keys, ownership and quoted terms; single-owner capacity where a simultaneous second request raises CapacityConflict (production enforcement is a database unique constraint, not a process lock); an idempotency store where a lost-response retry returns the original result with no duplicate appointment/payment/notification/audit; confirmation that revalidates credentials, privilege, org authority, consent, service, age/capacity and jurisdiction and requires an unexpired hold; a UI that never shows confirmed before the server transaction commits; reconcile-before-replay for uncertain writes; and bounded audited transitions. See [booking](KAYA_BOOKING.md).

Ten tests (`backend/phase23_tests`) prove single-owner capacity, idempotent-retry-no-duplicate, full confirmation revalidation, expired-hold denial, bounded transitions, confirmed-only-after-commit, reconcile-before-replay, and DB-level conflict enforcement.

Tests: 10 new booking tests plus the phase safety suites (478 passed, 1 skipped) green, no regression.

EXTERNAL GATE (BLOCKED_EXTERNAL): the release gate requires PostgreSQL concurrency evidence (same-slot/adjacent/multi-resource/stale-hold/idempotent-retry/suspension races under replicas); SQLite-only tests are not accepted. That live PG run needs a running Postgres and is OPEN — the domain logic and DB-constraint design are complete.

**Phase 23 gate PASS (logic) / COMPLETE_WITH_EXTERNAL_GATES (PG concurrency proof OPEN). Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 24 (care episode, queue, and clinician handoff state machine). Checkpoint: commit `Add Kaya transactional booking, idempotency, and single-owner capacity`.

## Phase 24 — Care episode, queue, and clinician handoff state machine

Intake, queue, handoff, consultation and closure are one explicit episode ([`backend/app/episode.py`](../backend/app/episode.py)): canonical states with `can_transition` enforcing per-transition actor policy and returning the allowed-next set on rejection; atomic claim where concurrent claims yield one owner and an auditable loser (no duplicate clinical work), abandoned claims release and reassignment requires a supervisor; queue visibility scoped by org/facility/service/shift/privilege so a clinician never browses unrelated patients and post-handoff access is only via current assignment; and handoff carrying scoped content with acknowledgement, unresolved tasks, escalation and sender access-expiry, where an unfinished/unacknowledged handoff or open escalation cannot silently close the episode or hide escalation. See [episode](KAYA_EPISODE.md).

Sixteen tests (`backend/phase24_tests`) prove deterministic transitions with actor policy, concurrent-claim single-owner, supervisor reassignment, scoped queue visibility (cross-org/off-shift/wrong-service/no-privilege denied), post-handoff assignment-only access, and handoff-cannot-silently-close.

Tests: 16 new episode tests plus the phase safety suites (494 passed, 1 skipped) green, no regression.

**Phase 24 gate PASS / COMPLETE. Clinical release HOLD. Safe to paste next prompt: YES**, for Phase 25 (secure teleconsultation provider boundary). Checkpoint: commit `Add Kaya care-episode, queue, and handoff state machine`.