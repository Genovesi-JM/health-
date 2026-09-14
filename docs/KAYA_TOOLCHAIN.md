# Kaya toolchain and reproducible checks (Phase 5)

Evidence date 14 September 2026. Every later result must be reproducible from a
clean checkout without relying on a developer machine, inherited shell
environment, or a live service.

## Pinned tool versions

| Tool | Pinned version | Pin source | Upgrade owner |
| --- | --- | --- | --- |
| Python | 3.12 | [`.python-version`](../.python-version), CI `python-version-file` | Backend lead |
| Backend deps | hash-locked | [`backend/requirements.phase0.lock`](../backend/requirements.phase0.lock) (audit env) + `backend/requirements.txt` | Backend lead |
| Node.js | 20 (LTS) | [`.nvmrc`](../.nvmrc) | Frontend/mobile lead |
| npm | bundled with Node 20 | lockfiles (`package-lock.json`) | Frontend/mobile lead |
| Expo / React Native | as in `mobile/package.json` + `package-lock.json` | mobile lockfile | Mobile lead |
| PostgreSQL | 16 (supported target) | infra / migration phases | Database lead |
| Redis | 7 (if enabled) | infra | Backend lead |
| Container base | pinned in Dockerfiles | Dockerfiles | Infra lead |
| Bicep | Azure CLI pinned in infra CI | infra | Infra lead |

Upgrades are deliberate: bump the pin, run the full bounded suite, and record the
change. Do not silently broaden a dependency range to make a check pass.

## Deterministic install

- Backend: `pip install -r backend/requirements.txt` (audit reruns use
  `requirements.phase0.lock` with hashes enforced).
- Frontend: `npm ci` in `frontend/` (uses the committed lockfile; never `npm i`
  in CI).
- Mobile: `npm ci` in `mobile/`.

## Bounded test commands and timeouts

Tests force synthetic/test mode and disabled providers regardless of the
operator's shell (CI sets `ENV=test`, `KAYA_EXECUTION_MODE=synthetic`, and empty
provider keys; the backend harness also clears inherited configuration and denies
Python network calls before app import — see Phase 0 evidence).

| Suite | Command (cwd `backend/` unless noted) | Timeout |
| --- | --- | --- |
| Phase safety (gate) | `pytest phase0_tests phase1_tests governance_tests phase3_tests phase4_tests phase5_tests -q` | 10 min |
| Focused security | `pytest security_tests -q` | 10 min |
| Full legacy suite | `pytest tests -q` (has known pre-existing failures) | 15 min |
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
