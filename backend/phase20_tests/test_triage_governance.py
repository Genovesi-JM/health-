"""Phase 20 triage validation framework: excluded cohorts never get low-risk;
clinical content unusable without named author + independent approver + version +
effective date + evidence; agent never invents a clinical pass mark; kill switch
disables triage but not emergency guidance; no user stranded.
"""
from __future__ import annotations

from datetime import date

from app import triage_governance as G


def test_excluded_populations_never_low_risk():
    for pop in ("pediatric", "pregnancy", "mental_health_crisis", "safeguarding", "severe_pain"):
        assert G.is_excluded(pop, None)
    assert G.outcome_for_excluded() == "EXCLUDED_REDIRECT"
    assert G.outcome_for_excluded() not in ("LOW", "SELF_CARE")


def test_excluded_complaints():
    for comp in ("chest_pain", "suicidal_ideation", "overdose", "severe_bleeding"):
        assert G.is_excluded(None, comp)


def test_supported_case_not_excluded():
    assert not G.is_excluded("adult", "sore_throat")


def _content(**kw):
    base = dict(content_id="rule-1", version=1, named_author="Dr A",
                independent_approver="Dr B", effective_date=date(2026, 9, 14),
                validation_evidence="corpus-run-2026-09")
    base.update(kw)
    return G.ClinicalContent(**base)


def test_approved_content_usable():
    assert G.content_is_usable(_content())


def test_content_missing_fields_not_usable():
    for missing in ("named_author", "independent_approver", "effective_date", "validation_evidence"):
        assert not G.content_is_usable(_content(**{missing: None}))


def test_self_approval_not_usable():
    assert not G.content_is_usable(_content(named_author="Dr A", independent_approver="Dr A"))


def test_engineering_cannot_approve_clinical_content():
    assert not G.content_is_usable(_content(independent_approver="engineering_preparer"))


def test_corpus_metrics():
    cases = [
        {"truth_urgent": True, "predicted_urgent": False},   # false negative
        {"truth_urgent": True, "predicted_urgent": True},
        {"truth_urgent": False, "predicted_urgent": False, "classifiable": False},
        {"truth_urgent": False, "predicted_urgent": False, "reviewers_agree": False},
    ]
    m = G.evaluate_corpus(cases)
    assert m.total == 4 and m.false_negatives == 1 and m.unclassifiable == 1 and m.disagreements == 1
    assert m.false_negative_rate == 0.25


def test_agent_never_invents_clinical_threshold():
    m = G.evaluate_corpus([{"truth_urgent": True, "predicted_urgent": True}])
    # No clinician threshold ⇒ undecided (None), never an agent-declared pass.
    assert G.corpus_meets_clinical_threshold(m, None, None) is None
    # With a clinician threshold, a boolean is returned.
    assert G.corpus_meets_clinical_threshold(m, 0.0, 0.0) is True


def test_kill_switch_disables_triage_not_emergency_guidance():
    assert not G.triage_enabled(kill_switch_on=True, content_usable=True)
    assert G.emergency_guidance_available(kill_switch_on=True)          # still available
    assert G.next_step_on_disabled_triage() != "LOW"


def test_triage_requires_approved_content():
    assert not G.triage_enabled(kill_switch_on=False, content_usable=False)
    assert G.triage_enabled(kill_switch_on=False, content_usable=True)
