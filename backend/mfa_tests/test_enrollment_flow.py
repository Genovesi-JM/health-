"""End-to-end test of the clinician MFA enrollment flow (operational app).

A mandatory-MFA role signs in for the first time: login yields an enrollment
token (not a session), which unlocks ONLY /auth/mfa/setup and /auth/mfa/verify;
a valid TOTP enables MFA and returns a full session; the enrollment token is
rejected everywhere else; and the next login uses the normal MFA challenge.

Self-contained: builds the real factory app against a throwaway SQLite DB.
"""
from __future__ import annotations

import os
import tempfile

os.environ.setdefault("ENV", "dev")
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mktemp(suffix='.db')}"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest
from fastapi.testclient import TestClient

from app.factory import create_app
from app.database import SessionLocal
from app import models
from app.utils import hash_password
from app.services.mfa import totp_now

app = create_app()
client = TestClient(app)

DOCTOR_EMAIL = "mfaflow.doctor@health.com"
PASSWORD = "Demo@1234"


@pytest.fixture(autouse=True)
def _doctor():
    db = SessionLocal()
    try:
        u = db.query(models.User).filter(models.User.email == DOCTOR_EMAIL).first()
        if not u:
            u = models.User(email=DOCTOR_EMAIL, password_hash=hash_password(PASSWORD),
                            role="doctor", is_active=True)
            db.add(u)
        else:
            u.password_hash = hash_password(PASSWORD)
            u.role = "doctor"
        db.commit()
        # clear any prior MFA
        from app.health_models import MfaCredential, MfaRecoveryCode
        db.query(MfaRecoveryCode).filter(MfaRecoveryCode.user_id == u.id).delete()
        db.query(MfaCredential).filter(MfaCredential.user_id == u.id).delete()
        db.commit()
    finally:
        db.close()


def _login():
    return client.post("/auth/login", json={"email": DOCTOR_EMAIL, "password": PASSWORD})


def test_clinician_login_requires_enrollment():
    r = _login()
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("mfa_enrollment_required") is True
    assert body.get("enrollment_token")
    assert "access_token" not in body        # no session before MFA


def test_enrollment_token_is_scoped_to_setup_and_verify():
    token = _login().json()["enrollment_token"]
    h = {"Authorization": f"Bearer {token}"}
    # allowed:
    assert client.post("/auth/mfa/setup", headers=h).status_code == 200
    # rejected elsewhere:
    assert client.get("/me", headers=h).status_code == 401
    assert client.get("/api/v1/doctor/dashboard", headers=h).status_code == 401


def test_full_enrollment_yields_session_and_access():
    token = _login().json()["enrollment_token"]
    h = {"Authorization": f"Bearer {token}"}
    setup = client.post("/auth/mfa/setup", headers=h).json()
    code = totp_now(setup["secret"])
    verify = client.post("/auth/mfa/verify", json={"code": code}, headers=h)
    assert verify.status_code == 200, verify.text
    body = verify.json()
    assert body["enabled"] is True
    assert len(body["recovery_codes"]) == 10
    session = body.get("session")
    assert session and session.get("access_token")

    # The issued session is MFA-verified and can reach protected routes (both are
    # guarded by get_current_user + assert_mfa_session; the enrollment token could
    # not reach either).
    sh = {"Authorization": f"Bearer {session['access_token']}"}
    assert client.get("/me", headers=sh).status_code == 200
    status = client.get("/auth/mfa/status", headers=sh)
    assert status.status_code == 200
    assert status.json()["enabled"] is True


def test_wrong_totp_is_rejected():
    token = _login().json()["enrollment_token"]
    h = {"Authorization": f"Bearer {token}"}
    client.post("/auth/mfa/setup", headers=h)
    r = client.post("/auth/mfa/verify", json={"code": "000000"}, headers=h)
    assert r.status_code == 401


def test_second_login_uses_challenge_not_enrollment():
    # enroll first
    token = _login().json()["enrollment_token"]
    h = {"Authorization": f"Bearer {token}"}
    setup = client.post("/auth/mfa/setup", headers=h).json()
    client.post("/auth/mfa/verify", json={"code": totp_now(setup["secret"])}, headers=h)
    # now a fresh login must ask for a challenge, not enrollment
    body = _login().json()
    assert body.get("mfa_required") is True
    assert body.get("mfa_token")
    assert not body.get("mfa_enrollment_required")
