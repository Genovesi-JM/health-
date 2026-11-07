# Client Phase 0 clean-install baseline — 2026-09-14

Measurement is complete. The clean installations reproduce the earlier frontend test, lint, and dependency-audit failures. These results are the pre-existing baseline; they are not a release approval or a claim that those failures have been remediated.

| Check | Result |
| --- | --- |
| Frontend fresh `npm ci` | PASS; 573 packages installed; exit 0 |
| Mobile fresh `npm ci` | PASS; exit 0 |
| Frontend tracked tests | PASS; 17 tests in 4 files |
| Three existing untracked frontend test files | FAIL; 12 passed, 3 failed, 15 total; 1 file passed, 2 failed |
| Combined measured test total | 29 passed, 3 failed, 32 total across 7 files; obtained from two explicitly separate runs |
| Frontend build, including the existing untracked tests | PASS; TypeScript and Vite/PWA build completed |
| Frontend lint, including the existing untracked tests | FAIL; 115 errors and 11 warnings across 57 files; zero fatal errors |
| Mobile TypeScript typecheck | PASS |
| Frontend npm audit | FAIL; 15 vulnerable dependency entries: 6 moderate, 8 high, 1 critical |
| Mobile npm audit | FAIL; 42 vulnerable dependency entries: 25 moderate, 16 high, 1 critical |

The three preserved untracked frontend test files contain zero lint findings. The tracked frontend tests all pass. The failing additional tests are:

- `OnboardingShell blocks advancing when step validation fails`: the `/continuar|next/i` query matches multiple buttons.
- `OnboardingShell advances to the next step when the field is valid`: the same ambiguous query matches multiple buttons.
- `AdminExpiryPage shows an "expired" badge for negative days and a day-count otherwise`: `/expirado|expired/i` matches the synthetic `Dr. Expired` name and the expiry badge.

The reports establish selector ambiguities in those tests; they do not establish a corresponding product defect. Original tests and source were preserved without editing. `DocumentUpload` passes all six tests. Full failure messages and rendered DOM are in the user-test JSON and log. Vitest's JSON `num*TestSuites` counters include nested suites; file counts above are taken from `testResults` and the console file summary.

The critical frontend audit entry is `vitest`; the critical mobile entry is transitive `tar`. npm audit counts vulnerable dependency entries, including dependencies affected through other dependencies; they are not counts of distinct advisories or evidence of active exploitation. The audit logs include the advisory data, dependency relationships, and npm's proposed fixes. No dependency fixes or lifecycle-script approvals were performed.

## Reproducibility and isolation

The exact run used Node `v25.6.1` and npm `11.18.0` on the local Darwin arm64 host. `client-summary.json` records executable paths, host version, command arguments, working directories, timeouts, exit codes, durations, lock hashes, and log hashes. `client-source-manifest.json` records every copied source hash and whether the file was tracked or one of the existing user tests.

The sources were copied from the current working tree into `/Users/genovesimaria/Documents/Codex/2026-09-14/l/work/phase0-clients-clean`. Only tracked frontend/mobile files plus the three named pre-existing untracked tests were eligible. Dotenv files, project npm configuration, installed `node_modules`, caches, and generated output were excluded. Each client used its own newly empty npm cache, HOME, TMPDIR, and npm user/global configuration. No parent environment variables were inherited. Tests, build, lint and typecheck ran with a Node preload that denies outbound network connections; public registry access was allowed for `npm ci` and `npm audit`. No API, development server, browser, mobile simulator, or deployment was started.

`npm ci` emitted npm 11's default `allow-scripts` warnings for packages whose installation scripts are not approved, including esbuild/fsevents; the fresh installs, tests, build and typecheck still ran to completion. These warnings and package-deprecation warnings remain in full installation logs. The frontend build retains its existing large-chunk and outdated Browserslist-data warnings.

After checks completed, all copied original-source hashes still matched, both isolated lockfiles still matched the originals, and no dotenv file had been copied. No check timed out.

Original frontend lock SHA-256: `c6be000e1d224f47b90645a6653b9639a817c832335d7447953150d1b7c2e682`.

Original mobile lock SHA-256: `6b381456c0a0741e1e4a8709a133a3b1dc592edfd1ffda68dfbe420bab1371cf`.

The exact invocation, from the repository root, was:

```sh
python3 scripts/kaya_phase0_clients.py --work /Users/genovesimaria/Documents/Codex/2026-09-14/l/work/phase0-clients-clean --evidence /Users/genovesimaria/Documents/kaya-web/docs/evidence/phase0-completion-2026-09-14
```

For a repeat run, supply a new empty `--work` directory and an evidence directory without existing `client-*` files. The script deliberately refuses to reuse those results. It exits zero when the measurements are completed, even if measured application checks fail; inspect each recorded check exit code.

All full logs and JSON reports are retained as `client-*` files. `client-digests.json` records their SHA-256 hashes and byte sizes, excluding its own recursive hash. `client-harness.json` records the reusable harness hash and the offline-network preload content/hash.
