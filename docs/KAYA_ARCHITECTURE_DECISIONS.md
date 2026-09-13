# Kaya architecture decisions

## Phase 0 default clinical launch hold

14 September 2026. Engineering decision only. The original API initializes databases and exposes clinical routes, so a middleware added after startup would not prevent database side effects.

The normal app.main entry constructs a separate hold application before clinical configuration imports. Every HTTP request returns 503 and no-store with general emergency guidance; WebSockets are denied. The original clinical factory remains AST-identical in app.synthetic_runtime, whose module checks the synthetic selector before clinical imports and exposes no eager ASGI app. This selector is for disposable tests and is not a security sandbox.

Docker and Python startup no longer run migrations, stamping or schema repair before the hold. Compose/Render force HOLD; checked-in Pages/Render autodeploy controls and manual deployment scripts are disabled. These are local source guarantees, not claims about already running remote systems. Startup migration removal is temporary; a later reviewed migration owner/job must replace it before release.

## Reproducible synthetic evidence

Phase 0 uses Python 3.12 with a complete hashed audit lock derived from existing backend requirements plus test tools, fresh source snapshots, explicit local test namespace, separate synthetic databases and a minimal environment. Network guard scope is documented; no OS sandbox is claimed. Reuse compares actual installed versions with the lock.

Repeated demo seed password hashing is cached only inside the disposable full-suite fixture. The first hash and all application authentication still use real bcrypt. This bounds repeated setup without changing clinical factory source; results do not validate startup performance or unique per-account seed salts. Original and current source use the same fixture and dependency lock. The full suite's pre-existing failures are recorded, not repaired as part of this baseline phase.

No clinical behavior, data schema, provider activation or live database has been approved by these decisions. A future release must replace the hold through reviewed code and independent evidence; reverting it merely to satisfy readiness probes is not an accepted recovery method.
