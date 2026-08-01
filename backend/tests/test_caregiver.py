"""Caregiver + dependant management tests (§6)."""
from __future__ import annotations

import uuid
from datetime import date


def _register(client, role="patient"):
    email = f"cg-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json={
        "email": email, "password": "strong-pass", "full_name": "Caregiver",
        "sector_focus": "health", "role": role,
    })
    assert r.status_code == 201, r.text
    return r.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _adult_dob() -> str:
    return f"{date.today().year - 40}-01-01"


def _minor_dob() -> str:
    return f"{date.today().year - 8}-01-01"


def _add(client, auth, **overrides):
    body = {
        "full_name": "Dependente Teste",
        "caregiver_type": "authorised_family",
        "relationship": "irmão",
        "date_of_birth": _adult_dob(),
    }
    body.update(overrides)
    return client.post("/api/v1/caregiver/dependants", headers=_headers(auth), json=body)


# ── Create ─────────────────────────────────────────────────────────────

def test_add_dependant(client):
    auth = _register(client)
    r = _add(client, auth)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["caregiver_type"] == "authorised_family"
    assert body["status"] == "active"


def test_bad_caregiver_type_rejected(client):
    auth = _register(client)
    r = _add(client, auth, caregiver_type="overlord")
    assert r.status_code == 422


def test_scopes_default_off(client):
    auth = _register(client)
    body = _add(client, auth).json()
    assert body["scopes"] == {
        "view_appointments": False, "view_prescriptions": False,
        "receive_reminders": False, "act_on_behalf": False,
    }


def test_minor_is_detected(client):
    auth = _register(client)
    body = _add(client, auth, caregiver_type="parent_minor", date_of_birth=_minor_dob()).json()
    assert body["is_minor"] is True


# ── Act-on-behalf gating ───────────────────────────────────────────────

def test_act_on_behalf_forced_off_for_minor_at_creation(client):
    auth = _register(client)
    body = _add(client, auth, caregiver_type="parent_minor",
                date_of_birth=_minor_dob(), can_act_on_behalf=True).json()
    # No evidence yet → the scope must be off despite the request.
    assert body["scopes"]["act_on_behalf"] is False


def test_act_on_behalf_blocked_without_evidence(client):
    auth = _register(client)
    link = _add(client, auth, caregiver_type="legal_guardian", date_of_birth=_minor_dob()).json()
    r = client.patch(
        f"/api/v1/caregiver/dependants/{link['id']}/scopes",
        headers=_headers(auth), json={"can_act_on_behalf": True},
    )
    assert r.status_code == 409


def test_act_on_behalf_allowed_after_evidence(client):
    auth = _register(client)
    link = _add(client, auth, caregiver_type="legal_guardian", date_of_birth=_minor_dob()).json()
    up = client.post(
        f"/api/v1/caregiver/dependants/{link['id']}/evidence",
        headers=_headers(auth),
        files={"file": ("guardianship.pdf", b"%PDF-1.4\nproof", "application/pdf")},
    )
    assert up.status_code == 200, up.text
    assert up.json()["has_evidence"] is True
    r = client.patch(
        f"/api/v1/caregiver/dependants/{link['id']}/scopes",
        headers=_headers(auth), json={"can_act_on_behalf": True},
    )
    assert r.status_code == 200
    assert r.json()["scopes"]["act_on_behalf"] is True


def test_non_minor_authorised_family_can_toggle_view_scopes_freely(client):
    auth = _register(client)
    link = _add(client, auth).json()  # authorised_family, adult
    r = client.patch(
        f"/api/v1/caregiver/dependants/{link['id']}/scopes",
        headers=_headers(auth),
        json={"can_view_appointments": True, "can_receive_reminders": True},
    )
    assert r.status_code == 200
    s = r.json()["scopes"]
    assert s["view_appointments"] is True
    assert s["receive_reminders"] is True
    assert s["view_prescriptions"] is False  # untouched


# ── Evidence upload validation ─────────────────────────────────────────

def test_evidence_rejects_non_pdf_image(client):
    auth = _register(client)
    link = _add(client, auth).json()
    r = client.post(
        f"/api/v1/caregiver/dependants/{link['id']}/evidence",
        headers=_headers(auth),
        files={"file": ("x.txt", b"plain text", "text/plain")},
    )
    assert r.status_code == 415


# ── Revoke + history ───────────────────────────────────────────────────

def test_revoke_clears_scopes_and_audits(client):
    auth = _register(client)
    link = _add(client, auth).json()
    client.patch(f"/api/v1/caregiver/dependants/{link['id']}/scopes",
                 headers=_headers(auth), json={"can_view_appointments": True})
    r = client.post(f"/api/v1/caregiver/dependants/{link['id']}/revoke", headers=_headers(auth))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "revoked"
    assert body["scopes"]["view_appointments"] is False

    hist = client.get(f"/api/v1/caregiver/dependants/{link['id']}/history", headers=_headers(auth)).json()
    types = [e["event_type"] for e in hist]
    assert "created" in types
    assert "access_revoked" in types


def test_invite_guardian_audits(client):
    auth = _register(client)
    link = _add(client, auth).json()
    r = client.post(f"/api/v1/caregiver/dependants/{link['id']}/invite",
                    headers=_headers(auth), json={"guardian_email": "other@example.com"})
    assert r.status_code == 200
    hist = client.get(f"/api/v1/caregiver/dependants/{link['id']}/history", headers=_headers(auth)).json()
    invited = [e for e in hist if e["event_type"] == "guardian_invited"]
    assert invited and invited[0]["detail"] == "other@example.com"


# ── Isolation + auth ───────────────────────────────────────────────────

def test_dependants_are_per_caregiver_isolated(client):
    a = _register(client)
    b = _register(client)
    _add(client, a)
    other = client.get("/api/v1/caregiver/dependants", headers=_headers(b)).json()
    assert other == []


def test_cannot_touch_another_caregivers_dependant(client):
    a = _register(client)
    b = _register(client)
    link = _add(client, a).json()
    r = client.post(f"/api/v1/caregiver/dependants/{link['id']}/revoke", headers=_headers(b))
    assert r.status_code == 404


def test_endpoints_require_auth(client):
    assert client.get("/api/v1/caregiver/dependants").status_code in (401, 403)
    assert client.post("/api/v1/caregiver/dependants", json={}).status_code in (401, 403)


# ── Scope-enforced data access (Phase 6) ───────────────────────────────

def test_appointments_blocked_without_scope(client):
    auth = _register(client)
    link = _add(client, auth).json()  # view_appointments defaults False
    r = client.get(f"/api/v1/caregiver/dependants/{link['id']}/appointments", headers=_headers(auth))
    assert r.status_code == 403


def test_appointments_allowed_with_scope(client):
    auth = _register(client)
    link = _add(client, auth).json()
    client.patch(f"/api/v1/caregiver/dependants/{link['id']}/scopes",
                 headers=_headers(auth), json={"can_view_appointments": True})
    r = client.get(f"/api/v1/caregiver/dependants/{link['id']}/appointments", headers=_headers(auth))
    assert r.status_code == 200
    # Dependant has no linked account → empty list, but access is granted.
    assert r.json()["items"] == []


def test_prescriptions_blocked_without_scope(client):
    auth = _register(client)
    link = _add(client, auth).json()
    r = client.get(f"/api/v1/caregiver/dependants/{link['id']}/prescriptions", headers=_headers(auth))
    assert r.status_code == 403


def test_prescriptions_allowed_with_scope(client):
    auth = _register(client)
    link = _add(client, auth).json()
    client.patch(f"/api/v1/caregiver/dependants/{link['id']}/scopes",
                 headers=_headers(auth), json={"can_view_prescriptions": True})
    r = client.get(f"/api/v1/caregiver/dependants/{link['id']}/prescriptions", headers=_headers(auth))
    assert r.status_code == 200


def test_scoped_access_blocked_after_revoke(client):
    auth = _register(client)
    link = _add(client, auth).json()
    client.patch(f"/api/v1/caregiver/dependants/{link['id']}/scopes",
                 headers=_headers(auth), json={"can_view_appointments": True})
    # Revoke → even a previously-granted scope must now 403.
    client.post(f"/api/v1/caregiver/dependants/{link['id']}/revoke", headers=_headers(auth))
    r = client.get(f"/api/v1/caregiver/dependants/{link['id']}/appointments", headers=_headers(auth))
    assert r.status_code == 403


def test_scoped_access_isolated_across_caregivers(client):
    a = _register(client)
    b = _register(client)
    link = _add(client, a).json()
    client.patch(f"/api/v1/caregiver/dependants/{link['id']}/scopes",
                 headers=_headers(a), json={"can_view_appointments": True})
    # Caregiver B cannot read caregiver A's dependant.
    r = client.get(f"/api/v1/caregiver/dependants/{link['id']}/appointments", headers=_headers(b))
    assert r.status_code == 404
