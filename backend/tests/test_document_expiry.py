"""Tests for the document-expiry scanner and admin endpoints."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from app.database import SessionLocal
from app.health_models import (
    ClinicianCredential,
    DocumentExpiryReminder,
    Notification,
)
from app.services.document_expiry import (
    DEFAULT_THRESHOLDS,
    scan_credentials,
)


# ── Fixtures / helpers ─────────────────────────────────────────────────

def _make_credential(
    licence_expiry: str,
    status: str = "verified",
    *,
    user_id: str = "user-abc",
) -> str:
    """Insert one credential directly and return its id."""
    db = SessionLocal()
    try:
        cred = ClinicianCredential(
            user_id=user_id,
            profession="doctor",
            legal_name="Test Doctor",
            practice_country="AO",
            licence_country="AO",
            issuing_authority="Ordem",
            licence_number=f"LIC-{uuid.uuid4().hex[:6]}",
            licence_expiry_date=licence_expiry,
            diploma_country="AO",
            diploma_institution="Universidade Teste",
            degree_title="Medicina",
            status=status,
        )
        db.add(cred)
        db.commit()
        return cred.id
    finally:
        db.close()


def _register_admin_or_login(client) -> str:
    """Grab an admin auth token — register a fresh admin via seed helper.

    The test DB is torn down per session but users can be created via
    the register endpoint for non-admin roles. Admin is seeded, so log in.
    """
    r = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _register_user_for(credential_user_id: str) -> None:
    """Insert a bare User row so the ClinicianCredential FK is satisfied
    (Notification is FK'd to users; the scanner writes a notification per
    credential)."""
    from app.models import User
    from app.utils import hash_password
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.id == credential_user_id).first():
            db.add(User(
                id=credential_user_id,
                email=f"test-{credential_user_id[:8]}@example.com",
                password_hash=hash_password("x"),
                role="doctor",
                is_active=True,
            ))
            db.commit()
    finally:
        db.close()


# ── Scanner: threshold firing ──────────────────────────────────────────

def test_scanner_fires_no_reminder_when_far_from_expiry(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential((date.today() + timedelta(days=200)).isoformat(), user_id=user_id)

    db = SessionLocal()
    try:
        result = scan_credentials(db, today=date.today())
        assert result.reminders_fired == 0
        assert result.credentials_expired == 0
    finally:
        db.close()


def test_scanner_fires_at_60_day_threshold(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    cid = _make_credential((date.today() + timedelta(days=55)).isoformat(), user_id=user_id)

    db = SessionLocal()
    try:
        result = scan_credentials(db, today=date.today())
        assert result.reminders_fired == 2  # 90 and 60 both fired (55 <= both)
        reminders = db.query(DocumentExpiryReminder).filter(
            DocumentExpiryReminder.entity_id == cid
        ).all()
        thresholds = sorted(r.threshold_days for r in reminders)
        assert thresholds == [60, 90]
    finally:
        db.close()


def test_scanner_writes_notification_for_each_reminder(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential((date.today() + timedelta(days=13)).isoformat(), user_id=user_id)

    db = SessionLocal()
    try:
        result = scan_credentials(db, today=date.today())
        # Days_remaining = 13, so thresholds 90/60/30/14 all fire (13 <= each).
        assert result.notifications_written == 4
        assert result.reminders_fired == 4
        notifs = db.query(Notification).filter(
            Notification.user_id == user_id
        ).all()
        assert len(notifs) == 4
        # The 14-day one should be typed warning; the 90/60/30 are info.
        types_seen = {n.type for n in notifs}
        assert "warning" in types_seen
        assert "info" in types_seen
    finally:
        db.close()


def test_scanner_is_idempotent_within_window(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential((date.today() + timedelta(days=40)).isoformat(), user_id=user_id)

    db = SessionLocal()
    try:
        first = scan_credentials(db, today=date.today())
        second = scan_credentials(db, today=date.today())
        assert first.reminders_fired > 0
        assert second.reminders_fired == 0, "Second scan must not re-fire same-threshold reminders"
    finally:
        db.close()


def test_scanner_expires_verified_credential_on_due_date(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    cid = _make_credential(
        date.today().isoformat(),
        status="verified",
        user_id=user_id,
    )
    db = SessionLocal()
    try:
        result = scan_credentials(db, today=date.today())
        assert result.credentials_expired == 1
        cred = db.query(ClinicianCredential).filter(ClinicianCredential.id == cid).first()
        assert cred.status == "expired"
    finally:
        db.close()


def test_scanner_does_not_expire_non_verified(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    cid = _make_credential(
        date.today().isoformat(),
        status="pending_review",
        user_id=user_id,
    )
    db = SessionLocal()
    try:
        result = scan_credentials(db, today=date.today())
        assert result.credentials_expired == 0
        cred = db.query(ClinicianCredential).filter(ClinicianCredential.id == cid).first()
        assert cred.status == "pending_review"
    finally:
        db.close()


def test_scanner_skips_credentials_without_expiry(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential(licence_expiry="", user_id=user_id)  # empty expiry
    db = SessionLocal()
    try:
        result = scan_credentials(db, today=date.today())
        # Scanned includes the one row (it has a non-None empty string), but
        # the parser returns None so no reminders fire.
        assert result.reminders_fired == 0
    finally:
        db.close()


# ── Endpoints ──────────────────────────────────────────────────────────

def test_scan_endpoint_returns_summary(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential((date.today() + timedelta(days=5)).isoformat(), user_id=user_id)
    token = _register_admin_or_login(client)
    r = client.post("/api/v1/compliance/expiry/scan", headers=_headers(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body.keys()) >= {"scanned", "reminders_fired", "notifications_written", "credentials_expired"}
    assert body["reminders_fired"] >= 1


def test_scan_endpoint_rejects_non_admin(client):
    r = client.post("/api/v1/compliance/expiry/scan")
    assert r.status_code in (401, 403)


def test_upcoming_endpoint_lists_soonest_first(client):
    # One credential per user (unique constraint on user_id).
    for days_out in (45, 5, 200):
        uid = f"user-{uuid.uuid4().hex[:8]}"
        _register_user_for(uid)
        _make_credential((date.today() + timedelta(days=days_out)).isoformat(), user_id=uid)

    token = _register_admin_or_login(client)
    r = client.get(
        "/api/v1/compliance/expiry/upcoming?days=90",
        headers=_headers(token),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # Only the two credentials within 90 days should be returned.
    included_expiries = [item["expiry_date"] for item in body["items"]]
    assert len(included_expiries) >= 2
    # Sorted ascending — earliest first.
    assert included_expiries == sorted(included_expiries)


def test_upcoming_endpoint_computes_days_remaining(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential((date.today() + timedelta(days=7)).isoformat(), user_id=user_id)
    token = _register_admin_or_login(client)
    r = client.get(
        "/api/v1/compliance/expiry/upcoming?days=30",
        headers=_headers(token),
    ).json()
    match = [i for i in r["items"] if i["days_remaining"] == 7]
    assert match, f"Expected an item with days_remaining=7, got {r['items']}"


# ── Notification content ───────────────────────────────────────────────

def test_expired_notification_is_error_typed_and_mentions_expiry(client):
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    _register_user_for(user_id)
    _make_credential(date.today().isoformat(), user_id=user_id)
    db = SessionLocal()
    try:
        scan_credentials(db, today=date.today())
        # Zero-day notification.
        due_notifs = [
            n for n in db.query(Notification).filter(Notification.user_id == user_id).all()
            if "expirou" in n.message.lower()
        ]
        assert due_notifs, "Expected an 'expirou' notification for a same-day expiry"
        assert due_notifs[0].type == "error"
    finally:
        db.close()
