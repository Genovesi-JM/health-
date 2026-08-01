"""MFA tests: TOTP service + enrollment + login challenge + recovery codes."""
from __future__ import annotations

import time
import uuid

from app.services.mfa import (
    generate_recovery_codes,
    generate_secret,
    hash_recovery_code,
    mfa_is_mandatory,
    provisioning_uri,
    totp_now,
    verify_totp,
)


# ── Unit: TOTP service ─────────────────────────────────────────────────

def test_totp_roundtrip():
    secret = generate_secret()
    assert verify_totp(secret, totp_now(secret)) is True


def test_totp_rejects_wrong_code():
    secret = generate_secret()
    wrong = "000000" if totp_now(secret) != "000000" else "111111"
    assert verify_totp(secret, wrong) is False


def test_totp_tolerates_one_step_skew():
    secret = generate_secret()
    now = time.time()
    prev_step = totp_now(secret, at=now - 30)
    assert verify_totp(secret, prev_step, at=now, window=1) is True


def test_totp_rejects_non_numeric():
    secret = generate_secret()
    assert verify_totp(secret, "abcdef") is False
    assert verify_totp(secret, "") is False


def test_recovery_code_hash_is_normalized():
    codes = generate_recovery_codes(2)
    assert hash_recovery_code(codes[0]) == hash_recovery_code(codes[0].upper())
    assert hash_recovery_code(codes[0]) == hash_recovery_code(codes[0].replace("-", ""))


def test_provisioning_uri_shape():
    uri = provisioning_uri("ABC234", "doc@example.com")
    assert uri.startswith("otpauth://totp/KAYA")
    assert "secret=ABC234" in uri


def test_mandatory_roles():
    assert mfa_is_mandatory("doctor")
    assert mfa_is_mandatory("admin")
    assert not mfa_is_mandatory("patient")


# ── Integration: enrollment + login challenge ──────────────────────────

def _register(client, role="doctor"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    body = {
        "email": email, "password": "strong-pass", "full_name": "MFA Test",
        "sector_focus": "health", "role": role,
    }
    if role in ("doctor", "nurse"):
        body.update({
            "practice_country": "AO", "licence_country": "AO",
            "issuing_authority": "Ordem", "licence_number": f"AO-{uuid.uuid4().hex[:6]}",
            "diploma_country": "AO", "diploma_institution": "UAN",
            "degree_title": "Medicina", "graduation_year": 2020,
        })
    r = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 200}",
    }, json=body)
    assert r.status_code == 201, r.text
    return email, r.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _enroll(client, auth):
    """Full enrollment; returns (secret, recovery_codes)."""
    setup = client.post("/auth/mfa/setup", headers=_headers(auth))
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    verify = client.post("/auth/mfa/verify", headers=_headers(auth),
                         json={"code": totp_now(secret)})
    assert verify.status_code == 200, verify.text
    assert verify.json()["enabled"] is True
    return secret, verify.json()["recovery_codes"]


def test_auth_response_flags_mandatory_for_doctor(client):
    _email, auth = _register(client, role="doctor")
    assert auth["mfa_mandatory"] is True
    assert auth["mfa_enrolled"] is False


def test_auth_response_not_mandatory_for_patient(client):
    email = f"patient-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post("/auth/register", json={
        "email": email, "password": "strong-pass", "full_name": "P",
        "sector_focus": "health", "role": "patient",
    })
    assert r.json()["mfa_mandatory"] is False


def test_setup_verify_enables_mfa(client):
    _email, auth = _register(client)
    secret, codes = _enroll(client, auth)
    assert len(codes) == 10


def test_verify_rejects_bad_code(client):
    _email, auth = _register(client)
    client.post("/auth/mfa/setup", headers=_headers(auth))
    r = client.post("/auth/mfa/verify", headers=_headers(auth), json={"code": "000000"})
    # 000000 is astronomically unlikely to be valid; if it happens to match,
    # the test is flaky ~1/1e6 — acceptable.
    assert r.status_code in (401,)


def test_login_returns_challenge_when_mfa_enabled(client):
    email, auth = _register(client)
    _enroll(client, auth)
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"})
    assert login.status_code == 200, login.text
    body = login.json()
    assert body.get("mfa_required") is True
    assert body.get("mfa_token")
    assert "access_token" not in body


def test_challenge_completes_login_with_totp(client):
    email, auth = _register(client)
    secret, _codes = _enroll(client, auth)
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    r = client.post("/auth/mfa/challenge", json={
        "mfa_token": login["mfa_token"], "code": totp_now(secret),
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["mfa_enrolled"] is True


def test_challenge_completes_with_recovery_code_single_use(client):
    email, auth = _register(client)
    _secret, codes = _enroll(client, auth)
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    # First use of a recovery code works.
    r1 = client.post("/auth/mfa/challenge", json={
        "mfa_token": login["mfa_token"], "code": codes[0],
    })
    assert r1.status_code == 200, r1.text
    # Second use of the SAME recovery code fails.
    login2 = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    r2 = client.post("/auth/mfa/challenge", json={
        "mfa_token": login2["mfa_token"], "code": codes[0],
    })
    assert r2.status_code == 401


def test_challenge_rejects_bad_code(client):
    email, auth = _register(client)
    _enroll(client, auth)
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    r = client.post("/auth/mfa/challenge", json={
        "mfa_token": login["mfa_token"], "code": "999999",
    })
    assert r.status_code == 401


def test_disable_requires_valid_code(client):
    _email, auth = _register(client)
    secret, _codes = _enroll(client, auth)
    bad = client.post("/auth/mfa/disable", headers=_headers(auth), json={"code": "000000"})
    assert bad.status_code == 401
    good = client.post("/auth/mfa/disable", headers=_headers(auth), json={"code": totp_now(secret)})
    assert good.status_code == 200
    assert good.json()["enabled"] is False


def test_login_unchanged_for_non_enrolled_user(client):
    email, _auth = _register(client, role="patient")
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"})
    assert login.status_code == 200
    body = login.json()
    assert "mfa_required" not in body
    assert body["access_token"]


def test_regenerate_recovery_codes_invalidates_old(client):
    email, auth = _register(client)
    secret, old_codes = _enroll(client, auth)
    regen = client.post("/auth/mfa/recovery-codes", headers=_headers(auth),
                        json={"code": totp_now(secret)})
    assert regen.status_code == 200
    new_codes = regen.json()["recovery_codes"]
    assert set(new_codes).isdisjoint(set(old_codes))
    # An old code should no longer work on challenge.
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    r = client.post("/auth/mfa/challenge", json={"mfa_token": login["mfa_token"], "code": old_codes[0]})
    assert r.status_code == 401


def test_setup_conflicts_when_already_enabled(client):
    _email, auth = _register(client)
    _enroll(client, auth)
    r = client.post("/auth/mfa/setup", headers=_headers(auth))
    assert r.status_code == 409


# ── Security: MFA challenge token must NOT work as a full bearer token ──────

def test_mfa_challenge_token_cannot_access_protected_endpoints(client):
    """Regression: the partial-auth mfa_token from /auth/login must be
    rejected by get_current_user, or MFA is trivially bypassable."""
    email, auth = _register(client)
    secret, _codes = _enroll(client, auth)
    login = client.post("/auth/login", json={"email": email, "password": "strong-pass"}).json()
    challenge_token = login["mfa_token"]
    hdr = {"Authorization": f"Bearer {challenge_token}"}

    # A protected endpoint gated by get_current_user must reject it.
    r = client.get("/api/v1/caregiver/dependants", headers=hdr)
    assert r.status_code == 401, "MFA challenge token was accepted as full auth!"

    # /auth/me must also refuse it (no profile leak).
    r2 = client.get("/auth/me", headers=hdr)
    assert r2.status_code == 401

    # And the mfa/setup-style endpoints too.
    r3 = client.get("/auth/mfa/status", headers=hdr)
    assert r3.status_code == 401
