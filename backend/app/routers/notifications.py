from __future__ import annotations
"""
Notifications Router
In-app notification centre for all user roles.

Endpoints:
  GET    /api/v1/notifications/me          — list own notifications (newest first)
  POST   /api/v1/notifications             — create (admin/system use)
  PATCH  /api/v1/notifications/{id}/read   — mark one as read
  PATCH  /api/v1/notifications/read-all    — mark all as read
  GET    /api/v1/notifications/unread-count — fast badge count

Internal helper:
  create_notification(db, user_id, title, message, type, entity_type, entity_id)
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Notification
from app.health_schemas import NotificationOut, NotificationCreate

router = APIRouter(tags=["notifications"])


# ── Internal helper (call from other routers) ─────────────────────────────────

def create_notification(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    type: str = "info",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> Notification:
    """Create and persist a notification. Safe to call from any router."""
    try:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            related_entity_type=entity_type,
            related_entity_id=entity_id,
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif
    except Exception:
        db.rollback()
        raise


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/v1/notifications/unread-count")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,  # noqa: E712
    ).count()
    return {"unread": count}


@router.get("/api/v1/notifications/me", response_model=List[NotificationOut])
def list_my_notifications(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/api/v1/notifications", response_model=NotificationOut)
def create_notification_endpoint(
    body: NotificationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin/system endpoint to push a notification to any user."""
    if user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    return create_notification(
        db,
        user_id=body.user_id,
        title=body.title,
        message=body.message,
        type=body.type,
        entity_type=body.related_entity_type,
        entity_id=body.related_entity_id,
    )


@router.patch("/api/v1/notifications/read-all")
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.patch("/api/v1/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_one_read(
    notification_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada.")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif
