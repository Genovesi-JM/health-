from __future__ import annotations
"""Private in-app inbox. A read marker is not clinical acknowledgement."""
import base64
import binascii
import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, or_, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import HealthAuditLog, Notification
from app.health_schemas import NotificationOut, NotificationCreate

router = APIRouter(tags=["notifications"])


def create_notification(
    db: Session, user_id: str, title: str, message: str, type: str = "info",
    entity_type: Optional[str] = None, entity_id: Optional[str] = None,
) -> Notification:
    """Legacy committing helper; retained for existing non-migrated callers.

    Atomic clinical workflows must use services.notifications.enqueue_notification
    inside their own transaction. This compatibility helper still commits all
    pending session work, exactly as before; it must never be called mid-workflow.
    """
    try:
        notif = Notification(user_id=user_id, title=title, message=message, type=type,
                             related_entity_type=entity_type, related_entity_id=entity_id)
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
    except Exception:
        db.rollback()
        raise


def _private(response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"


def _commit(db: Session):
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível guardar a leitura. Tente novamente.") from None


def _count(db: Session, user_id: str):
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False)).count()


def _cursor(item: Notification, user_id: str, unread_only: bool):
    payload = {"v": 1, "owner": user_id, "unread": unread_only, "id": item.id,
               "at": item.created_at.replace(tzinfo=timezone.utc).isoformat()}
    return base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode()).decode().rstrip("=")


def _decode_cursor(cursor: str, user_id: str, unread_only: bool):
    try:
        if not cursor or len(cursor) > 512 or not all(char.isascii() and (char.isalnum() or char in "-_") for char in cursor):
            raise ValueError()
        payload = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
        if not isinstance(payload, dict) or set(payload) != {"v", "owner", "unread", "id", "at"}:
            raise ValueError()
        if payload["v"] != 1 or payload["owner"] != user_id or type(payload["unread"]) is not bool or payload["unread"] != unread_only:
            raise ValueError()
        identifier = payload["id"]
        if not isinstance(identifier, str) or not 1 <= len(identifier) <= 36:
            raise ValueError()
        stamp = datetime.fromisoformat(payload["at"])
        if stamp.tzinfo is None or stamp.utcoffset() is None:
            raise ValueError()
        return stamp.astimezone(timezone.utc).replace(tzinfo=None), identifier
    except (ValueError, TypeError, KeyError, binascii.Error, UnicodeError):
        raise HTTPException(422, "O cursor da caixa de notificações é inválido. Atualize a lista.") from None


@router.get("/api/v1/notifications/capabilities")
def notification_capabilities(response: Response, user: User = Depends(get_current_user)):
    _private(response)
    return {"channels": {"in_app": True, "email": False, "sms": False, "push": False},
            "read_is_care_acknowledgement": False}


@router.get("/api/v1/notifications/unread-count")
def get_unread_count(response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _private(response)
    return {"unread": _count(db, user.id)}


@router.get("/api/v1/notifications/inbox")
def inbox(response: Response, limit: int = Query(20, ge=1, le=100),
          cursor: str | None = Query(None, max_length=512), unread_only: bool = False,
          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    if cursor is not None:
        stamp, identifier = _decode_cursor(cursor, user.id, unread_only)
        query = query.filter(or_(Notification.created_at < stamp,
                                 and_(Notification.created_at == stamp, Notification.id < identifier)))
    rows = query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1).all()
    items = rows[:limit]
    _private(response)
    return {"items": [NotificationOut.model_validate(item).model_dump(mode="json") for item in items],
            "next_cursor": _cursor(items[-1], user.id, unread_only) if len(rows) > limit else None,
            "unread_count": _count(db, user.id)}


@router.get("/api/v1/notifications/me", response_model=List[NotificationOut])
def list_my_notifications(response: Response, limit: int = Query(50, ge=1, le=100),
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _private(response)
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(
        Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()


@router.post("/api/v1/notifications", response_model=NotificationOut)
def create_notification_endpoint(body: NotificationCreate, response: Response,
                                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "admin":
        raise HTTPException(403, "Acesso negado.")
    if not db.get(User, body.user_id):
        raise HTTPException(404, "Utilizador não encontrado.")
    _private(response)
    return create_notification(db, user_id=body.user_id, title=body.title, message=body.message,
        type=body.type, entity_type=body.related_entity_type, entity_id=body.related_entity_id)


@router.patch("/api/v1/notifications/read-all")
def mark_all_read(response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    changed = db.execute(update(Notification.__table__).where(
        Notification.user_id == user.id, Notification.is_read.is_(False),
    ).values(is_read=True, read_at=datetime.utcnow()))
    count = changed.rowcount
    if count:
        db.add(HealthAuditLog(actor_user_id=user.id, action="notifications_marked_read",
            resource_type="notification_collection", resource_id=user.id,
            metadata_json=json.dumps({"updated_count": count})))
    _commit(db)
    _private(response)
    return {"ok": True, "updated_count": count}


@router.patch("/api/v1/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_one_read(notification_id: str, response: Response,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not notif:
        raise HTTPException(404, "Notificação não encontrada.")
    if not notif.is_read:
        changed = db.execute(update(Notification.__table__).where(
            Notification.id == notification_id, Notification.user_id == user.id, Notification.is_read.is_(False),
        ).values(is_read=True, read_at=datetime.utcnow()))
        if changed.rowcount:
            db.add(HealthAuditLog(actor_user_id=user.id, action="notification_marked_read",
                                  resource_type="notification", resource_id=notification_id))
        _commit(db)
        db.refresh(notif)
    _private(response)
    return notif
