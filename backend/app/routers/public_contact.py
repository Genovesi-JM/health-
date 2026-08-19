from __future__ import annotations
"""Public website contact form.

Stores "Fale connosco" submissions so they are never lost to a mailto:
client, and best-effort emails support. Public (no auth); the global rate-
limit middleware protects it from abuse.

    POST /api/v1/contact                 submit a message (public)
    GET  /api/v1/contact/admin           list messages (admin/support)
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.health_models import ContactMessage
from app.models import User
from app.rbac import require_admin_or_support

router = APIRouter(prefix="/api/v1/contact", tags=["contact"])


class ContactBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    subject: str = Field("Suporte geral", max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)


@router.post("", status_code=201)
def submit_contact(body: ContactBody, request: Request, db: Session = Depends(get_db)):
    ip = None
    try:
        ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else None))
        if ip:
            ip = ip.split(",")[0].strip()[:45]
    except Exception:
        ip = None

    msg = ContactMessage(
        name=body.name.strip(),
        email=str(body.email).strip().lower(),
        subject=(body.subject or "Suporte geral").strip()[:200],
        message=body.message.strip(),
        ip_address=ip,
    )
    db.add(msg)
    db.commit()

    # Best-effort notification to support — never blocks the submission.
    try:
        from app.mail import _send_email  # type: ignore
        _send_email(
            "suporte@kaya.ao",
            f"[KAYA contacto] {msg.subject}",
            f"Nome: {msg.name}\nEmail: {msg.email}\n\n{msg.message}",
        )
    except Exception:
        pass

    return {"received": True, "id": msg.id}


@router.get("/admin")
def list_contact_messages(
    status: Optional[str] = None,
    _: User = Depends(require_admin_or_support),
    db: Session = Depends(get_db),
):
    q = db.query(ContactMessage)
    if status:
        q = q.filter(ContactMessage.status == status)
    rows = q.order_by(ContactMessage.created_at.desc()).limit(200).all()
    return [
        {
            "id": r.id, "name": r.name, "email": r.email, "subject": r.subject,
            "message": r.message, "status": r.status, "created_at": r.created_at,
        }
        for r in rows
    ]
