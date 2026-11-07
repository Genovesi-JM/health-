# Phase 0 source-secret scan review

Completed on 14 September 2026 (Europe/Madrid). This is local engineering evidence, not clinical release approval or proof that no secret exists anywhere.

## Result and scope

The final recorded run in `gitleaks-scan.json` completed successfully with **zero findings in 497 current source and generated evidence files** and **zero findings across 403 historical source paths in all 204 locally reachable commits**. The repository is not shallow. The source snapshot includes tracked dotenv configuration, nonignored untracked source, and all retained files in the known Phase 0 completion evidence directory, including 26 otherwise gitignored synthetic check logs. Its aggregate SHA-256 manifest is recorded in the JSON. Source edits after that snapshot require a fresh scan; the scan report and final digest/index bookkeeping necessarily follow the measured snapshot.

The scanner uses all 222 rules in the pinned upstream default Gitleaks 8.30.1 configuration, including generic entropy-based detection, with recursive decoding depth 5. Default built-in allowlists remain active. Repository `.gitleaksignore` and inline `gitleaks:allow` comments do not suppress findings in this run. Historical patches include all local refs, full history, and merge-parent diffs, with external diff and text conversion disabled. Literal source path selection happens before Git reads patch content.

Tracked `.env.production` and `frontend/.env.production` were scanned locally with complete redaction, along with configuration examples; their values were never emitted or modified. `backend/email_log.txt` and eight PNG assets were excluded from both source/history scope. Ignored or local untracked dotenv stores, databases, health logs, generated directories outside the explicit completion-evidence scope, data stores, binaries, archives, external submodules, Git LFS content, remote-only refs, and unreachable/reflog-only commits are outside scope. No database or health-log content was read. No fetch, provider credential validation, application import, deployment, or secret-file change occurred.

## Earlier pattern finding

The limited five-pattern scan flagged `backend/ENV_CONFIG_GUIDE.md:196`. Local programmatic inspection confirmed it lies under the explicit example heading at line 172 and that the credential-shaped suffix consists entirely of one repeated character. This is a documentation placeholder, not evidence of a live AWS key. The value was not quoted, persisted in new evidence, sent to a provider, or changed. Gitleaks reports no finding at this location. This finding is closed as a reviewed placeholder; no live-credential conclusion is inferred from provider testing.

## Tool provenance and command

Gitleaks was downloaded from the [official v8.30.1 release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1). The Darwin ARM64 archive SHA-256 was checked against the digest published with the official release before extracting the executable:

`b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5`

The pinned [upstream default configuration](https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml) has SHA-256:

`e163e53b9e7e8a8511e77271e2b323ed057759542a6d988258afe3a1fa329caf`

The binary and config are in task scratch, not application dependencies. From the repository root:

```sh
python3 scripts/kaya_phase0_gitleaks.py \
  --gitleaks /Users/genovesimaria/Documents/Codex/2026-09-14/l/work/gitleaks-8.30.1/gitleaks \
  --config /Users/genovesimaria/Documents/Codex/2026-09-14/l/work/gitleaks-8.30.1/default-gitleaks.toml \
  --scratch /Users/genovesimaria/Documents/Codex/2026-09-14/l/work \
  --output docs/evidence/phase0-completion-2026-09-14/gitleaks-scan.json \
  --timeout 180
```

Each scanner invocation is bounded by a 180-second tool timeout and a 190-second process-group timeout. The wrapper runs with a minimal environment and emits only scan metadata and finding locations/rules; raw stdout/stderr and matched values are not copied to evidence. Temporary source copies and redacted intermediate reports are removed after processing. The completed source/history runs returned exit code 0 with no stderr.

## Wrapper verification

`gitleaks-wrapper-verification.json` records six passed checks using an isolated, temporary synthetic Git repository: detection of untracked source, detection of a removed historical token, detection in tracked dotenv source/history, ignoring inline allow comments, exclusion of local dotenv/log/database files, and absence of the synthetic credential value in evidence/stdout/stderr. The fixture produced two current-source and two historical findings, then was deleted. No real credential was used.

There is no remaining secret-scan blocker within the defined local source scope. Operational credential storage, remote history completeness, and launch authorization remain separate concerns.

## Retained evidence review

The first scan after importing backend evidence found 49 generic-key shapes and two JWT shapes. All 49 generic findings were verified SHA-256 digests of actual source/evidence files. All 728 source entries across the four backend manifests were also verified against their actual isolated snapshots or recorded Git revision before converting the digest maps losslessly to separate path/sha256 records. Future backend manifest emission uses the same structure. No hash was removed, changed, or globally allowlisted.

The two JWT shapes were public README examples in PyJWT and python-jose package descriptions inside the pip install report. The retained report now projects all 77 package names, versions, request flags, exact public artifact URLs and archive hashes, omitting package presentation descriptions. Unchanged raw reports/manifests remain only in scratch. `evidence-sanitation.json` links their raw and retained SHA-256 digests, verified original finding locations, and projection details. Runtime and test behavior are unchanged. The final expanded scan includes generated check logs and returns zero findings in both source and history; no scanner rule or built-in allowlist was changed.
