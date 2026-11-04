"""Supply-chain and dependency integrity (Phase 35). Domain-pure.

Dependencies and build inputs are pinned and provenance-checked, known-critical
vulnerabilities are not shipped without a named risk acceptance, and CI consumes
only pinned, trusted actions. This module holds the rules; running scanners and
accepting residual risk are owner-bound.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# ── CI action pinning ────────────────────────────────────────────────────────

_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def action_ref_is_sha_pinned(uses: str) -> bool:
    """A GitHub Action must be pinned to a full 40-char commit SHA, not a movable
    tag/branch (`@v4`, `@main`)."""
    if "@" not in uses:
        return False
    ref = uses.rsplit("@", 1)[1].strip()
    return bool(_SHA_RE.match(ref))


def action_ref_is_tag_pinned(uses: str) -> bool:
    if "@" not in uses:
        return False
    ref = uses.rsplit("@", 1)[1].strip()
    return bool(re.match(r"^v?\d", ref)) and not _SHA_RE.match(ref)


# ── Dependency pinning ───────────────────────────────────────────────────────

def python_req_is_pinned(spec: str) -> bool:
    """A Python requirement must pin an exact version (`==`), not a floor/range."""
    s = spec.strip()
    if not s or s.startswith("#"):
        return True                       # comment/blank is not an unpinned dep
    if any(op in s for op in (">=", "<=", "~=", ">", "<", "*")) and "==" not in s:
        return False
    return "==" in s


def lockfile_is_hash_pinned(sample_lines: list[str]) -> bool:
    """A pip lock should carry per-package hashes (`--hash=sha256:...`)."""
    return any("--hash=" in ln or "hash=" in ln for ln in sample_lines)


# ── Vulnerability gate (fail-closed) ─────────────────────────────────────────

_SEVERITY_RANK = {"low": 1, "moderate": 2, "medium": 2, "high": 3, "critical": 4}


@dataclass(frozen=True)
class Advisory:
    package: str
    severity: str
    fix_available: bool
    reachable: Optional[bool] = None       # None = unassessed
    accepted_by: Optional[str] = None      # named human risk acceptance


AGENT_IDENTITIES = {"agent", "engineering_preparer", "claude", "automation"}


def vuln_blocks_release(a: Advisory) -> bool:
    """A high/critical advisory blocks release unless it has a named human risk
    acceptance (the agent can never accept it). An unassessed advisory is treated
    as reachable (fail-closed)."""
    rank = _SEVERITY_RANK.get(a.severity.lower(), 4)
    if rank < 3:
        return False                       # low/moderate do not hard-block
    # high/critical:
    if a.accepted_by and a.accepted_by.strip().lower() not in AGENT_IDENTITIES:
        return False                       # a named human accepted the residual risk
    return True                            # otherwise blocks (fix or accept required)


def any_release_blocker(advisories: list[Advisory]) -> bool:
    return any(vuln_blocks_release(a) for a in advisories)


# ── Provenance / typosquat sanity ────────────────────────────────────────────

def suspicious_package_name(name: str, known_good: frozenset) -> bool:
    """Flag a near-miss of a known-good name (a classic typosquat), e.g.
    `reqeusts` vs `requests`."""
    n = name.lower()
    if n in known_good:
        return False
    for good in known_good:
        if n == good:
            continue
        if _edit_distance_le1(n, good):
            return True
    return False


def _edit_distance_le1(a: str, b: str) -> bool:
    """True when a and b are within Damerau-Levenshtein distance 1 (a single
    insertion, deletion, substitution, or one adjacent transposition)."""
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    return _damerau_le1(a, b, la, lb)


def _damerau_le1(a: str, b: str, la: int, lb: int) -> bool:
    if la == lb:
        # count substitutions; allow one, or one adjacent transposition
        diffs = [i for i in range(la) if a[i] != b[i]]
        if len(diffs) == 1:
            return True
        if len(diffs) == 2:
            i, j = diffs
            return j == i + 1 and a[i] == b[j] and a[j] == b[i]   # transposition
        return False
    # lengths differ by 1: one insertion/deletion → they must share a common
    # prefix and suffix covering all but the extra character.
    longer, shorter = (a, b) if la > lb else (b, a)
    i = 0
    while i < len(shorter) and shorter[i] == longer[i]:
        i += 1
    # skip the extra char in longer, the rest must match
    return shorter[i:] == longer[i + 1:]


REQUIRED_SUPPLY_CHAIN_CONTROLS = (
    "exact-pinned, hash-locked dependencies",
    "SHA-pinned CI actions",
    "no high/critical advisory without a named risk acceptance",
    "SBOM generated and stored",
    "least-privilege CI with no plaintext secrets",
)

SUPPLY_CHAIN_EVIDENCE_REQUIRED = (
    "sbom_artifact",
    "dependency_scan_triage_signed",
    "ci_action_sha_pinning",
    "provenance_attestation",
)
