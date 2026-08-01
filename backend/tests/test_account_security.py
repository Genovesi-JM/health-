"""Change-email / change-phone / active-sessions tests (§9, §10)."""
from __future__ import annotations

import uuid


def _register(client, role="patient", pw="strong-pass"):
    email = f"acct-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json={
        "email": email, "password": pw, "full_name": "Acct Test",
        "sector_focus": "health", "role": role,
    })
    assert r.status_code == 201, r.text
    return email, r.json()


def _h(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


# ── change-email ───────────────────────────────────────────────────────

def test_change_email_requires_correct_password(client):
    _email, auth = _register(client)
    r = client.post("/auth/change-email", headers=_h(auth),
                    json={"new_email": "new@example.com", "password": "wrong"})
    assert r.status_code == 400


def test_change_email_succeeds(client):
    _email, auth = _register(client)
    new = f"changed-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/change-email", headers=_h(auth),
                    json={"new_email": new, "password": "strong-pass"})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == new
    # Old email no longer logs in; new one does.
    old_login = client.post("/auth/login", json={"email": _email, "password": "strong-pass"})
    assert old_login.status_code == 401
    new_login = client.post("/auth/login", json={"email": new, "password": "strong-pass"})
    assert new_login.status_code == 200


def test_change_email_rejects_taken_address(client):
    taken, _a = _register(client)
    _e2, auth2 = _register(client)
    r = client.post("/auth/change-email", headers=_h(auth2),
                    json={"new_email": taken, "password": "strong-pass"})
    assert r.status_code == 409


# ── change-phone ───────────────────────────────────────────────────────

def test_change_phone_requires_password(client):
    _e, auth = _register(client)
    r = client.post("/auth/change-phone", headers=_h(auth),
                    json={"new_phone": "+244900000000", "password": "wrong"})
    assert r.status_code == 400


def test_change_phone_succeeds(client):
    _e, auth = _register(client)
    r = client.post("/auth/change-phone", headers=_h(auth),
                    json={"new_phone": "+244923456789", "password": "strong-pass"})
    assert r.status_code == 200, r.text
    assert r.json()["phone"] == "+244923456789"


def test_change_phone_rejects_short(client):
    _e, auth = _register(client)
    r = client.post("/auth/change-phone", headers=_h(auth),
                    json={"new_phone": "123", "password": "strong-pass"})
    assert r.status_code == 400


# ── active sessions ────────────────────────────────────────────────────

def test_list_sessions_returns_current(client):
    _e, auth = _register(client)
    r = client.get("/auth/sessions", headers=_h(auth))
    assert r.status_code == 200, r.text
    sessions = r.json()["sessions"]
    assert len(sessions) >= 1
    assert "started_at" in sessions[0] and "expires_at" in sessions[0]


def test_revoke_sessions_revokes_refresh_tokens(client):
    email, auth = _register(client)
    # Second login → a second session/family.
    login2 = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    before = client.get("/auth/sessions", headers=_h(auth)).json()["sessions"]
    assert len(before) >= 2

    r = client.post("/auth/revoke-sessions", headers=_h(auth), json={})
    assert r.status_code == 200
    assert r.json()["revoked_sessions"] >= 2

    # The revoked refresh token can no longer be used to refresh.
    refreshed = client.post("/auth/refresh", json={"refresh_token": login2["refresh_token"]})
    assert refreshed.status_code in (401, 403)


def test_revoke_sessions_can_keep_current(client):
    email, auth = _register(client)
    login2 = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    r = client.post("/auth/revoke-sessions", headers=_h(auth),
                    json={"keep_current_refresh_token": login2["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["kept_current"] is True
    # The kept token still refreshes.
    refreshed = client.post("/auth/refresh", json={"refresh_token": login2["refresh_token"]})
    assert refreshed.status_code == 200


def test_sessions_require_auth(client):
    assert client.get("/auth/sessions").status_code in (401, 403)
    assert client.post("/auth/revoke-sessions").status_code in (401, 403)
