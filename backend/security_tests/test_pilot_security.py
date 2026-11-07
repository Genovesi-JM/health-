"""Stop-ship regressions, using synthetic accounts and temporary storage."""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.config import settings
from app.models import User
from app.health_models import MfaCredential
from app.oauth2 import create_access_token, verify_access_token
from app.services.mfa import generate_secret, totp_now


LEGACY_RESERVED_EMAIL = "genovesi.maria@geovisionops.com"


def create_user(db, role="patient", *, enrolled=False, email="synthetic@example.com"):
    user = User(email=email, password_hash="test-hash:synthetic-password", role=role, is_active=True)
    db.add(user)
    db.flush()
    secret = generate_secret()
    if enrolled:
        db.add(MfaCredential(user_id=user.id, secret=secret, enabled=True))
    db.commit()
    return user, secret


def bearer(user, **claims):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=create_access_token({
        "uid": user.id, "sub": user.email, "role": user.role, **claims,
    }))


def test_reserved_email_registration_is_patient(client, db):
    response = client.post("/auth/register", json={
        "email": LEGACY_RESERVED_EMAIL, "password": "synthetic-password",
        "full_name": "Synthetic Account", "role": "patient", "sector_focus": "health",
    })
    assert response.status_code == 201, response.text
    assert response.json()["user"]["role"] == "patient"
    assert db.query(User).filter(User.email == LEGACY_RESERVED_EMAIL).one().role == "patient"


def test_email_cannot_promote_existing_role(db):
    from app.routers.auth import resolve_role
    user, _ = create_user(db, email=LEGACY_RESERVED_EMAIL)
    assert resolve_role(user) == "patient"


def test_oauth_identity_creation_never_promotes_reserved_email(db):
    from app.routers.auth import _find_or_link_identity
    user = _find_or_link_identity(db, "synthetic-provider", "synthetic-subject", LEGACY_RESERVED_EMAIL)
    assert user.role == "patient"


@pytest.mark.parametrize("role", ["doctor", "nurse", "admin", "corporate_admin", "compliance_reviewer", "pharmacist"])
def test_privileged_login_without_enrollment_has_only_restricted_setup_token(client, db, role):
    user, _ = create_user(db, role)
    response = client.post("/auth/login", json={"email": user.email, "password": "synthetic-password"})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["mfa_enrollment_required"] is True
    assert "access_token" not in data and "refresh_token" not in data
    token = data["enrollment_token"]
    claims = verify_access_token(token)
    assert claims["mfa_enroll"] is True
    assert claims.get("mfa_verified") is not True
    assert "role" not in claims
    from datetime import datetime, timezone
    assert 0 < claims["exp"] - datetime.now(timezone.utc).timestamp() <= 15 * 60
    denied = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert denied.status_code == 403
    assert denied.headers["X-Kaya-Error-Code"] == "mfa_enrollment_required"
    from app.deps import get_current_user, get_optional_user
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException):
        get_current_user(credentials, db)
    assert get_optional_user(credentials, db) is None
    # The token allows enrollment, but cannot itself establish a care session.
    setup = client.post("/auth/mfa/setup", headers={"Authorization": f"Bearer {token}"})
    assert setup.status_code == 200, setup.text
    denied = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert denied.status_code == 403
    assert denied.headers["X-Kaya-Error-Code"] == "mfa_enrollment_required"


def test_incomplete_professional_signup_cannot_create_privileged_account(client, db):
    response = client.post("/auth/register", json={
        "email": "new-clinician@example.com", "password": "synthetic-password",
        "full_name": "Synthetic Clinician", "role": "doctor", "sector_focus": "health",
    })
    assert response.status_code == 422, response.text
    assert db.query(User).filter(User.email == "new-clinician@example.com").first() is None


def test_public_professional_application_keeps_nonclinical_role(client, db):
    from app.health_models import ClinicianCredential, Doctor
    response = client.post("/auth/register", json={
        "email": "applicant@example.com", "password": "synthetic-password",
        "full_name": "Synthetic Clinician", "role": "doctor", "sector_focus": "health",
        "practice_country": "AO", "licence_country": "AO",
        "issuing_authority": "Synthetic professional authority", "licence_number": "SYNTHETIC-001",
        "diploma_country": "AO", "diploma_institution": "Synthetic University",
        "degree_title": "Medicina",
    })
    assert response.status_code == 201, response.text
    data = response.json()
    user = db.query(User).filter(User.email == "applicant@example.com").one()
    assert data["user"]["role"] == user.role == "patient"
    assert verify_access_token(data["access_token"])["role"] == "patient"
    assert db.query(ClinicianCredential).filter_by(user_id=user.id).one().status == "draft"
    assert db.query(Doctor).filter_by(user_id=user.id).one().verification_status == "draft"


def test_mfa_login_challenge_and_assured_token(client, db):
    user, secret = create_user(db, "doctor", enrolled=True)
    login = client.post("/auth/login", json={"email": user.email, "password": "synthetic-password"})
    assert login.status_code == 200
    assert "access_token" not in login.json()
    challenge = client.post("/auth/mfa/challenge", json={
        "mfa_token": login.json()["mfa_token"], "code": totp_now(secret),
    })
    assert challenge.status_code == 200, challenge.text
    token = challenge.json()["access_token"]
    assert verify_access_token(token)["mfa_verified"] is True
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_optional_patient_enrollment_and_challenge_still_work(client, db):
    user, _ = create_user(db)
    token = bearer(user).credentials
    headers = {"Authorization": f"Bearer {token}"}
    setup = client.post("/auth/mfa/setup", headers=headers)
    assert setup.status_code == 200
    verify = client.post("/auth/mfa/verify", headers=headers, json={"code": totp_now(setup.json()["secret"])})
    assert verify.status_code == 200
    assert client.get("/auth/me", headers=headers).status_code == 401
    login = client.post("/auth/login", json={"email": user.email, "password": "synthetic-password"})
    assert login.json()["mfa_required"] is True


@pytest.mark.parametrize("partial", [{}, {"mfa_challenge": True}])
def test_unassured_privileged_tokens_rejected_everywhere(client, db, partial):
    from app.deps import get_current_user, get_optional_user
    user, _ = create_user(db, "admin", enrolled=True)
    credentials = bearer(user, **partial)
    with pytest.raises(HTTPException):
        get_current_user(credentials, db)
    assert get_optional_user(credentials, db) is None
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {credentials.credentials}"}).status_code == 401


def test_mandatory_mfa_cannot_be_disabled(client, db):
    user, secret = create_user(db, "doctor", enrolled=True)
    token = bearer(user, mfa_verified=True).credentials
    response = client.post("/auth/mfa/disable", headers={"Authorization": f"Bearer {token}"}, json={"code": totp_now(secret)})
    assert response.status_code == 403
    assert db.query(MfaCredential).filter(MfaCredential.user_id == user.id).one().enabled is True


def test_inactive_user_cannot_complete_mfa(client, db):
    user, secret = create_user(db, "doctor", enrolled=True)
    token = bearer(user, mfa_challenge=True).credentials
    user.is_active = False
    db.commit()
    response = client.post("/auth/mfa/challenge", json={"mfa_token": token, "code": totp_now(secret)})
    assert response.status_code == 401


def test_privileged_legacy_refresh_requires_new_mfa_login(client, db):
    from app.routers.auth import _create_refresh_token
    user, _ = create_user(db, "admin", enrolled=True)
    refresh = _create_refresh_token(db, user.id)
    response = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert response.status_code == 401
    assert response.headers["X-Kaya-Error-Code"] == "mfa_verification_required"


def test_auth_response_cannot_skip_mfa_for_oauth_or_other_callers(db):
    from app.routers.auth import _build_auth_response
    user, _ = create_user(db, "doctor", enrolled=True)
    with pytest.raises(HTTPException) as caught:
        _build_auth_response(db, user)
    assert caught.value.status_code == 401


@pytest.mark.parametrize("provider", ["google", "microsoft"])
@pytest.mark.parametrize("enrolled,expected_status", [(False, 403), (True, 401)])
def test_oauth_callbacks_cannot_bypass_privileged_mfa(client, db, monkeypatch, provider, enrolled, expected_status):
    from datetime import datetime, timedelta
    from types import SimpleNamespace
    from app.models import OAuthState
    from app.routers import auth

    user, _ = create_user(db, "doctor", enrolled=enrolled)
    db.add(OAuthState(state="synthetic-state", expires_at=datetime.utcnow() + timedelta(minutes=5)))
    db.commit()
    monkeypatch.setattr(settings, f"{provider}_client_id", "synthetic-client")
    monkeypatch.setattr(settings, f"{provider}_client_secret", "synthetic-secret")
    monkeypatch.setattr(auth, "_find_or_link_identity", lambda *a, **kw: user)
    monkeypatch.setattr(auth.requests, "post", lambda *a, **kw: SimpleNamespace(
        status_code=200, json=lambda: {"access_token": "synthetic-provider-token"},
    ))
    monkeypatch.setattr(auth.requests, "get", lambda *a, **kw: SimpleNamespace(
        status_code=200, raise_for_status=lambda: None,
        json=lambda: {"id": "synthetic-subject", "email": user.email, "mail": user.email, "name": "Synthetic"},
    ))
    response = client.get(f"/auth/{provider}/callback?code=synthetic-code&state=synthetic-state")
    assert response.status_code == expected_status, response.text
    assert "access_token" not in response.json()


def test_patient_refresh_without_mfa_remains_available(client, db):
    from app.routers.auth import _create_refresh_token
    user, _ = create_user(db)
    response = client.post("/auth/refresh", json={"refresh_token": _create_refresh_token(db, user.id)})
    assert response.status_code == 200, response.text
    assert verify_access_token(response.json()["access_token"])["uid"] == user.id


@pytest.mark.parametrize("environment", ["production", "prod", " PRODUCTION "])
def test_production_storage_refuses_missing_credentials(monkeypatch, tmp_path, environment):
    from app.services import health_storage
    monkeypatch.setattr(settings, "env", environment)
    local = tmp_path / "must-not-create"
    monkeypatch.setattr(health_storage, "LOCAL_UPLOAD_DIR", local)
    with pytest.raises(RuntimeError, match="durable health storage"):
        health_storage.HealthStorageService()
    assert not local.exists()


def test_development_storage_only_uses_isolated_directory(monkeypatch, tmp_path):
    from app.services import health_storage
    local = tmp_path / "synthetic-uploads"
    monkeypatch.setattr(health_storage, "LOCAL_UPLOAD_DIR", local)
    storage = health_storage.HealthStorageService()
    assert storage._use_local is True
    assert local.is_dir()


@pytest.mark.parametrize("only_key", ["DO_SPACES_KEY", "DO_SPACES_SECRET"])
def test_production_storage_refuses_partial_configuration(monkeypatch, only_key):
    from app.services.health_storage import HealthStorageService
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setenv(only_key, "synthetic-not-a-real-credential")
    with pytest.raises(RuntimeError, match="durable health storage"):
        HealthStorageService()
