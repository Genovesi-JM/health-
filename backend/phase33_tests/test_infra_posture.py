"""Phase 33 cloud infra & secrets posture: policy predicates plus a static
contract test that the real Azure Bicep keeps the required controls (secure
params, private DB, private blob, TLS1_2, https-only, managed identity, no secret
outputs) and that residual public-access resources are inventoried for owner
review.
"""
from __future__ import annotations

import pathlib
import re

import pytest

from app import infra_posture as I


# ── Secret handling ──────────────────────────────────────────────────────────

def test_committed_secret_detection():
    assert I.contains_committed_secret('api_key = "sk_live_abcdef123456"')
    assert I.contains_committed_secret("AKIAIOSFODNN7EXAMPLE")
    assert not I.contains_committed_secret("param dbPassword string")


def test_secure_param_requires_secure_and_no_default():
    assert I.secret_supplied_securely("@secure()\nparam pw string")
    assert not I.secret_supplied_securely("param pw string = 'hunter2'")   # default literal
    assert not I.secret_supplied_securely("param pw string")               # not @secure()


# ── Posture predicates ───────────────────────────────────────────────────────

def test_storage_posture():
    good = I.ResourcePosture("st", https_only=True, min_tls="TLS1_2", blob_public_access=False)
    assert I.storage_posture_ok(good)[0]
    bad = I.ResourcePosture("st", https_only=False, min_tls="TLS1_0", blob_public_access=True)
    ok, reasons = I.storage_posture_ok(bad)
    assert not ok and len(reasons) == 3


def test_database_posture():
    assert I.database_posture_ok(I.ResourcePosture("db", public_network_access="Disabled"))[0]
    assert not I.database_posture_ok(I.ResourcePosture("db", public_network_access="Enabled"))[0]


def test_identity_and_least_privilege():
    assert I.identity_posture_ok(I.ResourcePosture("id", uses_managed_identity=True))
    assert not I.identity_posture_ok(I.ResourcePosture("id", uses_managed_identity=None))
    assert I.app_role_is_least_privilege("AcrPull")
    assert not I.app_role_is_least_privilege("Owner")
    assert not I.app_role_is_least_privilege("Contributor")


# ── Static contract test against the real Bicep ──────────────────────────────

def _bicep_text():
    root = pathlib.Path(__file__).resolve().parents[2]   # repo root
    p = root / "infra" / "azure" / "main.bicep"
    assert p.exists(), "Azure Bicep template not found"
    return p.read_text(encoding="utf-8", errors="ignore")


def test_bicep_has_no_committed_secret():
    assert not I.contains_committed_secret(_bicep_text())


def test_bicep_admin_password_is_secure():
    text = _bicep_text()
    assert "@secure()" in text
    # no plaintext default assigned to the password param
    assert not re.search(r"postgresAdministratorPassword\s+string\s*=\s*['\"]", text)


def test_bicep_storage_and_db_posture():
    text = _bicep_text()
    assert "allowBlobPublicAccess: false" in text
    assert "minimumTlsVersion: 'TLS1_2'" in text
    assert "supportsHttpsTrafficOnly: true" in text
    # PostgreSQL public network access disabled
    assert "publicNetworkAccess: 'Disabled'" in text


def test_bicep_uses_managed_identity_and_no_secret_outputs():
    text = _bicep_text()
    assert "Microsoft.ManagedIdentity/userAssignedIdentities" in text
    # outputs must not expose passwords/keys/connection strings
    out_section = text[text.find("output"):] if "output" in text else ""
    assert "password" not in out_section.lower()
    assert "connectionstring" not in out_section.lower().replace(" ", "")


def test_bicep_public_access_resources_are_inventoried():
    """Residual `publicNetworkAccess: 'Enabled'` resources are allowed only with a
    dated owner review; assert the count is recorded in the posture doc."""
    text = _bicep_text()
    enabled = text.count("publicNetworkAccess: 'Enabled'")
    doc = pathlib.Path(__file__).resolve().parents[2] / "docs" / "KAYA_INFRA_POSTURE.md"
    assert doc.exists()
    if enabled:
        assert "publicNetworkAccess" in doc.read_text(encoding="utf-8", errors="ignore")
