"""Phase 8 threat-model completeness and hygiene. The model must cover every
required data category, threat class, and component, and must carry no secrets
or patient examples. Diagrams alone are not accepted as mitigation.
"""
from __future__ import annotations

import re
from pathlib import Path

DOC = Path(__file__).resolve().parents[2] / "docs/KAYA_THREAT_MODEL.md"
TEXT = DOC.read_text(encoding="utf-8")
LOW = TEXT.lower()

_SECRET = re.compile(r"(?i)(BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{10,}|password\s*[:=]\s*\S)")
_PHI = re.compile(r"(?i)(date of birth|\bDOB\b|patient (?:name|id)\s*[:=]|\bMRN\b\s*[:=])")


def test_doc_exists():
    assert DOC.exists()


def test_covers_sensitive_data_categories():
    for cat in ("account identity", "credentials", "consent", "triage", "photos",
                "device readings", "booking", "video", "clinical notes",
                "prescriptions", "messages", "payments", "analytics", "backups",
                "support", "data-rights"):
        assert cat in LOW, f"threat model missing data category: {cat}"


def test_data_category_attributes_modeled():
    for attr in ("source", "purpose", "destination", "processor", "retention", "authorized actor"):
        assert attr in LOW, f"data-flow table missing attribute: {attr}"


def test_covers_threat_classes():
    for threat in ("account takeover", "privilege escalation", "credential fraud",
                   "cross-tenant", "idor", "consent bypass", "leakage",
                   "webhook forgery", "replay", "booking race",
                   "prompt injection", "egress", "malicious file", "insider",
                   "denial of service"):
        assert threat in LOW, f"threat model missing threat: {threat}"


def test_covers_required_components():
    for comp in ("mobile", "browser storage", "email", "video", "ai",
                 "object store", "backups", "admin", "webhook"):
        assert comp in LOW, f"threat model missing component: {comp}"


def test_boundaries_have_preventive_and_detective_controls():
    assert "preventive control" in LOW and "detective control" in LOW
    # Each catalog row lists an owner and a residual/link.
    assert "residual" in LOW


def test_has_change_trigger():
    assert "change trigger" in LOW
    assert "no-mitigation-by-diagram" in LOW or "diagram alone never closes" in LOW


def test_no_secrets_or_phi_in_artifact():
    assert not _SECRET.search(TEXT), "threat model may contain a secret"
    assert not _PHI.search(TEXT), "threat model may contain patient data"
