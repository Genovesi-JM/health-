"""Phase 19 fail-closed triage: empty/incomplete/invalid input can never produce
LOW, SELF_CARE, or a reassuring outcome; red flags dominate and are independent
of score/AI. Plus a contract check that the real engine guards empty input.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app import triage_safety as T

BACKEND = Path(__file__).resolve().parents[1]

SCHEMA = T.QuestionnaireSchema(version=3, questions=[
    T.QuestionSpec("age", "number", required=True, unit="years", minimum=0, maximum=120),
    T.QuestionSpec("fever", "bool", required=True),
    T.QuestionSpec("severity", "select", required=True, allowed=frozenset({"mild", "moderate", "severe"})),
])
GOOD = {"age": 30, "fever": False, "severity": "mild"}


# ── The P0: incomplete never reassuring ──────────────────────────────────────

def test_empty_is_incomplete_never_low():
    out = T.assess(SCHEMA, {}, 3)
    assert out == T.INCOMPLETE
    assert not T.is_reassuring(out)


def test_partial_is_incomplete():
    out = T.assess(SCHEMA, {"age": 30}, 3)   # missing fever, severity
    assert out == T.INCOMPLETE
    assert not T.is_reassuring(out)


def test_unknown_question_is_indeterminate():
    assert T.assess(SCHEMA, {**GOOD, "invented": 1}, 3) == T.INDETERMINATE


def test_invalid_unit_is_indeterminate():
    assert T.assess(SCHEMA, {**GOOD, "age": "thirty"}, 3) == T.INDETERMINATE


def test_out_of_range_is_indeterminate():
    assert T.assess(SCHEMA, {**GOOD, "age": 999}, 3) == T.INDETERMINATE


def test_invalid_select_value_is_indeterminate():
    assert T.assess(SCHEMA, {**GOOD, "severity": "extreme"}, 3) == T.INDETERMINATE


def test_stale_version_is_indeterminate():
    assert T.assess(SCHEMA, GOOD, 2) == T.INDETERMINATE


def test_complete_valid_is_assessable_not_reassuring_here():
    out = T.assess(SCHEMA, GOOD, 3)
    assert out == T.ASSESSABLE          # handed to validated scoring, not LOW/SELF_CARE here
    assert not T.is_reassuring(out)


# ── Red flags dominate, independent of score/AI ──────────────────────────────

def test_red_flag_overrides_even_complete_low():
    assert T.assess(SCHEMA, GOOD, 3, red_flag_answers={"chest_pain": True}) == T.URGENT


def test_red_flag_overrides_incomplete():
    assert T.assess(SCHEMA, {}, 3, red_flag_answers={"stroke_signs": True}) == T.URGENT


def test_missing_data_cannot_subtract_risk():
    # Even with everything else missing, a red flag stays URGENT.
    assert T.assess(SCHEMA, {"age": 30}, 3, red_flag_answers={"breathing_difficulty": True}) == T.URGENT


def test_red_flag_is_independent_of_score():
    assert T.has_red_flag({"chest_pain": True})
    assert not T.has_red_flag({"chest_pain": False})
    assert not T.has_red_flag({})


def test_reassuring_set():
    assert T.is_reassuring(T.LOW) and T.is_reassuring(T.SELF_CARE)
    for o in (T.INCOMPLETE, T.INDETERMINATE, T.URGENT, T.ASSESSABLE):
        assert not T.is_reassuring(o)


# ── Immutable completed snapshot ─────────────────────────────────────────────

def test_completed_snapshot_retains_versions():
    snap = T.CompletedTriage.of(3, 5, 2, GOOD, T.ASSESSABLE, ["none"], "2026-09-14T12:00:00Z")
    assert snap.schema_version == 3 and snap.rule_version == 5 and snap.content_version == 2
    assert snap.input_snapshot == tuple(sorted(GOOD.items()))
    # Frozen: cannot mutate.
    with pytest.raises(Exception):
        snap.outcome = T.LOW  # type: ignore[misc]


# ── Real-engine contract ─────────────────────────────────────────────────────

def test_real_engine_guards_empty_input():
    src = (BACKEND / "app/services/triage_engine.py").read_text(encoding="utf-8")
    assert "if not answers:" in src
    assert "TriageIncompleteError" in src
