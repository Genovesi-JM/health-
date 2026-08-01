"""Organisation onboarding tests (clinic / lab / pharmacy)."""
from __future__ import annotations

import uuid


def _register(client, role="patient"):
    email = f"org-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json={
        "email": email, "password": "strong-pass", "full_name": "Org Owner",
        "sector_focus": "health", "role": role,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _base_org(reg_number: str | None = None) -> dict:
    return {
        "org_type": "clinic",
        "legal_name": "Clínica Central Lda",
        "trading_name": "Clínica Central",
        "registration_number": reg_number or f"REG-{uuid.uuid4().hex[:8]}",
        "tax_number": "5417000000",
        "country": "AO",
        "general_email": "geral@clinica.example",
        "iban": "AO06000000001234567890123",
        "integration": {"has_api": False, "csv_import": True},
    }


def _upload(client, auth, kind="operating_licence"):
    return client.post(
        f"/api/v1/organisations/me/documents/{kind}",
        headers=_headers(auth),
        files={"file": (f"{kind}.pdf", b"%PDF-1.4\norg-doc", "application/pdf")},
    )


# ── Create / read ──────────────────────────────────────────────────────

def test_create_organisation_profile(client):
    auth = _register(client)
    r = client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["org_type"] == "clinic"
    assert body["status"] == "draft"
    assert body["locations"] == []


def test_iban_is_never_returned_in_full(client):
    auth = _register(client)
    org = _base_org()
    org["iban"] = "AO06000000009999888812"
    r = client.post("/api/v1/organisations", headers=_headers(auth), json=org).json()
    assert "iban" not in r
    assert r["iban_last4"] == "8812"


def test_create_rejects_bad_org_type(client):
    auth = _register(client)
    org = _base_org()
    org["org_type"] = "spaceship"
    r = client.post("/api/v1/organisations", headers=_headers(auth), json=org)
    assert r.status_code == 422


def test_get_me_returns_profile(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    r = client.get("/api/v1/organisations/me", headers=_headers(auth))
    assert r.status_code == 200
    assert r.json()["legal_name"] == "Clínica Central Lda"


def test_get_me_404_when_none(client):
    auth = _register(client)
    r = client.get("/api/v1/organisations/me", headers=_headers(auth))
    assert r.status_code == 404


# ── Duplicate registration number ──────────────────────────────────────

def test_duplicate_registration_number_rejected(client):
    reg = f"REG-DUP-{uuid.uuid4().hex[:6]}"
    a = _register(client)
    b = _register(client)
    r1 = client.post("/api/v1/organisations", headers=_headers(a), json=_base_org(reg))
    assert r1.status_code == 200
    r2 = client.post("/api/v1/organisations", headers=_headers(b), json=_base_org(reg))
    assert r2.status_code == 409


# ── Locations ──────────────────────────────────────────────────────────

def test_add_multiple_locations(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    client.post("/api/v1/organisations/me/locations", headers=_headers(auth),
                json={"name": "Sede", "city": "Luanda", "emergency_available": True})
    r = client.post("/api/v1/organisations/me/locations", headers=_headers(auth),
                    json={"name": "Filial Talatona", "city": "Luanda"})
    assert r.status_code == 200
    assert len(r.json()["locations"]) == 2


def test_delete_location(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    added = client.post("/api/v1/organisations/me/locations", headers=_headers(auth),
                        json={"name": "Sede"}).json()
    loc_id = added["locations"][0]["id"]
    r = client.delete(f"/api/v1/organisations/me/locations/{loc_id}", headers=_headers(auth))
    assert r.status_code == 200
    assert r.json()["locations"] == []


# ── Documents ──────────────────────────────────────────────────────────

def test_upload_document(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    r = _upload(client, auth, "operating_licence")
    assert r.status_code == 200, r.text
    kinds = {d["kind"] for d in r.json()["documents"]}
    assert "operating_licence" in kinds


def test_upload_rejects_bad_kind(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    r = client.post("/api/v1/organisations/me/documents/nonsense", headers=_headers(auth),
                    files={"file": ("x.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 422


def test_upload_rejects_non_pdf_image(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    r = client.post("/api/v1/organisations/me/documents/insurance", headers=_headers(auth),
                    files={"file": ("x.txt", b"just text", "text/plain")})
    assert r.status_code == 415


# ── Submit ─────────────────────────────────────────────────────────────

def test_submit_requires_documents_and_locations(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    # No docs, no locations yet.
    r = client.post("/api/v1/organisations/me/submit", headers=_headers(auth))
    assert r.status_code == 400
    assert r.json()["detail"]["error"] == "incomplete"


def test_submit_succeeds_when_complete(client):
    auth = _register(client)
    client.post("/api/v1/organisations", headers=_headers(auth), json=_base_org())
    client.post("/api/v1/organisations/me/locations", headers=_headers(auth), json={"name": "Sede"})
    _upload(client, auth, "operating_licence")
    r = client.post("/api/v1/organisations/me/submit", headers=_headers(auth))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "pending_review"
    assert r.json()["submitted_at"] is not None


# ── Auth ───────────────────────────────────────────────────────────────

def test_endpoints_require_auth(client):
    assert client.get("/api/v1/organisations/me").status_code in (401, 403)
    assert client.post("/api/v1/organisations", json=_base_org()).status_code in (401, 403)
