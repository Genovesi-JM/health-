"""Atomic consultation changes shared by the consultation and video routes."""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import HTTPException, Query
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.health_models import Consultation, HealthAuditLog


def displayed_revision(expected_revision: str = Query("0", pattern=r"^(0|[1-9][0-9]{0,9})$")) -> int:
    """HTTP query values are text; reject coercions such as 1.0 or true."""
    return int(expected_revision)


def require_displayed_revision(consultation: Consultation, expected_revision: int) -> None:
    if consultation.reschedule_revision != expected_revision:
        raise HTTPException(409, "O horário mudou. Atualize a consulta antes de aceitar ou iniciar.")


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
               patient_cancel: bool = False,
               **changes) -> None:
    """Compare-and-set status and owner, leaving commit to the caller.

    Conditional SQL, rather than a read followed by an unconditional ORM write,
    prevents concurrent clinicians from claiming the same request and prevents
    cancellation/completion races from overwriting a terminal state. Works on
    both SQLite and PostgreSQL; no reliance on SQLite's ignored FOR UPDATE.
    """
    previous_status = consultation.status
    previous_doctor_id = consultation.doctor_id
    previous_revision = consultation.reschedule_revision
    if previous_status not in allowed_from:
        raise HTTPException(status_code=409, detail="O estado da consulta não permite esta ação. Atualize a lista.")
    from app.services.appointments import guard_transition, release_cancelled_slot
    guard_transition(db, consultation, status, changes.get("doctor_id", previous_doctor_id))
    table = Consultation.__table__
    predicates = []
    if patient_cancel:
        from app.services.request_expiry import actual_care_sql
        if db.query(Consultation.id).filter(Consultation.id == consultation.id, actual_care_sql()).first():
            db.rollback()
            raise HTTPException(409, "Existem registos de cuidados iniciados. Contacte a equipa para rever a consulta.")
        predicates.append(~actual_care_sql())
    result = db.execute(
        update(table).where(
            table.c.id == consultation.id,
            table.c.status == previous_status,
            table.c.doctor_id == previous_doctor_id,
            table.c.reschedule_revision == previous_revision,
            *predicates,
        ).values(status=status, updated_at=datetime.utcnow(), **changes)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=409, detail="A consulta foi alterada por outro utilizador. Atualize a lista.")
    record_event(db, consultation, actor_id, action, previous_status, status)
    db.refresh(consultation)
    if status == "cancelled":
        release_cancelled_slot(db, consultation)
    from app.services.notifications import consultation_event
    try:
        if action == "consultation_accepted":
            consultation_event(db, consultation, "accepted")
        if status == "in_progress":
            consultation_event(db, consultation, "started")
        if status == "cancelled":
            consultation_event(db, consultation, "cancelled")
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível guardar a atualização. Tente novamente.") from None
