from __future__ import annotations
"""Multi-factor authentication endpoints.

    POST /auth/mfa/setup                 begin enrollment (returns secret + QR URI)
    POST /auth/mfa/verify                confirm enrollment with a TOTP code
    POST /auth/mfa/disable               turn MFA off (requires a current code)
    POST /auth/mfa/recovery-codes        regenerate recovery codes (requires code)
    POST /auth/mfa/challenge             complete a login that returned mfa_required

Setup/verify/disable/regenerate require a normal access token (the user is
already logged in and managing their own security). ``challenge`` is the
one exception: it takes the short-lived ``mfa_token`` minted by /auth/login.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import MfaCredential, MfaRecoveryCode
from app.middleware import log_audit
from app.models import User
from app.oauth2 import verify_access_token
from app.services.mfa import (
    generate_recovery_codes,
    generate_secret,
    hash_recovery_code,
    mfa_is_mandatory,
    provisioning_uri,
    verify_totp,
)

router = APIRouter(prefix="/auth/mfa", tags=["auth", "mfa"])


# ── Request bodies ──────────────────────────────────────────────────────────

class VerifyBody(BaseModel):
    code: str = Field(..., min_length=6, max_length=10)


class DisableBody(BaseModel):
    code: str = Field(..., description="A current TOTP or recovery code.")


class ChallengeBody(BaseModel):
    mfa_token: str
    code: str = Field(..., description="TOTP code or a one-time recovery code.")


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_cred(db: Session, user_id: str) -> MfaCredential | None:
    return db.query(MfaCredential).filter(MfaCredential.user_id == user_id).first()


def _consume_recovery_code(db: Session, user_id: str, code: str) -> bool:
    """Return True and mark used if the code matches an unused recovery code."""
    h = hash_recovery_code(code)
    row = (
        db.query(MfaRecoveryCode)
        .filter(
            MfaRecoveryCode.user_id == user_id,
            MfaRecoveryCode.code_hash == h,
            MfaRecoveryCode.used_at.is_(None),
        )
        .first()
    )
    if not row:
        return False
    row.used_at = datetime.utcnow()
    db.add(row)
    return True


def _issue_recovery_codes(db: Session, user_id: str) -> list[str]:
    """Delete old codes, generate + persist 10 fresh ones, return plaintext once."""
    db.query(MfaRecoveryCode).filter(MfaRecoveryCode.user_id == user_id).delete()
    codes = generate_recovery_codes(10)
    for c in codes:
        db.add(MfaRecoveryCode(user_id=user_id, code_hash=hash_recovery_code(c)))
    return codes


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/status")
def mfa_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Current MFA posture for the logged-in user."""
    cred = _get_cred(db, user.id)
    unused_recovery = (
        db.query(MfaRecoveryCode)
        .filter(MfaRecoveryCode.user_id == user.id, MfaRecoveryCode.used_at.is_(None))
        .count()
    )
    return {
        "enabled": bool(cred and cred.enabled),
        "mandatory": mfa_is_mandatory(user.role),
        "recovery_codes_remaining": unused_recovery,
    }


@router.post("/setup")
def mfa_setup(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Begin (or restart) enrollment. Generates a fresh secret but does NOT
    enable MFA until /verify confirms the user can produce a valid code."""
    cred = _get_cred(db, user.id)
    if cred and cred.enabled:
        raise HTTPException(409, "MFA já está ativo. Desative antes de reconfigurar.")

    secret = generate_secret()
    if cred:
        cred.secret = secret
        cred.enabled = False
        cred.confirmed_at = None
    else:
        cred = MfaCredential(user_id=user.id, secret=secret, enabled=False)
        db.add(cred)
    db.commit()

    return {
        "secret": secret,
        "otpauth_uri": provisioning_uri(secret, user.email or user.id),
        "issuer": "KAYA",
    }


@router.post("/verify")
def mfa_verify(
    body: VerifyBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm enrollment. On success, MFA becomes enabled and the user gets
    their one-time recovery codes (shown exactly once)."""
    cred = _get_cred(db, user.id)
    if not cred:
        raise HTTPException(400, "Inicie a configuração MFA primeiro.")
    if not verify_totp(cred.secret, body.code):
        raise HTTPException(401, "Código inválido. Verifique a hora do dispositivo e tente de novo.")

    cred.enabled = True
    cred.confirmed_at = datetime.utcnow()
    codes = _issue_recovery_codes(db, user.id)
    db.commit()
    log_audit(db, "mfa_enabled", user_id=user.id, user_email=user.email, request=request)
    return {"enabled": True, "recovery_codes": codes}


@router.post("/disable")
def mfa_disable(
    body: DisableBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Turn MFA off. Requires a current TOTP or recovery code (re-auth).

    Mandatory-MFA roles are warned but not blocked here — the frontend
    should re-prompt enrollment; blocking disable outright would trap a
    user with a broken authenticator.
    """
    cred = _get_cred(db, user.id)
    if not cred or not cred.enabled:
        raise HTTPException(400, "MFA não está ativo.")
    if not (verify_totp(cred.secret, body.code) or _consume_recovery_code(db, user.id, body.code)):
        raise HTTPException(401, "Código inválido.")

    db.query(MfaRecoveryCode).filter(MfaRecoveryCode.user_id == user.id).delete()
    db.delete(cred)
    db.commit()
    log_audit(db, "mfa_disabled", user_id=user.id, user_email=user.email, request=request)
    return {"enabled": False, "mfa_mandatory": mfa_is_mandatory(user.role)}


@router.post("/recovery-codes")
def regenerate_recovery_codes(
    body: DisableBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Regenerate recovery codes (invalidates the old set). Requires a code."""
    cred = _get_cred(db, user.id)
    if not cred or not cred.enabled:
        raise HTTPException(400, "MFA não está ativo.")
    if not verify_totp(cred.secret, body.code):
        raise HTTPException(401, "Código inválido.")
    codes = _issue_recovery_codes(db, user.id)
    db.commit()
    return {"recovery_codes": codes}


@router.post("/challenge")
def mfa_challenge(
    body: ChallengeBody,
    request: Request,
    db: Session = Depends(get_db),
):
    """Complete a login that returned ``mfa_required``.

    Accepts either a TOTP code or a one-time recovery code. On success it
    returns the full auth response (tokens + user), exactly like a normal
    password login would.
    """
    payload = verify_access_token(body.mfa_token)
    if not payload or not payload.get("mfa_challenge"):
        raise HTTPException(401, "Sessão de verificação inválida ou expirada.")
    user_id = payload.get("uid")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "Utilizador não encontrado.")

    cred = _get_cred(db, user.id)
    if not cred or not cred.enabled:
        raise HTTPException(400, "MFA não está ativo nesta conta.")

    ok = verify_totp(cred.secret, body.code) or _consume_recovery_code(db, user.id, body.code)
    if not ok:
        log_audit(db, "mfa_challenge_failed", user_id=user.id, user_email=user.email, request=request)
        raise HTTPException(401, "Código inválido.")

    # Import here to avoid a circular import at module load.
    from app.routers.auth import _build_auth_response
    resp = _build_auth_response(db, user)
    db.commit()
    log_audit(db, "login_mfa_success", user_id=user.id, user_email=user.email, request=request)
    return resp
