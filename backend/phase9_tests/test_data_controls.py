"""Phase 9 data-control tests: redaction of every prohibited category, and a
complete field inventory with lawful-basis-for-counsel and transfer gates.
"""
from __future__ import annotations

from pathlib import Path

from app.redaction import REDACTED, redact, redact_mapping

DOC = Path(__file__).resolve().parents[2] / "docs/KAYA_DATA_INVENTORY.md"
TEXT = DOC.read_text(encoding="utf-8").lower()


# ── Redaction control ────────────────────────────────────────────────────────

def test_redacts_bearer_and_jwt():
    assert REDACTED in redact("Authorization: Bearer abcdef123456.token")
    assert REDACTED in redact("jwt eyJhbGciOiJIUzI1NiIsInR.eyJzdWIiOiJ1c2VyLTEyMyJ9.s1gnatureValue123")


def test_redacts_provider_keys_and_private_key():
    assert REDACTED in redact("key sk_live_abcdefghij")
    assert REDACTED in redact("whsec_abcdef123456")
    assert REDACTED in redact("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")


def test_redacts_card_and_signed_url():
    assert REDACTED in redact("card 4111 1111 1111 1111")
    assert REDACTED in redact("https://store.example/obj?token=abc&sig=xyz")


def test_redacts_sensitive_and_clinical_keys():
    out = redact_mapping({
        "email": "a@b.com",
        "password": "hunter2",
        "mfa_seed": "JBSWY3DPEHPK3PXP",
        "recovery_codes": ["a", "b"],
        "subjective": "patient reports chest pain",
        "notes": "clinical note text",
        "photo": b"...",
    })
    assert out["password"] == REDACTED
    assert out["mfa_seed"] == REDACTED
    assert out["recovery_codes"] == REDACTED
    assert out["subjective"] == REDACTED
    assert out["notes"] == REDACTED
    assert out["photo"] == REDACTED
    # Non-sensitive value preserved (email is PII but not a secret key here).
    assert out["email"] == "a@b.com"


def test_redact_mapping_is_recursive():
    out = redact_mapping({"outer": {"api_key": "sk_live_zzzzzzzz", "ok": "value"}})
    assert out["outer"]["api_key"] == REDACTED
    assert out["outer"]["ok"] == "value"


# ── Inventory completeness ───────────────────────────────────────────────────

def test_inventory_covers_all_categories():
    for cat in ("identity", "contact", "demographic", "health", "triage",
                "image", "device", "credential", "employment", "payment",
                "support", "audit", "telemetry"):
        assert cat in TEXT, f"data inventory missing category: {cat}"


def test_inventory_has_required_attributes():
    for attr in ("classification", "purpose", "lawful-basis", "retention",
                 "deletion", "export", "logging", "residency"):
        assert attr in TEXT, f"data inventory missing attribute: {attr}"


def test_inventory_marks_lawful_basis_for_counsel_and_transfers_disabled():
    assert "for counsel" in TEXT or "question for counsel" in TEXT
    assert "blocked_external" in TEXT
    # Third-party/cross-border processors remain disabled.
    assert "disabled" in TEXT and "residency" in TEXT


def test_inventory_forbids_employer_individual_clinical():
    assert "no individual clinical to employer" in TEXT or "aggregate only" in TEXT
