# Kaya supply-chain & dependency integrity (Phase 35)

Dependencies and build inputs are pinned and provenance-checked, known-critical
vulnerabilities are not shipped without a named risk acceptance, and CI consumes
only pinned actions. `backend/app/supply_chain.py` (domain-pure) holds the rules;
static checks assert the real lockfiles and every external CI action are pinned.

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

- **Backend lock hash-pinned.** `backend/requirements.phase0.lock` and
  `backend/requirements.deploy.lock` carry per-package hashes. Every runtime
  version is also present in the tested lock.
- **Client lockfiles present.** `frontend/package-lock.json` and
  `mobile/package-lock.json` exist (installed with `npm ci`).

## Owner-bound debt

- **CI action provenance review.** The October 2026 update SHA-pins every action
  in the safety, technical and frontend packaging workflows. Hashes were resolved
  from the publishers' existing major-version tags using `git ls-remote`, using
  the peeled commit for annotated tags. An offline regression rejects movable
  references in any workflow. Named release-owner provenance review remains open.
- **Advisory triage (4 October 2026).** Backend validation/runtime package
  audits and both web dependency audits have no known findings. SDK57 mobile
  retains16 high affected nodes tracing to two unpatched tooling advisories
  (braces and node-forge). No residual risk was accepted. Exact counts, graph
  scope and raw evidence are recorded in the
  [backend/web dependency update](KAYA_DEPENDENCY_UPDATE_2026-10-04.md) and
  [native build record](KAYA_NATIVE_BUILD_2026-10-04.md).

## Human intervention / external gates (owner-bound)

- **SBOM review.** Backend runtime, web production and full/production mobile
  CycloneDX inventories are stored with dated hash manifests. Named review and
  provenance for an exact release artifact remain outstanding.
- **Dependency-scan triage signed** by a named security owner (patch or accept
  every high/critical).
- **CI provenance attestation** for the exact release artifact.
- The earlier Phase0 counts remain historical evidence, not current scan
  results. Clinical release remains HOLD.
