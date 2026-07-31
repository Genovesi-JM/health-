"""Compliance dashboard: cases listing + detail endpoint tests."""
from __future__ import annotations

import uuid


def _register(client, role="doctor", diploma_country="AO", country="AO"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json={
        "email": email, "password": "strong-pass", "full_name": f"Test {role.title()}",
        "sector_focus": "health", "role": role,
        "practice_country": country, "licence_country": country,
        "issuing_authority": "Ordem Profissional",
        "licence_number": f"{country}-{uuid.uuid4().hex[:6]}",
        "diploma_country": diploma_country,
        "diploma_institution": "Universidade Teste",
        "degree_title": "Medicina" if role == "doctor" else "Enfermagem",
        "graduation_year": 2020,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _admin(client):
    r = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    return r.json()


def _submit(client, auth):
    for kind in ("professional_card", "diploma"):
        client.post(
            f"/api/v1/credentials/me/evidence/{kind}",
            headers=_headers(auth),
            files={"file": (f"{kind}.pdf", b"%PDF-1.4\nx", "application/pdf")},
        )
    return client.post("/api/v1/credentials/me/submit", headers=_headers(auth)).json()


# ── Listing ────────────────────────────────────────────────────────────

def test_list_cases_returns_paginated_shape(client):
    _register(client)  # ensure at least one case exists
    admin = _admin(client)
    r = client.get("/api/v1/compliance/cases", headers=_headers(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body.keys()) == {"total", "limit", "offset", "items"}
    assert isinstance(body["items"], list)
    assert body["total"] >= 1


def test_list_cases_filter_by_status(client):
    admin = _admin(client)
    doc = _register(client)
    _submit(client, doc)  # -> status "pending_review"
    r = client.get("/api/v1/compliance/cases?status=pending_review", headers=_headers(admin)).json()
    assert all(item["status"] == "pending_review" for item in r["items"])


def test_list_cases_filter_by_profession(client):
    admin = _admin(client)
    _register(client, role="doctor")
    _register(client, role="nurse")
    doctors = client.get("/api/v1/compliance/cases?profession=doctor", headers=_headers(admin)).json()
    nurses  = client.get("/api/v1/compliance/cases?profession=nurse",  headers=_headers(admin)).json()
    assert all(i["profession"] == "doctor" for i in doctors["items"])
    assert all(i["profession"] == "nurse"  for i in nurses["items"])


def test_list_cases_filter_by_country_is_case_insensitive(client):
    admin = _admin(client)
    _register(client, country="AO")
    upper = client.get("/api/v1/compliance/cases?country=AO", headers=_headers(admin)).json()
    lower = client.get("/api/v1/compliance/cases?country=ao", headers=_headers(admin)).json()
    assert upper["total"] == lower["total"]


def test_list_cases_search_matches_name(client):
    admin = _admin(client)
    doc = _register(client)
    # Look up the case to grab its stored legal name (from registration payload).
    listed = client.get("/api/v1/compliance/cases", headers=_headers(admin)).json()
    name_fragment = listed["items"][0]["legal_name"].split()[0]
    r = client.get(f"/api/v1/compliance/cases?search={name_fragment}", headers=_headers(admin)).json()
    assert r["total"] >= 1


def test_list_cases_pagination_respects_limit_offset(client):
    admin = _admin(client)
    for _ in range(3):
        _register(client)
    page1 = client.get("/api/v1/compliance/cases?limit=2&offset=0", headers=_headers(admin)).json()
    page2 = client.get("/api/v1/compliance/cases?limit=2&offset=2", headers=_headers(admin)).json()
    assert len(page1["items"]) == 2
    ids1 = {i["credential_id"] for i in page1["items"]}
    ids2 = {i["credential_id"] for i in page2["items"]}
    assert ids1.isdisjoint(ids2)


def test_list_cases_rejects_unauthenticated(client):
    r = client.get("/api/v1/compliance/cases")
    assert r.status_code in (401, 403)


# ── Detail ─────────────────────────────────────────────────────────────

def test_detail_endpoint_returns_full_shape(client):
    admin = _admin(client)
    doc = _register(client)
    case = _submit(client, doc)
    r = client.get(f"/api/v1/compliance/cases/{case['id']}/detail", headers=_headers(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("credential_id", "user_id", "profession", "status",
                "entered", "extracted_by_provider", "evidence",
                "provider_checks", "transitions", "allowed_next_statuses"):
        assert key in body, f"missing key {key}"


def test_detail_endpoint_includes_uploaded_evidence(client):
    admin = _admin(client)
    doc = _register(client)
    case = _submit(client, doc)
    body = client.get(f"/api/v1/compliance/cases/{case['id']}/detail", headers=_headers(admin)).json()
    kinds = {e["kind"] for e in body["evidence"]}
    assert {"professional_card", "diploma"} <= kinds


def test_detail_endpoint_includes_transitions_after_action(client):
    admin = _admin(client)
    doc = _register(client)
    case = _submit(client, doc)
    client.post(
        f"/api/v1/compliance/cases/{case['id']}/request-information",
        headers=_headers(admin),
        json={"reason_text": "Missing licence expiry"},
    )
    body = client.get(f"/api/v1/compliance/cases/{case['id']}/detail", headers=_headers(admin)).json()
    assert len(body["transitions"]) >= 1
    assert body["transitions"][-1]["new_status"] == "action_required"


def test_detail_endpoint_404_on_unknown(client):
    admin = _admin(client)
    r = client.get("/api/v1/compliance/cases/does-not-exist/detail", headers=_headers(admin))
    assert r.status_code == 404


def test_detail_endpoint_rejects_unauthenticated(client):
    r = client.get("/api/v1/compliance/cases/x/detail")
    assert r.status_code in (401, 403)
