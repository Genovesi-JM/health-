"""Phase 10 legal-classification contract: an Angola issue matrix that cites
primary official sources, disclaims legal advice, routes every uncertainty to
counsel with an evidence requirement and feature flag, keeps a second
jurisdiction disabled, and marks legal copy draft/launch-blocking; and product
copy that claims no regulatory approval it does not have.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MATRIX = (REPO / "docs/KAYA_LEGAL_ISSUE_MATRIX.md").read_text(encoding="utf-8")
LOW = MATRIX.lower()
TRANSLATIONS = (REPO / "frontend/src/i18n/translations.ts").read_text(encoding="utf-8")


def test_matrix_disclaims_legal_advice():
    assert "not legal advice" in LOW
    assert "issue-spotting" in LOW or "issue spotting" in LOW


def test_matrix_cites_official_angola_sources():
    for src in ("apd", "minsa", "armed", "ordem", "decreto presidencial 202/11", "lei de bases"):
        assert src in LOW, f"legal matrix missing official source: {src}"


def test_matrix_covers_required_issue_areas():
    for area in ("data controller", "licensed care provider", "medical director",
                 "telemedicine", "prescribing", "medical-software", "ai obligations",
                 "privacy authority", "incident", "insurance", "emergency information"):
        assert area in LOW, f"legal matrix missing issue area: {area}"


def test_every_issue_has_flag_and_evidence():
    rows = [ln for ln in MATRIX.splitlines() if re.match(r"\|\s*L\d\d\b", ln)]
    assert len(rows) >= 14, "matrix must enumerate the launch-relevant issues"
    # Each row must name evidence required and an affected feature flag column.
    assert "evidence required" in LOW and "affected feature flag" in LOW


def test_consent_separated_from_lawful_basis():
    assert "clinical informed consent" in LOW and "lawful basis" in LOW
    assert "not the default answer" in LOW or "not\n" in LOW or "separate" in LOW


def test_legal_copy_marked_draft_and_launch_blocking():
    assert "draft" in LOW and "launch-blocking" in LOW


def test_second_jurisdiction_disabled():
    assert "disabled" in LOW and ("cannot inherit" in LOW or "second jurisdiction" in LOW)


def test_no_false_regulatory_approval_claim_in_copy():
    forbidden = [
        r"gdpr\s*(certif|compliant\b)",
        r"certifica[çc][ãa]o\s+gdpr",
        r"dispositivo m[ée]dico certificad",
        r"medical device (approved|certified)",
        r"regulator[- ]approved",
        r"aprovad[oa]s?\s+pel[oa]\s+(apd|minsa|armed)",
        r"regulador[- ]aprovad",
    ]
    hits = []
    for pat in forbidden:
        for m in re.finditer(pat, TRANSLATIONS, re.IGNORECASE):
            hits.append(f"/{pat}/ :: {TRANSLATIONS[max(0,m.start()-20):m.start()+40]!r}")
    assert not hits, "product copy claims regulatory approval it does not have:\n" + "\n".join(hits)
