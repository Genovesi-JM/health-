"""Durable in-app events enlisted in the originating care transaction.

No provider delivery, commit, rollback or detached background task occurs here.
Reading an inbox item is not clinical acknowledgement or proof of care receipt.
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.health_models import Consultation, ConsultationNotes, Doctor, Notification, Patient


def enqueue_notification(db: Session, *, user_id: str, event_key: str, title: str,
                         message: str, type: str = "info", entity_type: str | None = None,
                         entity_id: str | None = None) -> Notification:
    """Insert once per recipient/event without altering caller transaction state."""
    if not event_key or len(event_key) > 160:
        raise ValueError("Notification event identity is required and bounded")
    dialect = db.get_bind().dialect.name
    insert = {"sqlite": sqlite_insert, "postgresql": pg_insert}.get(dialect)
    if insert is None:
        raise RuntimeError("Notification deduplication requires SQLite or PostgreSQL")
    statement = insert(Notification.__table__).values(
        id=str(uuid4()), user_id=user_id, event_key=event_key, title=title,
        message=message, type=type, related_entity_type=entity_type,
        related_entity_id=entity_id, is_read=False, created_at=datetime.utcnow(),
    ).on_conflict_do_nothing(index_elements=["user_id", "event_key"])
    db.execute(statement)
    return db.query(Notification).filter_by(user_id=user_id, event_key=event_key).populate_existing().one()


def consultation_event(db: Session, consultation, event: str) -> None:
    messages = {
        "booked": ("Pedido de consulta recebido", "O pedido aguarda aceitação. Abra a consulta para acompanhar o estado.", "info"),
        "accepted": ("Consulta aceite", "O pedido foi aceite. Abra a consulta para consultar os detalhes.", "success"),
        "started": ("Consulta iniciada", "A consulta foi iniciada. Abra os detalhes para acompanhar.", "info"),
        "cancelled": ("Consulta cancelada", "A consulta foi cancelada. Abra os detalhes para consultar o estado.", "warning"),
        "closed": ("Resumo da consulta disponível", "O resumo da consulta está disponível. Abra a consulta para ler.", "success"),
    }
    title, message, level = messages[event]
    patient = db.get(Patient, consultation.patient_id)
    doctor = db.get(Doctor, consultation.doctor_id) if consultation.doctor_id else None
    recipients = {person.user_id for person in (patient, doctor) if person is not None}
    revision = consultation.reschedule_revision or 0
    revision_suffix = f":revision:{revision}" if revision else ""
    for recipient in sorted(recipients):
        enqueue_notification(db, user_id=recipient, event_key=f"consultation:{consultation.id}:{event}{revision_suffix}",
                             title=title, message=message, type=level,
                             entity_type="consultation", entity_id=consultation.id)


def task_event(db: Session, task, event: str) -> None:
    recipients = {uid for uid in (task.created_by_user_id, task.assigned_user_id) if uid}
    title = "Tarefa clínica criada" if event == "created" else "Tarefa clínica concluída"
    for recipient in sorted(recipients):
        enqueue_notification(db, user_id=recipient, event_key=f"task:{task.id}:{event}", title=title,
                             message="Existe uma atualização numa tarefa clínica. Abra a lista de tarefas para consultar.",
                             entity_type="clinical_care_task", entity_id=task.id)
    # Internal tasks are not patient disclosure. Only the exact task explicitly
    # published in a finalized closeout can produce a patient follow-up notice.
    notes = db.query(ConsultationNotes).filter(
        ConsultationNotes.consultation_id == task.consultation_id,
        ConsultationNotes.follow_up_task_id == task.id,
        ConsultationNotes.finalized_at.is_not(None),
        ConsultationNotes.finalized_by_user_id.is_not(None),
        ConsultationNotes.finalization_digest.is_not(None),
    ).first()
    if not notes:
        return
    consultation = db.get(Consultation, task.consultation_id)
    if not consultation or consultation.patient_id != task.patient_id or consultation.status != "completed":
        return
    from app.services.consultation_closeout import verify_finalization
    verify_finalization(notes)
    patient = db.get(Patient, task.patient_id)
    if patient:
        enqueue_notification(db, user_id=patient.user_id, event_key=f"task:{task.id}:{event}",
                             title="Seguimento atualizado", message="Existe uma atualização no seguimento. Abra o resumo da consulta para consultar.",
                             entity_type="consultation", entity_id=task.consultation_id)
