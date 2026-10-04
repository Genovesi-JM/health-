"""Phase 5 reproducibility contract: pinned toolchain, and a CI workflow that
is least-privilege, secret-free, provider-disabled, bounded, and non-deploying.
Static checks over committed config — deterministic and offline.
"""
from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CI = (REPO / ".github/workflows/ci.yml").read_text(encoding="utf-8")


def test_version_pins_present():
    assert (REPO / ".python-version").read_text().strip() == "3.12"
    assert (REPO / ".nvmrc").read_text().strip() == "24.21.0"
    assert (REPO / "backend/requirements.phase0.lock").exists()


def test_ci_is_least_privilege():
    assert "permissions:" in CI and "contents: read" in CI
    # No write scope granted.
    for scope in ("contents: write", "packages: write", "id-token: write", "deployments: write"):
        assert scope not in CI, f"CI grants a write scope: {scope}"


def test_ci_uses_no_secrets():
    assert "secrets." not in CI, "CI must not reference repository secrets"


def test_ci_forces_synthetic_and_disables_providers():
    assert "KAYA_EXECUTION_MODE: synthetic" in CI
    assert "ENV: test" in CI
    for key in ("OPENAI_API_KEY", "STRIPE_SECRET_KEY", "SUMSUB_SECRET_KEY", "SMTP_HOST"):
        assert f'{key}: ""' in CI, f"CI must disable provider: {key}"


def test_ci_is_bounded_and_cancels():
    assert "timeout-minutes:" in CI
    assert "cancel-in-progress: true" in CI


def test_ci_does_not_deploy():
    lowered = CI.lower()
    # Look for real deployment mechanisms, not the word "deploy" in prose.
    for mech in ("uses: peaceiris/actions-gh-pages", "gh-pages", "az webapp", "azure/webapps",
                 "ssh ", "rsync", "kubectl", "render.com deploy", "appleboy/ssh"):
        assert mech not in lowered, f"CI must not deploy (found {mech!r})"
    assert "deploy:" not in lowered, "CI must not define a deploy job"


def test_ci_runs_phase_safety_suites():
    for suite in ("phase0_tests", "phase1_tests", "governance_tests", "phase3_tests", "phase4_tests", "phase5_tests"):
        assert suite in CI, f"CI must run {suite}"
    assert "gitleaks" in CI.lower(), "CI must run a secret scan"


def test_toolchain_doc_exists():
    assert (REPO / "docs/KAYA_TOOLCHAIN.md").exists()
