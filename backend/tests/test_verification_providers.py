"""Verification provider tests.

Focus: interface conformance, sandbox determinism, config-driven
selection, and fall-back behavior when live credentials are absent.
No network calls — every provider is exercised in mock/sandbox mode.
"""
import hashlib
import hmac
import json

import pytest

from app.config import settings
from app.services.verification import (
    IdentityApplicant,
    IdentityVerificationProvider,
    ProviderMode,
    QualificationApplicant,
    QualificationVerificationProvider,
    RegistryCheckRequest,
    RegulatoryRegistryProvider,
    VerificationStatus,
    get_identity_provider,
    get_qualification_provider,
    get_registry_provider,
    lookup_authority,
)
from app.services.verification.certn import CertnQualificationProvider
from app.services.verification.manual_registry import ManualRegistryProvider
from app.services.verification.sandbox import (
    SandboxIdentityProvider,
    SandboxQualificationProvider,
    SandboxRegistryProvider,
)
from app.services.verification.sumsub import SumsubIdentityProvider
from app.services.verification.veremark import VeremarkQualificationProvider


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def id_applicant():
    return IdentityApplicant(
        reference_id="apl-abc123",
        legal_name="Ana Manuel",
        date_of_birth="1990-01-01",
        nationality_country="AO",
        email="ana@example.com",
    )


@pytest.fixture
def qual_applicant():
    return QualificationApplicant(
        reference_id="apl-abc123",
        legal_name="Ana Manuel",
        email="ana@example.com",
        country_of_practice="AO",
        institution="Universidade Agostinho Neto",
        degree_title="Medicina",
        graduation_year=2015,
        licence_number="AO-DR-12345",
        issuing_authority="Ordem dos Médicos de Angola",
    )


@pytest.fixture
def reg_req():
    return RegistryCheckRequest(
        reference_id="apl-abc123",
        country="AO",
        profession="doctor",
        authority="Ordem dos Médicos de Angola",
        licence_number="AO-DR-12345",
        legal_name="Ana Manuel",
    )


@pytest.fixture(autouse=True)
def _clear_live_creds(monkeypatch):
    """Force adapters into sandbox mode for tests (no network)."""
    for attr in (
        "sumsub_app_token", "sumsub_secret_key", "sumsub_webhook_secret",
        "veremark_api_key", "veremark_webhook_secret",
        "certn_api_key", "certn_webhook_secret",
    ):
        monkeypatch.setattr(settings, attr, None, raising=False)


# ── Interface conformance ───────────────────────────────────────────────────

def test_sumsub_conforms_to_identity_protocol():
    assert isinstance(SumsubIdentityProvider(), IdentityVerificationProvider)


def test_sandbox_identity_conforms():
    assert isinstance(SandboxIdentityProvider(), IdentityVerificationProvider)


def test_veremark_conforms_to_qualification_protocol():
    assert isinstance(VeremarkQualificationProvider(), QualificationVerificationProvider)


def test_certn_conforms_to_qualification_protocol():
    assert isinstance(CertnQualificationProvider(), QualificationVerificationProvider)


def test_manual_registry_conforms_to_registry_protocol():
    assert isinstance(ManualRegistryProvider(), RegulatoryRegistryProvider)


def test_sandbox_registry_conforms():
    assert isinstance(SandboxRegistryProvider(), RegulatoryRegistryProvider)


# ── Fall-back behavior when live creds missing ──────────────────────────────

def test_sumsub_falls_back_to_sandbox_without_creds(id_applicant):
    provider = SumsubIdentityProvider()
    assert provider.mode == ProviderMode.MOCK
    result = provider.start(id_applicant)
    assert result.status == VerificationStatus.ACTION_REQUIRED
    assert result.mode == ProviderMode.MOCK
    assert result.provider_reference


def test_veremark_falls_back_to_sandbox_without_creds(qual_applicant):
    provider = VeremarkQualificationProvider()
    assert provider.mode == ProviderMode.MOCK
    result = provider.start(qual_applicant)
    assert result.status == VerificationStatus.SUBMITTED
    assert result.mode == ProviderMode.MOCK


def test_certn_falls_back_to_sandbox_without_creds(qual_applicant):
    provider = CertnQualificationProvider()
    assert provider.mode == ProviderMode.MOCK
    result = provider.start(qual_applicant)
    assert result.status == VerificationStatus.SUBMITTED
    assert result.mode == ProviderMode.MOCK


# ── Sandbox determinism ─────────────────────────────────────────────────────

def test_sandbox_identity_status_is_deterministic():
    a = SandboxIdentityProvider().fetch_status("apl-deterministic-ref")
    b = SandboxIdentityProvider().fetch_status("apl-deterministic-ref")
    assert a.status == b.status
    assert a.extracted == b.extracted


def test_sandbox_qualification_status_is_deterministic():
    a = SandboxQualificationProvider().fetch_status("apl-deterministic-ref")
    b = SandboxQualificationProvider().fetch_status("apl-deterministic-ref")
    assert a.status == b.status


def test_sandbox_identity_covers_multiple_status_buckets():
    """The bucket distribution must actually produce more than one outcome."""
    statuses = {SandboxIdentityProvider().fetch_status(f"apl-{i}").status for i in range(200)}
    assert VerificationStatus.COMPLETED in statuses
    # At least one of the non-completed buckets fires in 200 samples.
    assert statuses - {VerificationStatus.COMPLETED}


# ── Registry provider ──────────────────────────────────────────────────────

def test_manual_registry_returns_manual_review(reg_req):
    result = ManualRegistryProvider().check(reg_req)
    assert result.status == VerificationStatus.MANUAL_REVIEW
    assert "Ordem dos Médicos" in result.raw["authority"]


def test_manual_registry_flags_unconfigured_country():
    result = ManualRegistryProvider().check(RegistryCheckRequest(
        reference_id="x", country="XX", profession="doctor",
        authority="Unknown", licence_number="123", legal_name="Jane",
    ))
    assert result.status == VerificationStatus.MANUAL_REVIEW
    assert result.raw["config_needed"] is True


def test_lookup_authority_case_insensitive():
    a = lookup_authority("ao", "doctor")
    b = lookup_authority("AO", "DOCTOR")
    assert a == b
    assert a is not None
    assert "Ordem" in a["name"]


def test_sandbox_registry_always_manual_review(reg_req):
    result = SandboxRegistryProvider().check(reg_req)
    assert result.status == VerificationStatus.MANUAL_REVIEW
    assert result.raw["sandbox"] is True


# ── Config-driven selector ─────────────────────────────────────────────────

def test_selector_returns_sandbox_when_mode_forced(monkeypatch):
    monkeypatch.setattr(settings, "kaya_verification_mode", "sandbox")
    assert isinstance(get_identity_provider(), SandboxIdentityProvider)
    assert isinstance(get_qualification_provider(), SandboxQualificationProvider)
    assert isinstance(get_registry_provider(), SandboxRegistryProvider)


def test_selector_honors_provider_choice(monkeypatch):
    monkeypatch.setattr(settings, "kaya_verification_mode", "live")
    monkeypatch.setattr(settings, "qualification_provider", "certn")
    provider = get_qualification_provider()
    assert isinstance(provider, CertnQualificationProvider)


def test_selector_falls_back_to_sandbox_for_unknown_provider(monkeypatch):
    monkeypatch.setattr(settings, "kaya_verification_mode", "live")
    monkeypatch.setattr(settings, "identity_provider", "nonexistent-vendor")
    assert isinstance(get_identity_provider(), SandboxIdentityProvider)


# ── Webhook signature verification ─────────────────────────────────────────

def test_sumsub_webhook_signature_verify_live(monkeypatch):
    """Even without an API token, if the WEBHOOK secret is set we run live signature verification."""
    monkeypatch.setattr(settings, "sumsub_app_token", "real-token")
    monkeypatch.setattr(settings, "sumsub_secret_key", "real-secret")
    monkeypatch.setattr(settings, "sumsub_webhook_secret", "my-webhook-secret")
    provider = SumsubIdentityProvider()
    body = b'{"applicantId":"abc"}'
    good_sig = hmac.new(b"my-webhook-secret", body, hashlib.sha256).hexdigest()
    assert provider.verify_webhook(body, {"x-payload-digest": good_sig}) is True
    assert provider.verify_webhook(body, {"x-payload-digest": "bogus"}) is False


def test_veremark_webhook_signature_verify(monkeypatch):
    monkeypatch.setattr(settings, "veremark_api_key", "real-key")
    monkeypatch.setattr(settings, "veremark_webhook_secret", "wh-secret")
    provider = VeremarkQualificationProvider()
    body = b'{"id":"case-1"}'
    good_sig = hmac.new(b"wh-secret", body, hashlib.sha256).hexdigest()
    assert provider.verify_webhook(body, {"X-Veremark-Signature": f"sha256={good_sig}"}) is True
    assert provider.verify_webhook(body, {"X-Veremark-Signature": "sha256=bad"}) is False


def test_certn_webhook_signature_verify(monkeypatch):
    monkeypatch.setattr(settings, "certn_api_key", "real-key")
    monkeypatch.setattr(settings, "certn_webhook_secret", "wh-secret")
    provider = CertnQualificationProvider()
    body = b'{"id":"app-1"}'
    good_sig = hmac.new(b"wh-secret", body, hashlib.sha256).hexdigest()
    assert provider.verify_webhook(body, {"X-Certn-Signature": good_sig}) is True
    assert provider.verify_webhook(body, {"X-Certn-Signature": "bad"}) is False


def test_sandbox_webhook_accepts_token():
    p = SandboxIdentityProvider()
    assert p.verify_webhook(b"{}", {"X-Sandbox-Token": "sandbox-ok"}) is True
    assert p.verify_webhook(b"{}", {"X-Sandbox-Token": "nope"}) is False


# ── Sandbox never lies about mode ──────────────────────────────────────────

def test_all_sandbox_results_carry_mock_mode(id_applicant, qual_applicant, reg_req):
    id_r = SandboxIdentityProvider().start(id_applicant)
    qual_r = SandboxQualificationProvider().start(qual_applicant)
    reg_r = SandboxRegistryProvider().check(reg_req)
    for r in (id_r, qual_r, reg_r):
        assert r.mode == ProviderMode.MOCK, f"{r.provider} leaked non-mock mode"


# ── Webhook parse round-trip ───────────────────────────────────────────────

def test_sumsub_parse_webhook_maps_green_to_completed(monkeypatch):
    monkeypatch.setattr(settings, "sumsub_app_token", "real-token")
    monkeypatch.setattr(settings, "sumsub_secret_key", "real-secret")
    result = SumsubIdentityProvider().parse_webhook({
        "applicantId": "apl-1",
        "reviewResult": {"reviewAnswer": "GREEN"},
    })
    assert result.status == VerificationStatus.COMPLETED


def test_veremark_parse_webhook_maps_completed_pass(monkeypatch):
    monkeypatch.setattr(settings, "veremark_api_key", "real-key")
    result = VeremarkQualificationProvider().parse_webhook({
        "id": "case-1",
        "status": "complete",
        "verdict": "passed",
    })
    assert result.status == VerificationStatus.COMPLETED


def test_certn_parse_webhook_needs_review_becomes_manual(monkeypatch):
    monkeypatch.setattr(settings, "certn_api_key", "real-key")
    result = CertnQualificationProvider().parse_webhook({
        "id": "app-1",
        "report_status": "complete",
        "report_result": "consider",
    })
    assert result.status == VerificationStatus.MANUAL_REVIEW
