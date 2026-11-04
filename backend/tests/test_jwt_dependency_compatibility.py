"""Signed-token behavior retained during the python-jose to PyJWT migration."""
import base64
import hashlib
import hmac
import json
import time
from datetime import timedelta

from fastapi import HTTPException
import jwt
import pytest

from app.config import settings
from app.oauth2 import create_access_token, verify_access_token


@pytest.fixture(autouse=True)
def synthetic_settings(monkeypatch):
    monkeypatch.setattr(settings, 'secret_key', 'synthetic-jwt-migration-secret-at-least-32-bytes')
    monkeypatch.setattr(settings, 'algorithm', 'HS256')


def test_minted_access_and_mfa_claims_keep_signature_expiry_and_types():
    before = time.time()
    data = {'sub': 'synthetic@example.test', 'uid': 'synthetic-id', 'role': 'doctor',
            'mfa_verified': True, 'mfa_enroll': False, 'session_version': 3}
    token = create_access_token(data, timedelta(minutes=5))
    assert isinstance(token, str)
    claims = verify_access_token(token)
    assert {key: claims[key] for key in data} == data
    assert before + 299 <= claims['exp'] <= time.time() + 300
    assert 'exp' not in data


def test_legacy_hs256_wire_token_remains_accepted():
    # python-jose emitted standard HS256 compact JWTs; construct that wire format
    # independently so compatibility does not reinstall the removed dependency.
    def part(value):
        return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).rstrip(b'=')
    claims = {'sub': 'legacy@example.test', 'uid': 'legacy-id', 'exp': int(time.time()) + 300}
    signed = part({'typ': 'JWT', 'alg': 'HS256'}) + b'.' + part(claims)
    signature = base64.urlsafe_b64encode(hmac.new(settings.secret_key.encode(), signed, hashlib.sha256).digest()).rstrip(b'=')
    assert verify_access_token((signed + b'.' + signature).decode()) == claims


@pytest.mark.parametrize('claims', [
    {'exp': 1}, {'exp': 'not-a-number'}, {'nbf': 99999999999}, {'aud': 'unexpected-audience'},
    {'sub': 42}, {'iat': 'invalid'}, {'iat': 99999999999},
])
def test_invalid_expiry_audience_time_or_subject_claims_are_rejected(claims):
    token = jwt.encode({'exp': int(time.time()) + 300, **claims}, settings.secret_key, algorithm='HS256')
    with pytest.raises(HTTPException) as error:
        verify_access_token(token)
    assert error.value.status_code == 401


@pytest.mark.parametrize('algorithm,key', [('HS512', 'synthetic-jwt-migration-secret-at-least-32-bytes'),
                                           ('HS256', 'different-synthetic-secret-at-least-32-bytes'), ('none', '')])
def test_caller_cannot_select_algorithm_or_key(algorithm, key):
    token = jwt.encode({'sub': 'synthetic', 'exp': int(time.time()) + 300}, key, algorithm=algorithm)
    with pytest.raises(HTTPException) as error:
        verify_access_token(token)
    assert error.value.status_code == 401


@pytest.mark.parametrize('token', ['', 'malformed', 'a.b.c', 'a.b.c.d.e'])
def test_malformed_or_jwe_token_is_rejected(token):
    with pytest.raises(HTTPException) as error:
        verify_access_token(token)
    assert error.value.status_code == 401
