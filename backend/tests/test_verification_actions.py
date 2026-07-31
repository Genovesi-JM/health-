"""Tests for /api/v1/verification/* and /api/v1/webhooks/*.

All provider adapters run in sandbox mode (no vendor creds) so no
network calls happen. The sandbox providers are deterministic per
reference id, so we can assert exact status transitions.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import uuid

import pytest

from app.config import settings


def _register_doctor(client, diploma_country="AO"):
    email = f"doc-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json={
        "email": email, "password": "strong-pass", "full_name": "Doc Test",
        "sector_focus": "health", "role": "doctor",
        "practice_country": "AO", "licence_country": "AO",
        "issuing_authority": "Ordem dos Médicos",
        "licence_number": f"AO-{uuid.uuid4().hex[:6]}",
        "diploma_country": diploma_country,
        "diploma_institution": "Universidade Agostinho Neto",
        "degree_title": "Medicina",
        "graduation_year": 2020,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


# ── /verification/identity/start ────────────────────────────────────────────

def test_identity_start_returns_sandbox_result_without_creds(client):
    auth = _register_doctor(client)
    r = client.post("/api/v1/verification/identity/start", headers=_headers(auth))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "sandbox_identity"
    assert body["mode"] == "mock"
    assert body["status"] == "action_required"
    assert body["provider_reference"]


def test_identity_status_deterministic(client):
    auth = _register_doctor(client)
    started = client.post("/api/v1/verification/identity/start", headers=_headers(auth)).json()
    ref = started["provider_reference"]
    first = client.get(f"/api/v1/verification/identity/status?provider_reference={ref}",
                       headers=_headers(auth)).json()
    second = client.get(f"/api/v1/verification/identity/status?provider_reference={ref}",
                        headers=_headers(auth)).json()
    assert first["status"] == second["status"]


def test_identity_start_requires_credential_dossier(client):
    email = f"patient-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={
        "email": email, "password": "strong-pass", "full_name": "Patient",
        "sector_focus": "health", "role": "patient",
    })
    auth = r.json()
    resp = client.post("/api/v1/verification/identity/start", headers=_headers(auth))
    assert resp.status_code == 403


# ── /verification/qualifications/start ─────────────────────────────────────

def test_qualifications_start_returns_sandbox_submitted(client):
    auth = _register_doctor(client)
    r = client.post("/api/v1/verification/qualifications/start", headers=_headers(auth))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "sandbox_qualification"
    assert body["mode"] == "mock"
    assert body["status"] == "submitted"


# ── /verification/registry/check ───────────────────────────────────────────

def test_registry_check_returns_manual_review_with_authority_context(client):
    auth = _register_doctor(client)
    r = client.post("/api/v1/verification/registry/check", headers=_headers(auth))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "manual_review"
    # In sandbox mode we get the sandbox registry, which is deliberately
    # opaque about the authority; in live mode we'd get the manual registry
    # provider with a real authority dict. Both are valid — the point of the
    # endpoint is that it never auto-completes.


# ── /verification/documents/extract ────────────────────────────────────────

def test_documents_extract_returns_not_configured_without_azure(client):
    auth = _register_doctor(client)
    file_bytes = b"%PDF-1.4\nfake document"
    r = client.post(
        "/api/v1/verification/documents/extract",
        headers=_headers(auth),
        files={"file": ("licence.pdf", file_bytes, "application/pdf")},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "not_configured"
    assert "message" in body


# ── Webhook signature verification ─────────────────────────────────────────

def _sumsub_body_and_sig(secret: str) -> tuple[bytes, str]:
    payload = json.dumps({
        "id": f"evt-{uuid.uuid4().hex[:8]}",
        "applicantId": "apl-1",
        "reviewResult": {"reviewAnswer": "GREEN"},
    }).encode()
    sig = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return payload, sig


def test_sumsub_webhook_rejects_bad_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "sumsub_app_token", "real-token")
    monkeypatch.setattr(settings, "sumsub_secret_key", "real-secret")
    monkeypatch.setattr(settings, "sumsub_webhook_secret", "wh-secret")
    body, _ = _sumsub_body_and_sig("wh-secret")
    r = client.post(
        "/api/v1/webhooks/sumsub",
        content=body,
        headers={"x-payload-digest": "tampered", "content-type": "application/json"},
    )
    assert r.status_code == 401


def test_sumsub_webhook_accepts_valid_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "sumsub_app_token", "real-token")
    monkeypatch.setattr(settings, "sumsub_secret_key", "real-secret")
    monkeypatch.setattr(settings, "sumsub_webhook_secret", "wh-secret")
    body, sig = _sumsub_body_and_sig("wh-secret")
    r = client.post(
        "/api/v1/webhooks/sumsub",
        content=body,
        headers={"x-payload-digest": sig, "content-type": "application/json"},
    )
    # Signature accepted; body is well-formed. Response may report
    # credential_not_found (there's no linked case in this test), but
    # the important assertion is: 200, not 401.
    assert r.status_code == 200, r.text
    body_json = r.json()
    # Either processed, or a specific non-signature reason.
    assert "processed" in body_json


def test_veremark_webhook_rejects_bad_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "veremark_api_key", "real-key")
    monkeypatch.setattr(settings, "veremark_webhook_secret", "wh-secret")
    r = client.post(
        "/api/v1/webhooks/veremark",
        content=b'{"id":"e1","status":"complete","verdict":"passed"}',
        headers={"X-Veremark-Signature": "sha256=bogus", "content-type": "application/json"},
    )
    assert r.status_code == 401


def test_certn_webhook_rejects_bad_signature(client, monkeypatch):
    monkeypatch.setattr(settings, "certn_api_key", "real-key")
    monkeypatch.setattr(settings, "certn_webhook_secret", "wh-secret")
    r = client.post(
        "/api/v1/webhooks/certn",
        content=b'{"id":"e1","report_status":"complete","report_result":"cleared"}',
        headers={"X-Certn-Signature": "bogus", "content-type": "application/json"},
    )
    assert r.status_code == 401


# ── Idempotency ────────────────────────────────────────────────────────────

def test_sumsub_webhook_dedupes_repeated_event(client, monkeypatch):
    monkeypatch.setattr(settings, "sumsub_app_token", "real-token")
    monkeypatch.setattr(settings, "sumsub_secret_key", "real-secret")
    monkeypatch.setattr(settings, "sumsub_webhook_secret", "wh-secret")
    body, sig = _sumsub_body_and_sig("wh-secret")
    hdrs = {"x-payload-digest": sig, "content-type": "application/json"}
    first = client.post("/api/v1/webhooks/sumsub", content=body, headers=hdrs).json()
    second = client.post("/api/v1/webhooks/sumsub", content=body, headers=hdrs).json()
    # First call is either processed or credential_not_found; second must be
    # detected as duplicate because same event_id was already stored.
    assert second["processed"] is False
    assert second["reason"] == "duplicate_event"
