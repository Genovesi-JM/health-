"""Phase 6 release-check contract: a verification entry point that classifies
each subsystem, and an owner-bound, expiring debt ledger that isolates the
known non-pilot failures without concealing them or covering the pilot gate,
security tests, or any P0.
"""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VERIFY = REPO / "scripts/kaya_verify.py"
LEDGER = REPO / "docs/KAYA_DEBT_EXCEPTIONS.md"


def test_verify_entry_point_exists_and_valid():
    assert VERIFY.exists()
    # Compiles (valid Python) and defines the five classification states.
    src = VERIFY.read_text(encoding="utf-8")
    compile(src, str(VERIFY), "exec")
    assert 'PASS, FAIL, SKIP, BLOCKED, NOT_RUN' in src


def test_verify_required_checks_cover_pilot_gate_and_security():
    src = VERIFY.read_text(encoding="utf-8")
    assert 'Check("backend-pilot-gate", True' in src
    assert 'Check("backend-security", True' in src
    # Legacy debt is isolated, not a required gate.
    assert 'Check("backend-legacy-debt", False' in src


def test_verify_never_deploys():
    text = VERIFY.read_text(encoding="utf-8").lower()
    for mech in ("ssh ", "rsync", "kubectl", "az webapp", "gh-pages"):
        assert mech not in text


def test_debt_ledger_exists_and_is_bounded():
    assert LEDGER.exists()
    text = LEDGER.read_text(encoding="utf-8")
    # An explicit review/expiry date exists and is in the future relative to
    # the recorded evidence date.
    dates = re.findall(r"20\d\d-\d\d-\d\d", text)
    assert dates, "ledger must carry a review/expiry date"
    assert any(date.fromisoformat(d) > date(2026, 9, 14) for d in dates)


def test_debt_ledger_does_not_cover_pilot_security_or_p0():
    text = LEDGER.read_text(encoding="utf-8")
    # No exception row may cover the security suite or a P0.
    table_rows = [ln for ln in text.splitlines() if ln.strip().startswith("| DBT-")]
    assert table_rows, "ledger must enumerate exceptions"
    for row in table_rows:
        assert "P0" not in row, f"debt exception must not cover a P0: {row}"
        assert "security_tests" not in row, f"debt exception must not cover security suite: {row}"
        # Every exception is non-reachable (held) — never a live pilot feature.
        assert "held" in row.lower(), f"debt exception must be non-reachable/held: {row}"


def test_baseline_matches_authoritative_evidence():
    text = LEDGER.read_text(encoding="utf-8")
    assert "62 failed" in text and "180 passed" in text, "ledger must cite the authoritative baseline"
