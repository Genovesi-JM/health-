import uuid
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, urlparse

from app.config import settings
from app.services.credential_providers import extract_azure_fields


def _register(client, role="doctor", diploma_country="PT"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{int(uuid.uuid4().hex[:2], 16)}",
    }, json={
        "email": email,
        "password": "strong-pass",
        "full_name": "Profissional Teste",
        "sector_focus": "health",
        "role": role,
        "practice_country": "AO",
        "licence_country": "AO",
        "issuing_authority": "Ordem Profissional",
        "licence_number": "AO-12345",
        "diploma_country": diploma_country,
        "diploma_institution": "Universidade de Teste",
        "degree_title": "Medicina" if role == "doctor" else "Enfermagem",
        "graduation_year": 2020,
    })
    assert response.status_code == 201, response.text
    return response.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _upload(client, auth, kind):
    return client.post(
        f"/api/v1/credentials/me/evidence/{kind}",
        headers=_headers(auth),
        files={"file": (f"{kind}.pdf", b"%PDF-1.4\ncredential-test", "application/pdf")},
    )


def test_patient_registration_cannot_create_clinician_dossier(client):
    email = f"patient-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post("/auth/register", json={
        "email": email, "password": "strong-pass", "full_name": "Patient Test",
        "sector_focus": "health", "role": "patient",
    })
    assert response.status_code == 201
    dossier = client.get("/api/v1/credentials/me", headers=_headers(response.json()))
    assert dossier.status_code == 403


def test_foreign_diploma_requires_recognition_and_human_approval(client):
    auth = _register(client, role="doctor", diploma_country="PT")
    dossier = client.get("/api/v1/credentials/me", headers=_headers(auth))
    assert dossier.status_code == 200
    assert set(dossier.json()["missing_evidence"]) == {"professional_card", "diploma", "recognition"}

    assert _upload(client, auth, "professional_card").status_code == 200
    assert _upload(client, auth, "diploma").status_code == 200
    incomplete = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert incomplete.status_code == 422
    assert "recognition" in incomplete.json()["detail"]["missing_evidence"]

    assert _upload(client, auth, "recognition").status_code == 200
    submitted = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "pending_review"

    # Automated checks never grant clinical access.
    blocked = client.get("/api/v1/doctor/dashboard", headers=_headers(auth))
    assert blocked.status_code == 403

    admin_login = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    assert admin_login.status_code == 200
    approved = client.post(
        f"/api/v1/credentials/admin/{submitted.json()['id']}/decision",
        headers=_headers(admin_login.json()),
        json={"action": "approve"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "verified"

    allowed = client.get("/api/v1/doctor/dashboard", headers=_headers(auth))
    assert allowed.status_code == 200


def test_nurse_queue_is_gated_until_review(client):
    auth = _register(client, role="nurse", diploma_country="AO")
    blocked = client.get("/api/v1/nurse/dashboard", headers=_headers(auth))
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "credential_verification_required"


def test_verified_nurse_dashboard_exposes_operational_kpis(client):
    auth = _register(client, role="nurse", diploma_country="AO")
    assert _upload(client, auth, "professional_card").status_code == 200
    assert _upload(client, auth, "diploma").status_code == 200
    submitted = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert submitted.status_code == 200
    admin = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    approved = client.post(
        f"/api/v1/credentials/admin/{submitted.json()['id']}/decision",
        headers=_headers(admin.json()),
        json={"action": "approve"},
    )
    assert approved.status_code == 200
    dashboard = client.get("/api/v1/nurse/dashboard", headers=_headers(auth))
    assert dashboard.status_code == 200
    assert {
        "queue_count", "urgent_count", "triages_today", "average_wait_minutes",
        "longest_wait_minutes", "waiting_over_30_count", "unclassified_count", "recent",
    }.issubset(dashboard.json())


def test_registration_rejects_incomplete_clinician_profile(client):
    response = client.post("/auth/register", json={
        "email": f"incomplete-{uuid.uuid4().hex[:8]}@example.com",
        "password": "strong-pass",
        "full_name": "Incomplete Doctor",
        "sector_focus": "health",
        "role": "doctor",
    })
    assert response.status_code == 422
    assert "licence_number" in response.json()["detail"]["missing_fields"]


def test_nurse_invite_creates_nurse_dossier(client):
    admin_login = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    invite = client.post(
        "/admin/doctor-invites",
        headers=_headers(admin_login.json()),
        json={"role": "nurse", "expires_days": 7},
    )
    assert invite.status_code == 201, invite.text
    token = parse_qs(urlparse(invite.json()["invite_url"]).query)["token"][0]
    email = f"invited-nurse-{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post("/auth/register/doctor", json={
        "token": token,
        "email": email,
        "password": "strong-pass",
        "display_name": "Enfermeira Convidada",
        "specialization": "enfermagem_geral",
        "license_number": "ORDENFA-123",
        "practice_country": "AO",
        "licence_country": "AO",
        "issuing_authority": "ORDENFA",
        "diploma_country": "CU",
        "diploma_institution": "Universidad de Ciencias Médicas",
        "degree_title": "Licenciatura em Enfermagem",
    })
    assert registered.status_code == 201, registered.text
    assert registered.json()["user"]["role"] == "nurse"
    dossier = client.get("/api/v1/credentials/me", headers=_headers(registered.json()))
    assert dossier.status_code == 200
    assert dossier.json()["profession"] == "nurse"
    assert "recognition" in dossier.json()["missing_evidence"]


def test_country_requirements_include_us_uk_and_all_eu_members(client):
    response = client.get(
        "/api/v1/credentials/requirements",
        params={"profession": "doctor", "practice_country": "DE", "licence_country": "DE", "diploma_country": "FR"},
    )
    assert response.status_code == 200
    body = response.json()
    codes = {item["code"] for item in body["countries"]}
    assert {"US", "GB", "DE", "FR", "PT", "ES", "SE", "MT"}.issubset(codes)
    assert body["eu_coordinated_recognition"] is True
    assert body["registry"]["mode"] == "eu_competent_authority"
    assert "recognition" in body["required_evidence"]


def test_us_licence_requires_state_jurisdiction(client):
    auth = _register(client)
    dossier = client.get("/api/v1/credentials/me", headers=_headers(auth)).json()
    update = {
        key: dossier.get(key) for key in (
            "profession", "legal_name", "nationality_country", "practice_country",
            "issuing_authority", "licence_number", "licence_expiry_date",
            "diploma_country", "diploma_institution", "degree_title", "graduation_year",
            "specialization", "registry_profile_url",
        )
    }
    update["licence_country"] = "US"
    update["licence_jurisdiction"] = None
    rejected = client.put("/api/v1/credentials/me", headers=_headers(auth), json=update)
    assert rejected.status_code == 422
    update["licence_jurisdiction"] = "California"
    accepted = client.put("/api/v1/credentials/me", headers=_headers(auth), json=update)
    assert accepted.status_code == 200
    assert accepted.json()["licence_jurisdiction"] == "California"


def test_provider_start_requires_consent_and_is_idempotent_without_keys(client):
    auth = _register(client, diploma_country="AO")
    assert _upload(client, auth, "professional_card").status_code == 200
    denied = client.post(
        "/api/v1/credentials/me/providers/start",
        headers=_headers(auth),
        json={"consent": False, "providers": ["azure", "persona", "dataflow"]},
    )
    assert denied.status_code == 422

    started = client.post(
        "/api/v1/credentials/me/providers/start",
        headers=_headers(auth),
        json={"consent": True, "providers": ["azure", "persona", "dataflow"]},
    )
    assert started.status_code == 200, started.text
    checks = started.json()["provider_checks"]
    assert {item["provider"] for item in checks} == {"azure", "persona", "dataflow"}
    assert all(item["status"] == "not_configured" for item in checks)

    repeated = client.post(
        "/api/v1/credentials/me/providers/start",
        headers=_headers(auth),
        json={"consent": True, "providers": ["azure", "persona", "dataflow"]},
    )
    assert repeated.status_code == 200
    assert len(repeated.json()["provider_checks"]) == len(checks)


def test_azure_field_parser_keeps_value_and_confidence():
    result = extract_azure_fields({
        "analyzeResult": {"documents": [{"fields": {
            "LicenceNumber": {"valueString": "GMC-123", "confidence": 0.98},
            "IssueDate": {"valueDate": "2026-01-01", "confidence": 0.91},
        }}]},
    })
    assert result["LicenceNumber"] == {"value": "GMC-123", "confidence": 0.98}
    assert result["IssueDate"]["value"] == "2026-01-01"


def test_persona_webhook_signature_is_required(client, db_session):
    previous = settings.persona_webhook_secret
    settings.persona_webhook_secret = "test-webhook-secret"
    try:
        raw = json.dumps({"data": {"id": "evt_test", "attributes": {
            "name": "inquiry.completed",
            "payload": {"data": {"id": "inq_missing"}},
        }}}).encode()
        invalid = client.post(
            "/api/v1/credentials/webhooks/persona",
            content=raw,
            headers={"Content-Type": "application/json", "Persona-Signature": "t=1,v1=bad"},
        )
        assert invalid.status_code == 401
        timestamp = str(int(time.time()))
        digest = hmac.new(
            settings.persona_webhook_secret.encode(),
            timestamp.encode() + b"." + raw,
            hashlib.sha256,
        ).hexdigest()
        valid = client.post(
            "/api/v1/credentials/webhooks/persona",
            content=raw,
            headers={
                "Content-Type": "application/json",
                "Persona-Signature": f"t={timestamp},v1={digest}",
            },
        )
        assert valid.status_code == 200
    finally:
        settings.persona_webhook_secret = previous
