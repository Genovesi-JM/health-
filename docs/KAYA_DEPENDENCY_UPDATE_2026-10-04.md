# Dependency and runtime update — 4 October 2026

This is local engineering evidence. Clinical release remains HOLD; no provider,
existing database, remote CI run or deployment was activated by this checkpoint.
Angola remains first and Portugal remains a prepared target market.

## Backend and web audit result

| Package graph | Before | After |
| --- | --- | --- |
| Backend validation lock | 77 packages; 6 affected, 39 advisory records | 66 packages; no known findings or skipped packages |
| Backend runtime graph | 71 packages; 4 affected, 35 advisory records | 58 packages; no known findings or skipped packages |
| Web production dependencies | 5 findings: 4 high, 1 moderate | 0 |
| Web including development dependencies | 16 findings: 1 critical, 9 high, 6 moderate | 0 |

The backend baseline runtime graph was freshly resolved from the previous deploy
inputs plus the two drivers that the old Dockerfile installed separately. The
validation baseline is the previous checked-in lock. Advisory records can repeat
across packages; neither these totals nor npm's affected-node counts represent
independently exploitable application vulnerabilities. These scans cover package
metadata, not the operating system or a built image. Mobile is a separate SDK
upgrade and is not included in the zero-finding result above.

FastAPI 0.134.0, Starlette 1.3.1, multipart 0.0.32 and urllib3 2.8.0 replace the
vulnerable backend versions. The sole application python-jose import was migrated
to PyJWT 2.15.1; unused jose/ecdsa/RSA dependency paths were removed. Token claims,
signatures, expiry, algorithm rejection, MFA challenge/enrollment restrictions
and the established missing-bearer response are covered by regression checks.
Pydantic 2.7.1 remains unchanged. Both Linux/Python 3.12 lockfiles carry SHA256
hashes, and every runtime package matches the version in the validation lock.
Docker, held Render configuration and CI install those locks with hash checking;
there is no separate floating driver install.

Web updates patch Axios and React Router and move Vitest to its supported patched
major. Vite remains 7.3.6. Transitive NanoID and PostCSS are patched through the
lockfile. No advisory was hidden by an ignore or risk-acceptance entry.

## Build inputs and evidence

Node is pinned to 24.21.0, shared by the web, mobile and packaging workflows.
The local runtime archive was verified against the official Node SHA256 manifest.
See [Node release status](https://nodejs.org/en/about/previous-releases).
Every external GitHub Action is pinned to a full commit SHA resolved from its
publisher's existing version tag; deployment remains disabled. The obsolete
Vitest minimum-worker argument was removed after executing the actual CI command.

The technical workflow runs backend tests in disposable source copies with an
allowlisted environment and Python network calls denied. It checks the audit
harness's recorded exit statuses explicitly, so a measured failure fails CI.
The PostgreSQL job creates and stops its own local cluster. Neither workflow edit
is evidence that a remote CI run occurred.

Raw before/after audits, CycloneDX runtime inventories, the lockfile/evidence hash
manifest and the local PostgreSQL report are in
[`evidence/dependencies-2026-10-04`](evidence/dependencies-2026-10-04/manifest.json).
The npm production inventory follows manifest dependency classification and can
include build tooling. It is not an inventory of JavaScript actually delivered
to a browser. Named release-owner review and artifact provenance remain open.

## Independent correctness fixes

An ongoing consultation started before its scheduled date now blocks capacity
from its actual start. Regression coverage includes publication, another patient
booking the same doctor, the same patient booking another doctor and a missing
legacy start timestamp.

Clinician agenda and clinical-summary routes now verify any signed or partially
signed note before returning clinical text. Corruption is rejected with a
conflict response. Truly unsigned historical notes remain restricted to the
existing clinician view; they are not newly published to patients.

## Validation at this checkpoint

- Expanded isolated backend run: 1,456 passed; five failures were investigated.
  Three were snapshot omissions (`git` metadata/tool and `.gitignore`), resolved
  by six read-only repository-hygiene checks against the real checkout.
  Two exposed forbidden cross-router imports. Specialty normalization and the
  reviewer decision transaction were extracted to shared services, preserving
  endpoint behavior; all 92 affected credential/booking/boundary checks passed.
- Full application portion: 585 passed. Security portion: 123 passed. The broader
  run also covered the governance and every existing phase test directory.
- Web dependency checkpoint: 216 tests passed using the actual bounded CI
  command on Node 24.21.0. Subsequent lint/lifecycle changes are a separate
  checkpoint and are not needed for these dependency results.
- PostgreSQL 18.1: 11 scenarios, including 40 forced races, passed and the private
  cluster stopped. Source hashes identify the tested snapshot in its report.
- Existing Python deprecation and web bundle-size warnings remain visible.

Docker Desktop could not reach a running engine during the image-build attempt,
so no container-build or operating-system scan result is claimed here. Package
lock audits and static Docker allowlist checks are recorded separately.
