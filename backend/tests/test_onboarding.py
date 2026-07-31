"""Tests for the resumable multi-step onboarding router."""
import uuid


def _register_patient(client) -> dict:
    email = f"patient-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        "/auth/register",
        headers={"X-Forwarded-For": "203.0.113.10"},
        json={
            "email": email,
            "password": "strong-pass",
            "full_name": "Patient Test",
            "sector_focus": "health",
            "role": "patient",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _auth(a):
    return {"Authorization": f"Bearer {a['access_token']}"}


def test_start_creates_fresh_draft(client):
    a = _register_patient(client)
    r = client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["role"] == "patient"
    assert d["current_step"] == 1
    assert d["total_steps"] == 8
    assert d["status"] == "draft"
    assert d["completed_steps"] == []


def test_start_is_idempotent(client):
    a = _register_patient(client)
    first = client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"}).json()
    second = client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"}).json()
    assert first["id"] == second["id"]


def test_start_rejects_unknown_role(client):
    a = _register_patient(client)
    r = client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "wizard"})
    assert r.status_code == 400


def test_step_upsert_persists_and_advances(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    r = client.put(
        "/api/v1/onboarding/steps/1",
        headers=_auth(a),
        json={"data": {"preferred_language": "pt", "communication": "email"}, "completed": True},
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["current_step"] == 2
    assert 1 in d["completed_steps"]
    assert d["data"]["1"]["preferred_language"] == "pt"


def test_autosave_does_not_mark_complete(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    r = client.post(
        "/api/v1/onboarding/save",
        headers=_auth(a),
        json={"step": 3, "data": {"partial": "typing..."}},
    )
    assert r.status_code == 200
    st = client.get("/api/v1/onboarding/status", headers=_auth(a)).json()
    assert 3 not in st["draft"]["completed_steps"]
    assert st["draft"]["data"]["3"]["partial"] == "typing..."


def test_resume_after_reconnect_returns_prior_data(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    client.put(
        "/api/v1/onboarding/steps/1",
        headers=_auth(a),
        json={"data": {"language": "pt"}, "completed": True},
    )
    client.put(
        "/api/v1/onboarding/steps/2",
        headers=_auth(a),
        json={"data": {"full_name": "Ana"}, "completed": True},
    )
    st = client.get("/api/v1/onboarding/status?role=patient", headers=_auth(a)).json()
    assert st["draft"]["current_step"] == 3
    assert st["draft"]["data"]["1"]["language"] == "pt"
    assert st["draft"]["data"]["2"]["full_name"] == "Ana"


def test_cannot_submit_when_steps_missing(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    client.put("/api/v1/onboarding/steps/1", headers=_auth(a), json={"data": {}, "completed": True})
    r = client.post("/api/v1/onboarding/submit", headers=_auth(a))
    assert r.status_code == 400
    payload = r.json()["detail"]
    assert payload["error"] == "incomplete"
    assert set(payload["missing_steps"]) == set(range(2, 9))


def test_submit_freezes_draft(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    for step in range(1, 9):
        client.put(
            f"/api/v1/onboarding/steps/{step}",
            headers=_auth(a),
            json={"data": {"step": step}, "completed": True},
        )
    r = client.post("/api/v1/onboarding/submit", headers=_auth(a))
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "submitted"
    assert d["submitted_at"] is not None

    # Further edits blocked.
    r = client.put(
        "/api/v1/onboarding/steps/1",
        headers=_auth(a),
        json={"data": {"x": 1}, "completed": True},
    )
    assert r.status_code == 409


def test_reset_wipes_prior_state(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    client.put(
        "/api/v1/onboarding/steps/1", headers=_auth(a),
        json={"data": {"x": 1}, "completed": True},
    )
    r = client.post(
        "/api/v1/onboarding/start", headers=_auth(a),
        json={"role": "patient", "reset": True},
    ).json()
    assert r["current_step"] == 1
    assert r["completed_steps"] == []
    assert r["data"] == {}


def test_drafts_are_per_user_isolated(client):
    a = _register_patient(client)
    b = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    client.put(
        "/api/v1/onboarding/steps/1", headers=_auth(a),
        json={"data": {"who": "A"}, "completed": True},
    )
    other = client.get("/api/v1/onboarding/status", headers=_auth(b)).json()
    assert other["draft"] is None


def test_step_beyond_total_rejected(client):
    a = _register_patient(client)
    client.post("/api/v1/onboarding/start", headers=_auth(a), json={"role": "patient"})
    r = client.put(
        "/api/v1/onboarding/steps/99",
        headers=_auth(a),
        json={"data": {}, "completed": True},
    )
    assert r.status_code == 400


def test_unauthenticated_blocked(client):
    r = client.post("/api/v1/onboarding/start", json={"role": "patient"})
    assert r.status_code in (401, 403)
