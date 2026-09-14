"""Phase 35 supply-chain integrity: CI action pinning, dependency pinning,
hash-locked lockfile, fail-closed vuln gate with named risk acceptance, typosquat
sanity, plus static checks that the real lockfiles are pinned and the CI-action
pinning debt is inventoried.
"""
from __future__ import annotations

import pathlib

import pytest

from app import supply_chain as S


# ── CI action pinning ────────────────────────────────────────────────────────

def test_sha_pinned_action():
    assert S.action_ref_is_sha_pinned("actions/checkout@" + "a" * 40)
    assert not S.action_ref_is_sha_pinned("actions/checkout@v4")
    assert not S.action_ref_is_sha_pinned("actions/checkout@main")


def test_tag_pinned_detection():
    assert S.action_ref_is_tag_pinned("actions/setup-python@v5")
    assert not S.action_ref_is_tag_pinned("actions/checkout@" + "a" * 40)


# ── Dependency pinning ───────────────────────────────────────────────────────

def test_python_pinning():
    assert S.python_req_is_pinned("fastapi==0.110.0")
    assert not S.python_req_is_pinned("fastapi>=0.110")
    assert not S.python_req_is_pinned("fastapi")
    assert S.python_req_is_pinned("# a comment")


def test_hash_lock_detection():
    assert S.lockfile_is_hash_pinned(["fastapi==0.110.0 --hash=sha256:abc"])
    assert not S.lockfile_is_hash_pinned(["fastapi==0.110.0"])


# ── Vulnerability gate ───────────────────────────────────────────────────────

def test_low_moderate_do_not_block():
    assert not S.vuln_blocks_release(S.Advisory("x", "low", fix_available=False))
    assert not S.vuln_blocks_release(S.Advisory("x", "moderate", fix_available=True))


def test_high_critical_block_without_named_acceptance():
    assert S.vuln_blocks_release(S.Advisory("x", "high", fix_available=True))
    assert S.vuln_blocks_release(S.Advisory("x", "critical", fix_available=False))


def test_named_human_acceptance_unblocks_but_agent_cannot():
    assert not S.vuln_blocks_release(
        S.Advisory("x", "critical", fix_available=False, accepted_by="Security Lead"))
    assert S.vuln_blocks_release(
        S.Advisory("x", "critical", fix_available=False, accepted_by="agent"))


def test_any_release_blocker():
    advs = [S.Advisory("a", "low", True), S.Advisory("b", "high", True)]
    assert S.any_release_blocker(advs)


# ── Typosquat sanity ─────────────────────────────────────────────────────────

def test_typosquat_detection():
    known = frozenset({"requests", "fastapi", "sqlalchemy"})
    assert S.suspicious_package_name("reqeusts", known)   # transposition (edit dist ~1)
    assert S.suspicious_package_name("requsts", known)    # deletion
    assert not S.suspicious_package_name("requests", known)
    assert not S.suspicious_package_name("numpy", known)  # unrelated, not near a known


# ── Static checks against real repo ──────────────────────────────────────────

def _repo_root():
    return pathlib.Path(__file__).resolve().parents[2]


def test_backend_lock_is_hash_pinned():
    lock = _repo_root() / "backend" / "requirements.phase0.lock"
    assert lock.exists()
    lines = lock.read_text(encoding="utf-8", errors="ignore").splitlines()
    assert S.lockfile_is_hash_pinned(lines)


def test_client_lockfiles_present():
    assert (_repo_root() / "frontend" / "package-lock.json").exists()
    assert (_repo_root() / "mobile" / "package-lock.json").exists()


def test_ci_action_pinning_debt_inventoried():
    """CI actions are tag-pinned, not SHA-pinned; assert the doc records this debt
    so it is tracked (SHA-pinning is an owner action)."""
    ci = _repo_root() / ".github" / "workflows" / "ci.yml"
    doc = _repo_root() / "docs" / "KAYA_SUPPLY_CHAIN.md"
    assert doc.exists()
    if ci.exists():
        uses = [ln.split("uses:", 1)[1].strip()
                for ln in ci.read_text(encoding="utf-8", errors="ignore").splitlines()
                if "uses:" in ln]
        tag_pinned = [u for u in uses if S.action_ref_is_tag_pinned(u)]
        if tag_pinned:
            text = doc.read_text(encoding="utf-8", errors="ignore")
            assert "SHA-pin" in text or "SHA pin" in text or "sha-pin" in text.lower()
