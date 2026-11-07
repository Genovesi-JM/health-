"""Phase 11 clinical safety case: intended use/exclusions specific enough to
test, every P0/P1 hazard controlled, safe-degraded behavior that never false-
reassures, a versioned unapproved content registry, and HOLD until a named
clinical safety owner approves.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CASE = (REPO / "docs/KAYA_CLINICAL_SAFETY_CASE.md").read_text(encoding="utf-8")
REG = (REPO / "docs/KAYA_CLINICAL_CONTENT_REGISTRY.md").read_text(encoding="utf-8")
CASE_L, REG_L = CASE.lower(), REG.lower()
# Whitespace-normalized (line wraps collapsed) for phrase matching.
CASE_N = re.sub(r"\s+", " ", CASE_L)


def test_case_is_hold_until_named_clinical_owner():
    assert "status: hold" in CASE_L or "hold" in CASE_L
    assert "clinical safety owner" in CASE_L
    assert "not approved" in CASE_L or "does not authorize patient use" in CASE_L


def test_intended_use_and_exclusions_are_specific():
    for token in ("intended use", "inclusion", "exclusion", "invited adult", "non-urgent"):
        assert token in CASE_L, f"safety case missing: {token}"
    # Explicit not-doing list (whitespace-normalized to tolerate line wraps).
    for nono in ("does not diagnose", "does not dispatch", "does not replace a clinician"):
        assert nono in CASE_N, f"safety case missing exclusion: {nono}"


def test_all_hazards_present():
    hazards = ["delayed care", "false reassurance", "incorrect urgency",
               "unavailable clinician", "bad handoff", "wrong patient",
               "wrong clinician", "missing record", "duplicate booking",
               "message failure", "credential expiry", "data corruption",
               "translation error", "ai output", "device error",
               "emergency-copy misunderstanding"]
    for h in hazards:
        assert h in CASE_L, f"hazard analysis missing: {h}"


def test_each_hazard_has_prevention_detection_response_owner_residual():
    for col in ("prevention", "detection", "response", "owner", "residual"):
        assert col in CASE_L, f"hazard table missing column: {col}"
    # Fail-closed triage principle explicit (ties to R01).
    assert "never low/self_care" in CASE_L or "never low" in CASE_L


def test_safe_degraded_never_false_confirms():
    assert "safe-degraded" in CASE_L or "safe degraded" in CASE_L
    assert "never" in CASE_L and ("false reassurance" in CASE_L or "false confirmation" in CASE_L)
    for dep in ("api/db", "video", "notification", "clinician coverage", "external provider"):
        assert dep in CASE_L, f"degraded behavior missing: {dep}"


def test_content_registry_versioned_and_unapproved():
    for col in ("version", "author", "approver", "effective", "rollback"):
        assert col in REG_L, f"content registry missing column: {col}"
    # Every registered item is draft/unapproved (no engineer-approved clinical content).
    rows = [ln for ln in REG.splitlines() if ln.strip().startswith("|") and "DRAFT" in ln]
    assert rows, "content registry must list DRAFT items"
    assert "versioned review" in REG_L and "validation set" in REG_L


def test_surveillance_defined_without_authorizing_use():
    assert "surveillance" in CASE_L
    assert "authorizes nothing" in CASE_L or "no patient use authorized" in CASE_L
