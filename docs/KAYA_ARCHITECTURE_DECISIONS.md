# Kaya architecture decisions

## Coded application and two market preparation

4 October 2026. The user selected Angola and Portugal, prioritising Angola, and agreed to proceed with the recommended React Native/Expo approach after clarifying standalone delivery. Continue React/TypeScript web/PWA, React Native/Expo mobile and the shared FastAPI backend in `health-`. Patients install Kaya; Expo Go is not a customer dependency. The responsive web/PWA is the first delivery target while the mobile app is completed against the same backend contracts. FlutterFlow remains a design/prototype reference. See the [current product and launch plan](../PRODUCT_AND_LAUNCH_PLAN.md#launch-market-and-delivery-decision) for rationale and work order.

Prepare explicit AO/PT market configuration, localised copy and formatting, clinic timezones, provider eligibility, consent versions and access boundaries. Maintain a shared codebase while allowing separate storage or deployments according to the reviewed operating model. Cross-border care is a separate capability. Payments remain in the final implementation phase, with currency and price modelling prepared earlier.

This is the current product and delivery decision. It supersedes the earlier single-market product assumption, while the historical Phase 0/1 implementation and release restrictions below remain in effect until reconciled through implementation. Adding a target market to the plan does not itself activate care routes, change a live deployment or certify launch readiness.

## Phase 0 default clinical launch hold

14 September 2026. Engineering decision only. The original API initializes databases and exposes clinical routes, so a middleware added after startup would not prevent database side effects.

The normal app.main entry constructs a separate hold application before clinical configuration imports. Every HTTP request returns 503 and no-store with general emergency guidance; WebSockets are denied. The original clinical factory remains AST-identical in app.synthetic_runtime, whose module checks the synthetic selector before clinical imports and exposes no eager ASGI app. This selector is for disposable tests and is not a security sandbox.

Docker and Python startup no longer run migrations, stamping or schema repair before the hold. Compose/Render force HOLD; checked-in Pages/Render autodeploy controls and manual deployment scripts are disabled. These are local source guarantees, not claims about already running remote systems. Startup migration removal is temporary; a later reviewed migration owner/job must replace it before release.

## Reproducible synthetic evidence

Phase 0 uses Python 3.12 with a complete hashed audit lock derived from existing backend requirements plus test tools, fresh source snapshots, explicit local test namespace, separate synthetic databases and a minimal environment. Network guard scope is documented; no OS sandbox is claimed. Reuse compares actual installed versions with the lock.

Repeated demo seed password hashing is cached only inside the disposable full-suite fixture. The first hash and all application authentication still use real bcrypt. This bounds repeated setup without changing clinical factory source; results do not validate startup performance or unique per-account seed salts. Original and current source use the same fixture and dependency lock. The full suite's pre-existing failures are recorded, not repaired as part of this baseline phase.

No clinical behavior, data schema, provider activation or live database has been approved by these decisions. A future release must replace the hold through reviewed code and independent evidence; reverting it merely to satisfy readiness probes is not an accepted recovery method.

## Phase 1 explicit planning policy and informational perimeter

14 September 2026. The user selected “Angola — Luanda” for planning. Formal signed jurisdiction adoption remains BLOCKED_EXTERNAL and clinical/legal/privacy/operating approvals remain OPEN. The [jurisdiction record](KAYA_JURISDICTION_DECISION.md) and [draft pilot scope](KAYA_PILOT_SCOPE.md) separate that choice from authorization. Capacity, hours, dates, staffing and metric thresholds are hypotheses awaiting named reviewers.

The canonical machine-readable authority is [policy/kaya_phase1_policy.json](../policy/kaya_phase1_policy.json). Web, mobile and backend consume generated copies at `frontend/src/config/kayaPolicy.json`, `mobile/src/config/kayaPolicy.json` and `backend/app/kaya_policy.json`; the [capability matrix](KAYA_CAPABILITY_MATRIX.md) is a generated human-readable view. These artifacts must express identical capability states, route/copy/flag bindings, geography, exclusions and default-off behavior. A mismatch, malformed/unknown state or unsupported jurisdiction fails closed. Language, currency, IP address and Azure region cannot choose or expand a jurisdiction.

The Phase 1 client boundary is informational for every web/mobile route. Legacy application trees remain preserved and unmounted so their clinical, provider, payment, device or messaging behavior is not activated by rendering the new entry point. Preserved source is not thereby declared safe or deleted. The backend permits only the new `GET /api/v1/public/pilot-scope` public metadata response; clinical HTTP paths retain the default 503 hold and no-store behavior, and the default runtime still avoids clinical/database startup. Metadata exposes planning scope and disabled states, never credentials, individual records, an invitation, or an approval mechanism.

The capability state vocabulary is `NOT_BUILT`, `MOCK`, `SYNTHETIC_ONLY`, `DISABLED_PENDING_GATE`, `PILOT`, and `LIVE`. State labels describe implementation/authorization evidence; setting a label or feature flag cannot create missing human approval or enable a clinical release. Unknown jurisdictions can access information only. Clinical signup, triage, booking, AI, video, prescribing, payments, Response, marketplace, external messaging and device ingestion remain unavailable to real users. Synthetic evaluators run only inside the separate reviewed test boundary.

The proposed workflow coordinates one invited adult's routine appointment at one Luanda clinic, with human confirmation and administrative closure. It excludes clinical care delivery and the broader product catalogue. Policy metrics cover safety, failed approved escalation, privacy, booking integrity, credentials, staffing, queue/support capacity and comprehension; missing evidence produces INDETERMINATE/HOLD rather than a passing result. Human comprehension and clinical/operational adequacy cannot be established with generated respondents or synthetic checks.

This is a design and evidence-separation decision. [Execution status](KAYA_EXECUTION_STATUS.md) owns final implementation checks and any Phase 1 completion verdict; this record does not claim the phase passed. No new data store, migration, live processor, public deployment or user communication is authorized. Existing remote systems and old distributed clients remain outside local source proof. Recovery preserves the hold; enabling the legacy application, broadening the scope or bypassing the policy requires reviewed changes and the relevant independent gates.
