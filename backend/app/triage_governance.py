"""Clinician-governed triage validation framework (Phase 20). Domain-pure.

This provides the *technical scaffolding* for clinical validation — exclusion
enforcement, a clinical-content approval gate, corpus metrics, controlled
rollout/rollback, and a kill switch. It does NOT and can NOT declare the rules
clinically validated: that requires qualified clinicians for the selected service
and jurisdiction. Unsupported populations and complaints never receive a
definitive low-risk recommendation.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Optional

# Populations/complaints excluded from the invited-adult primary-care pilot.
# Excluded ⇒ redirect/exclude, never an improvised low-risk rule.
EXCLUDED_POPULATIONS = frozenset({
    "pediatric", "minor", "pregnancy", "mental_health_crisis", "safeguarding",
    "severe_pain", "communication_limited",
})
EXCLUDED_COMPLAINTS = frozenset({
    "chest_pain", "stroke", "suicidal_ideation", "self_harm", "overdose",
    "severe_bleeding", "anaphylaxis", "obstetric_emergency",
})

EXCLUDED = "EXCLUDED_REDIRECT"      # safe next-step, never a low-risk recommendation


def is_excluded(population: Optional[str], complaint: Optional[str]) -> bool:
    return (population in EXCLUDED_POPULATIONS) or (complaint in EXCLUDED_COMPLAINTS)


def outcome_for_excluded() -> str:
    """Excluded cohorts get a safe redirect, never LOW/SELF_CARE."""
    return EXCLUDED


# ── Clinical-content approval gate ───────────────────────────────────────────

@dataclass(frozen=True)
class ClinicalContent:
    content_id: str
    version: int
    named_author: Optional[str]
    independent_approver: Optional[str]
    effective_date: Optional[date]
    validation_evidence: Optional[str]


def content_is_usable(c: ClinicalContent, author_is_approver_forbidden: bool = True) -> bool:
    """Every pilot triage output/instruction needs a named author, an INDEPENDENT
    approver, a version, an effective date, and validation evidence. Missing any,
    or self-approval, ⇒ not usable (the agent cannot self-validate)."""
    if not (c.named_author and c.independent_approver and c.effective_date and c.validation_evidence):
        return False
    if author_is_approver_forbidden and c.named_author == c.independent_approver:
        return False
    if c.independent_approver == "engineering_preparer":
        return False
    return True


# ── Locked-corpus metrics (technical evidence only) ──────────────────────────

@dataclass
class CorpusMetrics:
    total: int
    false_negatives: int          # urgent truth predicted non-urgent (safety-critical)
    unclassifiable: int
    disagreements: int

    @property
    def false_negative_rate(self) -> float:
        return self.false_negatives / self.total if self.total else 1.0

    @property
    def unclassifiable_rate(self) -> float:
        return self.unclassifiable / self.total if self.total else 1.0


def evaluate_corpus(cases: Iterable[dict]) -> CorpusMetrics:
    """Compute technical metrics over a locked corpus. Each case:
    {truth_urgent: bool, predicted_urgent: bool, classifiable: bool, reviewers_agree: bool}.
    Pass/fail thresholds are clinician-owned — not decided here."""
    cases = list(cases)
    total = len(cases)
    fn = sum(1 for c in cases if c.get("truth_urgent") and not c.get("predicted_urgent"))
    uncl = sum(1 for c in cases if not c.get("classifiable", True))
    dis = sum(1 for c in cases if not c.get("reviewers_agree", True))
    return CorpusMetrics(total=total, false_negatives=fn, unclassifiable=uncl, disagreements=dis)


def corpus_meets_clinical_threshold(metrics: CorpusMetrics,
                                    max_false_negative_rate: Optional[float],
                                    max_unclassifiable_rate: Optional[float]) -> Optional[bool]:
    """Returns True/False ONLY when a clinician-supplied threshold is provided;
    returns None (undecided) when thresholds are absent — the agent never invents
    a clinical pass mark."""
    if max_false_negative_rate is None or max_unclassifiable_rate is None:
        return None
    return (metrics.false_negative_rate <= max_false_negative_rate
            and metrics.unclassifiable_rate <= max_unclassifiable_rate)


# ── Kill switch & rollback ───────────────────────────────────────────────────

def triage_enabled(kill_switch_on: bool, content_usable: bool) -> bool:
    """Triage runs only when not killed and the clinical content is approved."""
    return (not kill_switch_on) and content_usable


def emergency_guidance_available(kill_switch_on: bool) -> bool:
    """The kill switch disables triage but NEVER blocks emergency guidance."""
    return True


def next_step_on_disabled_triage() -> str:
    """A disabled/rolled-back triage must not strand users: give safe guidance."""
    return "clinician_review_or_local_emergency_services"
