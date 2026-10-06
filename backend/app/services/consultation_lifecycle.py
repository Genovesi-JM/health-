"""Atomic consultation changes shared by the consultation and video routes."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.health_models import Consultation, HealthAuditLog


def record_event(db: Session, consultation: Consultation, actor_id: str,
                 action: str, previous_status: str | None, status: str) -> None:
    """Enlist the audit event in the caller's transaction; never swallow failure."""
    db.add(HealthAuditLog(
        actor_user_id=actor_id,
        action=action,
        resource_type="consultation",
        resource_id=consultation.id,
        metadata_json=json.dumps({"from_status": previous_status, "to_status": status}),
    ))


def transition(db: Session, consultation: Consultation, *, actor_id: str,
               action: str, allowed_from: tuple[str, ...], status: str,
               **changes) -> None:
    """Compare-and-set status and owner, leaving commit to the caller.

    Conditional SQL, rather than a read followed by an unconditional ORM write,
    prevents concurrent clinicians from claiming the same request and prevents
    cancellation/completion races from overwriting a terminal state. Works on
    both SQLite and PostgreSQL; no reliance on SQLite's ignored FOR UPDATE.
    """
    previous_status = consultation.status
    if previous_status not in allowed_from:
        raise HTTPException(status_code=409, detail="O estado da consulta não permite esta ação. Atualize a lista.")
    table = Consultation.__table__
    result = db.execute(
        update(table).where(
            table.c.id == consultation.id,
            table.c.status == previous_status,
            table.c.doctor_id == consultation.doctor_id,
        ).values(status=status, updated_at=datetime.utcnow(), **changes)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="A consulta foi alterada por outro utilizador. Atualize a lista.")
    record_event(db, consultation, actor_id, action, previous_status, status)
    db.refresh(consultation)
