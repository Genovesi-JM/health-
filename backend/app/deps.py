from __future__ import annotations
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from typing import Optional
import json

from app.database import get_db
from app.oauth2 import verify_access_token
from app.models import User, AccountMember, Account
from app.services.mfa import assert_mfa_session


class LegacyStatusHTTPBearer(HTTPBearer):
    """Keep the established missing-bearer response during framework upgrades."""
    def make_not_authenticated_error(self) -> HTTPException:
        return HTTPException(status_code=403, detail="Not authenticated")


bearer = LegacyStatusHTTPBearer(scheme_name="HTTPBearer")
optional_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    token = creds.credentials if creds else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = verify_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inv\u00e1lido")

    # Reject partial-auth MFA challenge tokens: they are minted by /auth/login
    # ONLY to complete the second factor at /auth/mfa/challenge, and must
    # never be accepted as a full bearer token (that would bypass MFA).
    if payload.get("mfa_challenge"):
        raise HTTPException(status_code=401, detail="Verifica\u00e7\u00e3o MFA incompleta.")
    # Enrollment tokens are limited to the MFA setup/verify endpoints and must
    # never act as a full bearer token elsewhere.
    if payload.get("mfa_enroll"):
        raise HTTPException(status_code=401, detail="Complete a configura\u00e7\u00e3o de MFA para continuar.")

    uid = payload.get("uid")
    sub = payload.get("sub")

    user = None
    if uid:
        user = db.get(User, uid)
    if not user and sub:
        user = db.query(User).filter(User.email == sub).first()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inv\u00e1lido/inativo")
    assert_mfa_session(user, payload, db)
    return user


def get_mfa_actor(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate a caller for the MFA setup/verify endpoints.

    Accepts EITHER a normal fully-verified session (already-enrolled users
    reconfiguring MFA) OR a short-lived enrollment token minted by /auth/login
    for a mandatory-MFA user who has not yet enrolled. The enrollment token
    unlocks ONLY these endpoints \u2014 it is rejected everywhere else. When an
    enrollment token is used, request.state.mfa_enrollment is set True so the
    endpoint can issue full session tokens on successful verification.
    """
    token = creds.credentials if creds else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = verify_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inv\u00e1lido")
    if payload.get("mfa_challenge"):
        raise HTTPException(status_code=401, detail="Verifica\u00e7\u00e3o MFA incompleta.")

    uid = payload.get("uid")
    sub = payload.get("sub")
    user = db.get(User, uid) if uid else None
    if not user and sub:
        user = db.query(User).filter(User.email == sub).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inv\u00e1lido/inativo")

    if payload.get("mfa_enroll"):
        request.state.mfa_enrollment = True
        return user

    # Not an enrollment token \u2192 require a full, MFA-complete session.
    request.state.mfa_enrollment = False
    assert_mfa_session(user, payload, db)
    return user


def get_optional_user(
    creds: HTTPAuthorizationCredentials = Depends(optional_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None for guests instead of 401."""
    if not creds or not creds.credentials:
        return None
    try:
        payload = verify_access_token(creds.credentials)
    except Exception:
        return None
    uid = payload.get("uid")
    sub = payload.get("sub")
    user = None
    if uid:
        user = db.get(User, uid)
    if not user and sub:
        user = db.query(User).filter(User.email == sub).first()
    if not user or not user.is_active:
        return None
    try:
        assert_mfa_session(user, payload, db)
    except HTTPException:
        return None
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return user


def _parse_modules(value: str):
    try:
        parsed = json.loads(value) if value else None
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def get_current_account(
    request: Request,
    account_id: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Account:
    if account_id is None:
        account_id = request.headers.get("X-Account-ID")

    q = db.query(AccountMember).filter(AccountMember.user_id == user.id)
    if account_id:
        q = q.filter(AccountMember.account_id == account_id)
    membership = q.first()

    if not membership:
        membership = (
            db.query(AccountMember)
            .filter(AccountMember.user_id == user.id)
            .order_by(AccountMember.role.desc())
            .first()
        )
        if not membership:
            raise HTTPException(status_code=403, detail="Sem acesso Aÿ conta pedida.")

    account = db.get(Account, membership.account_id)
    if not account:
        raise HTTPException(status_code=403, detail="Conta inexistente ou inacessA­vel.")

    try:
        request.state.account = account
        request.state.account_modules = _parse_modules(account.modules_enabled)
    except Exception:
        pass
    return account
