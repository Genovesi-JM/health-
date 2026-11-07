"""Phase 4 repository hygiene: no tracked runtime logs / local PHI stores /
secrets, no GeoVision misconfiguration default, and a documented .gitignore.
Runs `git ls-files` against the working tree; synthetic and read-only.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def _tracked() -> list[str]:
    out = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True)
    return out.stdout.splitlines()


# Deliberately-retained tracked files that match a risky pattern but are safe:
# committed Phase 0 evidence logs, and env *templates* with only placeholders.
_ALLOW = re.compile(r"^(docs/evidence/.*\.log|.*\.example|\.env\.production)$")

_RISKY = re.compile(r"(email_log\.txt|\.sqlite3?$|\.db$|/uploads/|\.pem$|\.key$|(^|/)\.env$|(^|/)\.env\.local$)")


def test_no_tracked_runtime_log_db_or_secret():
    hits = [f for f in _tracked() if _RISKY.search(f) and not _ALLOW.match(f)]
    assert not hits, "Tracked runtime log / local store / secret:\n" + "\n".join(hits)


def test_email_log_not_tracked():
    assert "backend/email_log.txt" not in _tracked(), "Runtime email log must not be tracked"


def test_env_templates_have_no_real_secrets():
    """Tracked env templates must not carry a real (long, high-entropy) secret.

    The authoritative secret scan is the Phase 0 Gitleaks run (222 rules, zero
    findings). This is a light guard against an obviously-real key value being
    committed to a template: example placeholders are short/structured, whereas
    live provider keys are long and high-entropy. It intentionally does not
    re-implement secret detection.
    """
    leaked = []
    for name in (".env.production", "backend/.env.example"):
        p = REPO / name
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "=" not in line or line.lstrip().startswith("#"):
                continue
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            # A real live key is long and high-entropy; placeholders are not.
            if len(val) >= 60 and len(set(val)) >= 25:
                leaked.append(f"{name}: {key.strip()}=<{len(val)} chars>")
    assert not leaked, "Tracked env template may contain a real secret:\n" + "\n".join(leaked)


def test_no_geovision_default_in_deploy():
    dep = REPO / ".github/workflows/deploy.yml"
    if dep.exists():
        text = dep.read_text(encoding="utf-8")
        assert "geovisionops.com" not in text, "deploy config must not default to a GeoVision domain"


def test_gitignore_covers_key_patterns():
    gi = (REPO / ".gitignore").read_text(encoding="utf-8")
    for pat in ("*.log", "*.db", "backend/uploads/", "coverage/", "backend/email_log.txt", ".env"):
        assert pat in gi, f".gitignore missing pattern: {pat}"


def test_architecture_index_exists():
    assert (REPO / "docs/KAYA_ARCHITECTURE_INDEX.md").exists()
    assert (REPO / "PRODUCT_AND_LAUNCH_PLAN.md").exists()
