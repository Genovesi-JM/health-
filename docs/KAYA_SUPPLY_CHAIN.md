# Kaya supply-chain & dependency integrity (Phase 35)

Dependencies and build inputs are pinned and provenance-checked, known-critical
vulnerabilities are not shipped without a named risk acceptance, and CI consumes
only pinned actions. `backend/app/supply_chain.py` (domain-pure) holds the rules;
static checks assert the real lockfiles are pinned and inventory the CI-action
debt.

## Invariants enforced (policy)

- **CI action pinning.** `action_ref_is_sha_pinned` requires a full 40-char commit
  SHA (`@<sha>`), not a movable `@v4`/`@main`. `action_ref_is_tag_pinned` detects
  the weaker tag pinning.
- **Dependency pinning.** `python_req_is_pinned` requires an exact `==`;
  `lockfile_is_hash_pinned` requires per-package hashes.
- **Vulnerability gate (fail-closed).** `vuln_blocks_release` blocks a high/critical
  advisory unless a **named human** accepted the residual risk — the agent
  (`engineering_preparer`/automation) can never accept it. Low/moderate do not
  hard-block. An unassessed advisory is treated as reachable.
- **Typosquat sanity.** `suspicious_package_name` flags an edit-distance-1 near-miss
  of a known-good name.

## Confirmed in source (static checks)

- **Backend lock hash-pinned.** `backend/requirements.phase0.lock` carries
  per-package hashes.
- **Client lockfiles present.** `frontend/package-lock.json` and
  `mobile/package-lock.json` exist (installed with `npm ci`).

## Owner-bound debt

- **SHA-pin CI actions.** `.github/workflows/ci.yml` currently tag-pins its
  actions (`actions/checkout@v4`, `actions/setup-python@v5`,
  `actions/upload-artifact@v4`, `gitleaks/gitleaks-action@v2`). Tags are movable;
  a named security/CI owner should **SHA-pin** these to immutable commits. Tracked
  here, not changed in this phase.
- **Advisory triage (from Phase 0).** The Phase 0 audit reported open advisories
  (frontend: 1 critical / 8 high / 6 moderate; mobile: 1 critical / 16 high / 25
  moderate; backend locked audit: 35 advisory entries across 4 packages). Each
  high/critical must be patched or carry a **named** risk acceptance before
  release — `vuln_blocks_release` encodes that gate; the triage itself is owner
  work.

## Human intervention / external gates (owner-bound)

- **SBOM.** Generate and store a Software Bill of Materials as release evidence.
- **Dependency-scan triage signed** by a named security owner (patch or accept
  every high/critical).
- **CI action SHA-pinning** and provenance attestation.
- No dependencies were upgraded or removed here; Phase 0 advisory counts stand as
  the baseline. Clinical release HOLD.
