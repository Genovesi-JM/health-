# Phase 1 client boundary validation

The web/PWA and Expo entrypoints are informational in every profile. They render the canonical planning location, public availability notice and capability states. They do not import the preserved legacy apps, auth providers, navigation, API clients, native health providers or background registration. Selecting a synthetic profile or changing a feature flag cannot activate client operations in this phase.

## Final results

| Check | Result |
| --- | --- |
| Web tests | PASS: 38 tests in 7 files; exit 0; no failed or pending tests |
| Previously tracked web tests | All 17 pass, included in the final 38 |
| New Phase 1 tests | All 21 pass: route/session boundaries, canonical capability display, flag/profile bypass attempts, API/video/device egress refusal, web/native import graph, and active native/PWA metadata |
| Frontend TypeScript + Vite/PWA build | PASS; exit 0 |
| Lint for new informational code, wrappers and tests | PASS; zero errors and warnings |
| Expo TypeScript typecheck | PASS; exit 0 |
| Local web visual check | PASS at 1280 × 1000 and 390 × 844 viewports; no horizontal overflow or page errors |
| Visual check network attempts | Only loopback static resources; zero API, fetch/XHR or external-provider attempts |
| Source preservation | Original three untracked user tests unchanged; both prior App sources and prior native app.json preserved byte-for-byte |

The three pre-existing untracked frontend test files are deliberately excluded from this Phase 1 run. Phase 0 recorded 12 passes and three ambiguous-selector failures in those files. No user test was edited and no claim is made that those failures were fixed. Full repository lint was not repeated; the earlier baseline of 115 errors and 11 warnings remains separate from the zero-finding check of new code.

The first attempt collected 34 passing tests but failed to collect the new import-graph suite: Vite/jsdom rewrote its file-URL expression. Only that new test was corrected to run in the Node environment with npm working-directory resolution. The complete seven-file suite was then rerun successfully. `client-tests-initial.log` and `client-tests-initial.json` retain the diagnostic attempt; `client-tests.log` and `client-tests.json` contain the final passing run.

## Isolation and evidence

The reviewed source snapshot is `/Users/genovesimaria/Documents/Codex/2026-09-14/l/work/phase1-clients-review`; its web build is in `frontend/dist`. All tracked client sources and relevant new Phase 1 files were copied, with dotenv/config secrets, databases, logs, generated output and the three original untracked user tests excluded. `client-source-manifest.json` records all 199 source hashes, the excluded test hashes and dependency provenance. The final snapshot matches the repository sources.

Checks used Node `v25.6.1` and npm `11.18.0`, a clean environment, isolated HOME/TMPDIR, and the Phase 0 Node outbound-network denial preload. The exact fresh npm-ci dependency directories from Phase 0 were reused only after comparing their lockfile hashes with the current original locks. No package, lockfile or dependency version changed; no installation, audit or registry request was needed in Phase 1. No check timed out.

`client-summary.json` records exact commands, environment, timeouts, exit codes, durations and log hashes. Full logs and JSON reports are retained. `client-validation-harness.py`, `client-visual-harness.cjs`, and `client-no-network.cjs` preserve the harnesses used. `client-build-manifest.json` records the built static assets and their hashes; `client-digests.json` covers the retained client evidence.

The visual harness uses the already bundled Playwright and Chromium with fresh contexts. It serves only the isolated build from an ephemeral loopback HTTP server, disables service workers for the review context, aborts every non-loopback or fetch/XHR request, and directs Chromium's outbound proxy to a closed loopback port. Both screenshots show the `/health-/triage?profile=synthetic` path remaining informational. `client-visual.json` lists every observed request, viewport and layout measurement. The browser and local server were closed after capture.

Native verification is limited to TypeScript, the executable source import graph, and active Expo configuration assertions. No native binary, simulator, physical device, installed PWA, production deployment, real API or provider was exercised. The old native config is stored under the inactive `legacy-app.json` name; no dynamic Expo app.config exists to select it.
