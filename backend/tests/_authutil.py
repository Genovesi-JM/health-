"""Shared test auth helper.

Clinician/admin roles require completed MFA. These helpers log in and complete
MFA transparently (first-time enrollment, or the challenge if already enrolled)
so tests get a working session dict with an ``access_token``.
"""
from __future__ import annotations

import app.database as _db
from app.models import User
from app.health_models import MfaCredential
from app.services.mfa import totp_now


def login_with_mfa(client, email: str, password: str) -> dict:
    """Return the full auth response (dict with access_token) for any role."""
    data = client.post("/auth/login", json={"email": email, "password": password}).json()

    if data.get("mfa_enrollment_required"):
        h = {"Authorization": f"Bearer {data['enrollment_token']}"}
        secret = client.post("/auth/mfa/setup", headers=h).json()["secret"]
        v = client.post("/auth/mfa/verify", json={"code": totp_now(secret)}, headers=h).json()
        return v["session"]

    if data.get("mfa_required"):
        s = _db.SessionLocal()
        try:
            u = s.query(User).filter(User.email == email).first()
            cred = s.query(MfaCredential).filter(MfaCredential.user_id == u.id).first()
            code = totp_now(cred.secret)
        finally:
            s.close()
        return client.post("/auth/mfa/challenge",
                           json={"mfa_token": data["mfa_token"], "code": code}).json()

    return data


def complete_enrollment(client, data: dict) -> dict:
    """Given a register/login response, return a full session dict — completing
    first-time MFA enrollment when the response asks for it."""
    if data.get("mfa_enrollment_required"):
        h = {"Authorization": f"Bearer {data['enrollment_token']}"}
        secret = client.post("/auth/mfa/setup", headers=h).json()["secret"]
        v = client.post("/auth/mfa/verify", json={"code": totp_now(secret)}, headers=h).json()
        return v["session"]
    return data


def auth_headers(client, email: str, password: str) -> dict:
    """Authorization header dict for a fully-authenticated (MFA-complete) session."""
    return {"Authorization": f"Bearer {login_with_mfa(client, email, password)['access_token']}"}
