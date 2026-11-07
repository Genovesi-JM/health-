"""Fail-closed triage input gate (Phase 19). Domain-pure.

Clinical uncertainty fails closed: an empty, partial, duplicate, contradictory,
invalid, stale-version, or client-invented answer set can NEVER produce LOW,
SELF_CARE, completed, or a reassuring message — it yields INCOMPLETE or
INDETERMINATE. Deterministic red-flag evaluation is independent of scoring and
AI; red flags override all lower outcomes and missing data can never subtract
risk. This gate runs before any clinical rule set is applied.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

# Non-reassuring safety outcomes.
URGENT = "URGENT"
INCOMPLETE = "INCOMPLETE"
INDETERMINATE = "INDETERMINATE"
# Reassuring / assessable outcomes — only ever produced from a complete, valid,
# non-red-flag set by the validated rule set (Phase 20).
ASSESSABLE = "ASSESSABLE"        # gate passed; hand to validated scoring
LOW = "LOW"
SELF_CARE = "SELF_CARE"

REASSURING = frozenset({LOW, SELF_CARE, "COMPLETED", "MEDIUM_OK"})
NON_REASSURING = frozenset({URGENT, INCOMPLETE, INDETERMINATE})


class TriageIncompleteError(ValueError):
    """Raised when triage input is empty/incomplete — never return a low outcome."""


@dataclass
class QuestionSpec:
    qid: str
    qtype: str                       # bool | number | select
    required: bool = True
    allowed: Optional[frozenset] = None
    unit: Optional[str] = None
    minimum: Optional[float] = None
    maximum: Optional[float] = None


@dataclass
class QuestionnaireSchema:
    version: int
    questions: list[QuestionSpec]
    locales: frozenset = field(default_factory=lambda: frozenset({"pt", "en", "fr", "es"}))


def is_reassuring(outcome: str) -> bool:
    return outcome in REASSURING


def has_red_flag(red_flag_answers: dict) -> bool:
    """Deterministic, independent of score/AI/photos/devices. Any truthy red
    flag ⇒ True."""
    return any(bool(v) for v in (red_flag_answers or {}).values())


def validate_answers(schema: QuestionnaireSchema, answers: dict, schema_version: int) -> Optional[str]:
    """Return a reason string if the answer set is invalid/incomplete, else None."""
    if not answers:
        return "empty"
    if schema_version != schema.version:
        return "stale_version"
    known = {q.qid: q for q in schema.questions}
    for qid in answers:
        if qid not in known:
            return f"unknown_question:{qid}"
    for q in schema.questions:
        if q.required and (q.qid not in answers or answers[q.qid] in (None, "")):
            return f"missing_required:{q.qid}"
        if q.qid not in answers:
            continue
        val = answers[q.qid]
        if q.qtype == "select" and q.allowed is not None and val not in q.allowed:
            return f"invalid_value:{q.qid}"
        if q.qtype == "number":
            try:
                num = float(val)
            except (TypeError, ValueError):
                return f"invalid_unit:{q.qid}"
            if q.minimum is not None and num < q.minimum:
                return f"out_of_range:{q.qid}"
            if q.maximum is not None and num > q.maximum:
                return f"out_of_range:{q.qid}"
    return None


def assess(schema: QuestionnaireSchema, answers: dict, schema_version: int,
           red_flag_answers: Optional[dict] = None) -> str:
    """The fail-closed gate. Returns URGENT / INCOMPLETE / INDETERMINATE /
    ASSESSABLE. Never LOW or SELF_CARE from here — those require the validated
    rule set on an ASSESSABLE, non-red-flag set."""
    # Red flags dominate everything, even incomplete sets — never subtract risk.
    if has_red_flag(red_flag_answers or {}):
        return URGENT
    reason = validate_answers(schema, answers, schema_version)
    if reason == "empty" or (reason and reason.startswith("missing_required")):
        return INCOMPLETE
    if reason is not None:
        return INDETERMINATE           # unknown id / invalid unit / stale / out of range / invalid value
    return ASSESSABLE                  # complete, valid, no red flag → hand to validated scoring


@dataclass(frozen=True)
class CompletedTriage:
    """Immutable snapshot retained for review."""
    schema_version: int
    rule_version: int
    content_version: int
    input_snapshot: tuple             # frozen (qid, value) pairs
    outcome: str
    red_flags: tuple
    server_timestamp: str

    @staticmethod
    def of(schema_version: int, rule_version: int, content_version: int,
           answers: dict, outcome: str, red_flags: list, timestamp: str) -> "CompletedTriage":
        return CompletedTriage(schema_version, rule_version, content_version,
                               tuple(sorted(answers.items())), outcome,
                               tuple(sorted(red_flags)), timestamp)
