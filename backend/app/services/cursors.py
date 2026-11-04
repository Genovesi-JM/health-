"""Bounded, signed keyset cursors; authorization remains a separate route check."""
from __future__ import annotations

import base64
import binascii
from datetime import datetime, timezone
import hashlib
import hmac
import json

from fastapi import HTTPException

from app.config import settings

MAX_CURSOR_LENGTH = 1024
_DOMAIN = b"kaya.cursor.v1\x00"


def utc_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _key() -> bytes:
    secret = settings.secret_key
    if not isinstance(secret, str) or len(secret.encode()) < 32:
        raise HTTPException(503, "A paginação está temporariamente indisponível.")
    return secret.encode()


def _encoded(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _decoded(value: str) -> bytes:
    if not value or not all(char.isascii() and (char.isalnum() or char in "-_") for char in value):
        raise ValueError()
    raw = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
    if _encoded(raw) != value:
        raise ValueError()
    return raw


def encode_position(*, scope: str, viewer_id: str, owner_id: str,
                    created_at: datetime, identifier: str) -> str:
    payload = {"v": 1, "scope": scope, "viewer": viewer_id, "owner": owner_id,
               "at": utc_timestamp(created_at), "id": identifier}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.digest(_key(), _DOMAIN + raw, hashlib.sha256)
    return _encoded(raw) + "." + _encoded(signature)


def decode_position(cursor: str, *, scope: str, viewer_id: str, owner_id: str) -> tuple[datetime, str]:
    key = _key()
    try:
        if not isinstance(cursor, str) or not 1 <= len(cursor) <= MAX_CURSOR_LENGTH:
            raise ValueError()
        encoded, signed = cursor.split(".")
        raw, signature = _decoded(encoded), _decoded(signed)
        if not hmac.compare_digest(signature, hmac.digest(key, _DOMAIN + raw, hashlib.sha256)):
            raise ValueError()
        payload = json.loads(raw)
        if not isinstance(payload, dict) or set(payload) != {"v", "scope", "viewer", "owner", "at", "id"}:
            raise ValueError()
        if (type(payload["v"]) is not int or payload["v"] != 1 or payload["scope"] != scope
                or payload["viewer"] != viewer_id or payload["owner"] != owner_id):
            raise ValueError()
        identifier = payload["id"]
        if (not isinstance(identifier, str) or not 1 <= len(identifier) <= 36
                or not all(char.isascii() and (char.isalnum() or char in "-_") for char in identifier)):
            raise ValueError()
        if not isinstance(payload["at"], str) or len(payload["at"]) > 40:
            raise ValueError()
        stamp = datetime.fromisoformat(payload["at"])
        if stamp.tzinfo is None or stamp.utcoffset() is None:
            raise ValueError()
        return stamp.astimezone(timezone.utc).replace(tzinfo=None), identifier
    except (ValueError, TypeError, KeyError, binascii.Error, UnicodeError, OverflowError):
        raise HTTPException(422, "O cursor é inválido. Atualize a lista.") from None
