"""Public contact-form endpoint tests."""
from __future__ import annotations


def test_submit_contact_stores_message(client):
    r = client.post("/api/v1/contact", json={
        "name": "Ana Cliente", "email": "ana@example.com",
        "subject": "Suporte geral", "message": "Preciso de ajuda com a minha conta.",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["received"] is True
    assert body["id"]


def test_submit_contact_validates_email(client):
    r = client.post("/api/v1/contact", json={
        "name": "X", "email": "not-an-email", "message": "hi",
    })
    assert r.status_code == 422


def test_submit_contact_requires_message(client):
    r = client.post("/api/v1/contact", json={
        "name": "X", "email": "x@example.com", "message": "",
    })
    assert r.status_code == 422


def test_admin_can_list_contact_messages(client):
    client.post("/api/v1/contact", json={
        "name": "Bravo", "email": "bravo@example.com",
        "subject": "Parceria", "message": "Queremos ser parceiros.",
    })
    admin = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"}).json()
    r = client.get("/api/v1/contact/admin", headers={"Authorization": f"Bearer {admin['access_token']}"})
    assert r.status_code == 200, r.text
    msgs = r.json()
    assert any(m["email"] == "bravo@example.com" for m in msgs)


def test_contact_admin_requires_auth(client):
    assert client.get("/api/v1/contact/admin").status_code in (401, 403)
