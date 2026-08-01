from __future__ import annotations
"""Multi-factor authentication — TOTP (RFC 6238) with the standard library.

No third-party dependency (pyotp is not installed in this environment).
Compatible with Google Authenticator, Authy, 1Password, Microsoft
Authenticator, etc., because it implements the same HMAC-SHA1 /
30-second-step algorithm those apps expect.

Recovery codes are one-time strings shown to the user once and stored
hashed (SHA-256). They let a user in when they lose their authenticator.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote


# ── Secret generation ────────────────────────────────────────────────────────

def generate_secret(length: int = 20) -> str:
    """Return a random base32 secret (no padding) suitable for TOTP apps."""
    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _b32decode(secret: str) -> bytes:
    # Re-pad to a multiple of 8 for the stdlib decoder; TOTP apps strip it.
    padded = secret.upper() + "=" * ((-len(secret)) % 8)
    return base64.b32decode(padded, casefold=True)


# ── TOTP core ────────────────────────────────────────────────────────────────

def _hotp(secret: str, counter: int, digits: int = 6) -> str:
    key = _b32decode(secret)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(binary % (10 ** digits)).zfill(digits)


def totp_now(secret: str, *, at: float | None = None, step: int = 30, digits: int = 6) -> str:
    counter = int((at if at is not None else time.time()) // step)
    return _hotp(secret, counter, digits)


def verify_totp(
    secret: str,
    code: str,
    *,
    at: float | None = None,
    step: int = 30,
    digits: int = 6,
    window: int = 1,
) -> bool:
    """Constant-time verify a TOTP code, tolerating ±``window`` steps of clock skew."""
    if not code or not code.strip().isdigit():
        return False
    code = code.strip()
    now = at if at is not None else time.time()
    base = int(now // step)
    for drift in range(-window, window + 1):
        candidate = _hotp(secret, base + drift, digits)
        if hmac.compare_digest(candidate, code):
            return True
    return False


# ── Provisioning URI (for QR codes) ──────────────────────────────────────────

def provisioning_uri(secret: str, account_name: str, issuer: str = "KAYA") -> str:
    """otpauth:// URI that any authenticator app can import via QR or paste."""
    label = quote(f"{issuer}:{account_name}")
    params = f"secret={secret}&issuer={quote(issuer)}&algorithm=SHA1&digits=6&period=30"
    return f"otpauth://totp/{label}?{params}"


# ── Recovery codes ───────────────────────────────────────────────────────────

def generate_recovery_codes(count: int = 10) -> list[str]:
    """Return human-friendly one-time codes like '3f9a-c1b2'."""
    codes = []
    for _ in range(count):
        raw = secrets.token_hex(4)  # 8 hex chars
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def hash_recovery_code(code: str) -> str:
    """SHA-256 of the normalized code (lowercase, dashes stripped)."""
    normalized = code.strip().lower().replace("-", "")
    return hashlib.sha256(normalized.encode()).hexdigest()


# ── Role policy ──────────────────────────────────────────────────────────────

# Roles for which MFA is mandatory (spec §9). Patients / caregivers optional.
MFA_MANDATORY_ROLES = frozenset({
    "doctor", "nurse", "pharmacist",
    "corporate_admin", "compliance_reviewer", "admin",
})


def mfa_is_mandatory(role: str) -> bool:
    return role in MFA_MANDATORY_ROLES
