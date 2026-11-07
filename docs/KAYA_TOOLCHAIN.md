# Kaya toolchain and reproducible checks (Phase 5)

Evidence date 14 September 2026. Every later result must be reproducible from a
clean checkout without relying on a developer machine, inherited shell
environment, or a live service.

## Pinned tool versions

| Tool | Pinned version | Pin source | Upgrade owner |
| --- | --- | --- | --- |
| Python | 3.12 | [`.python-version`](../.python-version), CI `python-version-file` | Backend lead |
| Backend validation deps | hash-locked, Python 3.12 / Linux target | [`backend/requirements.phase0.lock`](../backend/requirements.phase0.lock), shared by test CI and audits | Backend lead |
| Backend runtime deps | hash-locked, Python 3.12 / Linux target | [`backend/requirements.deploy.lock`](../backend/requirements.deploy.lock), shared by Docker and the held Render definition | Backend lead |
| Node.js | 24.21.0 (LTS) | [`.nvmrc`](../.nvmrc), shared by client CI jobs | Frontend/mobile lead |
| npm | bundled with Node 24.21.0 | lockfiles (`package-lock.json`) | Frontend/mobile lead |
| Expo / React Native | as in `mobile/package.json` + `package-lock.json` | mobile lockfile | Mobile lead |
| PostgreSQL | 16 (supported target) | infra / migration phases | Database lead |
| Redis | 7 (if enabled) | infra | Backend lead |
| Container base | pinned in Dockerfiles | Dockerfiles | Infra lead |
| Bicep | Azure CLI pinned in infra CI | infra | Infra lead |

Upgrades are deliberate: bump the pin, run the full bounded suite, and record the
change. Do not silently broaden a dependency range to make a check pass.

## Deterministic install

- Backend validation: `python -m pip install --require-hashes -r backend/requirements.phase0.lock`.
- Backend runtime: `python -m pip install --require-hashes -r backend/requirements.deploy.lock`.
  Database and Redis drivers are included in this lock, with the same versions as
  the validation lock. Neither install resolves floating versions.
- Frontend: `npm ci` in `frontend/` (uses the committed lockfile; never `npm i`
  in CI).
- Mobile: `npm ci` in `mobile/`.

The `.txt` files remain editable dependency inputs. Regenerate the validation
lock with uv 0.12.23, then constrain the runtime lock to that tested graph (run
from the repository root):

```sh
uv pip compile backend/requirements.phase0.in --python-version 3.12 --python-platform linux --generate-hashes --output-file backend/requirements.phase0.lock --index-url https://pypi.org/simple
uv pip compile backend/requirements.deploy.txt --constraints backend/requirements.phase0.lock --python-version 3.12 --python-platform linux --generate-hashes --output-file backend/requirements.deploy.lock --index-url https://pypi.org/simple
```

The Linux target includes platform-specific runtime requirements that a lock
resolved solely on an Apple Silicon developer machine can omit. After changing
the graph, audit both locks with pip-audit and rerun the bounded regressions.

## Bounded test commands and timeouts

Tests force synthetic/test mode and disabled providers regardless of the
operator's shell (CI sets `ENV=test`, `KAYA_EXECUTION_MODE=synthetic`, and empty
provider keys; the backend harness also clears inherited configuration and denies
Python network calls before app import — see Phase 0 evidence).

| Suite | Command (cwd `backend/` unless noted) | Timeout |
| --- | --- | --- |
| Phase safety (gate) | `pytest phase0_tests phase1_tests governance_tests phase3_tests phase4_tests phase5_tests -q` | 10 min |
| Focused security | `pytest security_tests -q` | 10 min |
| Full application suite | `pytest tests -q` (551 passed at the notification checkpoint) | 15 min |
| Copy contract | `pytest phase3_tests -q` | 5 min |
| Frontend | `npm ci && npm test` (cwd `frontend/`) | 15 min |
| Frontend build | `npm ci && npm run build` (cwd `frontend/`) | 15 min |
| Mobile typecheck | `npm ci && npm run typecheck` (cwd `mobile/`) | 15 min |

Every potentially-hanging suite runs under `timeout` (CI) with `--junitxml`
artifacts retained for diagnosis.

## CI isolation guarantees

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

- `permissions: contents: read` (least privilege); `cancel-in-progress: true`.
- References **no secrets**; forces `ENV=test`, `KAYA_EXECUTION_MODE=synthetic`,
  and **empty provider keys**, so it cannot contact a live provider, charge
  money, send real mail, or use production data.
- Bounded `timeout-minutes` per job; uploads test-result artifacts.
- Runs the phase-safety suites and a Gitleaks secret scan (no allowlist bypass).
- Performs no deploy. Deployment stays disabled and human-gated.

Findings (dependency, secret, artifact) are surfaced, not silenced: a green run
cannot be produced by an undocumented ignore.

## October 2026 build alignment

Node 20 was superseded by Node 24.21.0, matching the maintained LTS line and the
minimum requirements of current mobile tooling. The local validation runtime was
downloaded from the official Node distribution and checked against its published
SHA256 manifest. The frontend, mobile and frontend packaging workflows now read
the same `.nvmrc`; no workflow uses a separate Node major.

All external GitHub Actions in the three workflows are pinned to full commit
hashes resolved from their publishers' existing version tags. The release job
remains disabled. `technical-checks.yml` also runs the disposable PostgreSQL
coordination harness and retains its synthetic report. Local execution is
recorded separately from remote CI; editing the workflow does not claim it ran.

The backend technical-check job uses `kaya_phase0_backend.py` to create an
allowlisted source snapshot, a fresh environment installed from the hashed lock,
and synthetic databases. The pytest wrapper denies Python TCP, UDP and DNS calls
before application imports. CI explicitly fails on a failed or incomplete
measurement report and retains it; the underlying audit harness records results
without itself treating every test failure as a process error. This is Python
network isolation, not an OS sandbox or a claim about subprocess networking.
