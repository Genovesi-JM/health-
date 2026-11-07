"""Bounded, audited expiry of unaccepted requests; no work runs on import or GET.

The shared SQL predicate is used by capacity, queues and the explicit worker.
An overdue request with payment or actual-care evidence is held for review.
"""
from datetime import datetime, timedelta, timezone
import json

from fastapi import HTTPException
from sqlalchemy import and_, exists, or_, select, update

from app.config import settings
from app.health_models import (
    Consultation, ConsultationNotes, HealthAuditLog, HealthPayment, TeleconsultationParticipant,
    TeleconsultationSession,
)


def deadline(scheduled_at=None, *, now=None):
    now = now or datetime.utcnow()
    if now.tzinfo is not None:
        now = now.astimezone(timezone.utc).replace(tzinfo=None)
    if scheduled_at is not None and scheduled_at.tzinfo is not None:
        scheduled_at = scheduled_at.astimezone(timezone.utc).replace(tzinfo=None)
    until = now + timedelta(hours=settings.consultation_request_ttl_hours)
    return min(until, scheduled_at) if scheduled_at else until


def default_deadline(context):
    values = context.get_current_parameters()
    if values.get('status', 'requested') != 'requested':
        return None
    return deadline(values.get('scheduled_at'))


def actual_care_sql():
    session = TeleconsultationSession
    participant = TeleconsultationParticipant
    notes = ConsultationNotes
    session_evidence = exists(select(session.id).where(session.consultation_id == Consultation.id, or_(
        session.started_at.is_not(None), session.ended_at.is_not(None),
        session.status.is_(None), session.status.not_in(('scheduled', 'waiting')))))
    attendance = exists(select(participant.id).join(session, session.id == participant.session_id).where(
        session.consultation_id == Consultation.id,
        or_(participant.joined_at.is_not(None), participant.left_at.is_not(None))))
    finalized = exists(select(notes.id).where(notes.consultation_id == Consultation.id, or_(
        notes.finalized_at.is_not(None), notes.finalized_by_user_id.is_not(None), notes.finalization_digest.is_not(None))))
    return or_(Consultation.started_at.is_not(None), Consultation.ended_at.is_not(None), session_evidence, attendance, finalized)


def valid_deadline_sql():
    return and_(Consultation.requested_expires_at.is_not(None), Consultation.created_at.is_not(None), Consultation.expired_at.is_(None),
        Consultation.requested_expires_at >= Consultation.created_at,
        or_(Consultation.scheduled_at.is_(None), Consultation.requested_expires_at <= Consultation.scheduled_at))


def payment_link_sql():
    # Pending checkout rows predate the denormalized payment_id assignment.
    # Any linked financial history requires review before releasing/moving care.
    return or_(Consultation.payment_id.is_not(None), exists(select(HealthPayment.id).where(
        HealthPayment.consultation_id == Consultation.id)))


def safely_due_sql(now=None):
    return and_(Consultation.status == 'requested', valid_deadline_sql(),
        Consultation.requested_expires_at <= (now or datetime.utcnow()),
        Consultation.payment_status.is_not(None), Consultation.payment_status.in_(('pending', 'waived', 'unpaid')),
        ~payment_link_sql(), ~actual_care_sql())


def _state(item, actual_care, financial_link, now):
    if item.status == 'expired':
        return 'expired'
    if item.status != 'requested':
        return None
    until = item.requested_expires_at
    if (until is None or item.expired_at or not item.created_at or until < item.created_at
            or (item.scheduled_at and until > item.scheduled_at) or actual_care):
        return 'review_required'
    if until > now:
        return 'open'
    if financial_link or item.payment_status not in ('pending', 'waived', 'unpaid'):
        return 'review_required'
    return 'expiry_pending'


def annotate_expiry(items, db, *, now=None):
    """Batch actual-care lookup; serialization never starts a query per row."""
    items = list(items)
    requested = [item.id for item in items if item.status == 'requested']
    evidence = {row[0]: (row[1], row[2]) for row in db.query(Consultation.id, actual_care_sql(), payment_link_sql()).filter(
        Consultation.id.in_(requested)).all()} if requested else {}
    now = now or datetime.utcnow()
    for item in items:
        item.request_expiry_state = _state(item, *evidence.get(item.id, (False, False)), now)
    return items


def require_open_request(db, item):
    if item.status == 'requested' and annotate_expiry([item], db)[0].request_expiry_state != 'open':
        raise HTTPException(409, {'code': 'consultation_request_not_open',
            'message': 'O prazo deste pedido terminou ou requer revisão. Atualize a consulta antes de continuar.'})


def expire_one(db, identifier, *, now=None):
    """Enlist one expiration in caller transaction; caller commits/rolls back."""
    from app.services.appointments import lock_resources, release_cancelled_slot
    from app.services.notifications import consultation_event
    item = db.get(Consultation, identifier, populate_existing=True)
    if not item:
        return False
    original_doctor, original_revision = item.doctor_id, item.reschedule_revision
    lock_resources(db, original_doctor, item.patient_id)
    db.refresh(item)
    now = now or datetime.utcnow()
    changed = db.execute(update(Consultation.__table__).where(
        Consultation.id == identifier, Consultation.doctor_id == original_doctor,
        Consultation.reschedule_revision == original_revision, safely_due_sql(now),
    ).values(status='expired', expired_at=now, updated_at=now))
    if changed.rowcount != 1:
        return False
    db.refresh(item)
    release_cancelled_slot(db, item)
    db.add(HealthAuditLog(actor_user_id=None, action='consultation_request_expired',
        resource_type='consultation', resource_id=item.id,
        metadata_json=json.dumps({'from_status': 'requested', 'to_status': 'expired',
            'reason': 'acceptance_deadline_elapsed', 'reschedule_revision': item.reschedule_revision,
            'requested_expires_at': item.requested_expires_at.replace(tzinfo=timezone.utc).isoformat()})))
    consultation_event(db, item, 'expired')
    db.flush()
    return True


def sweep(db, *, limit=100, now=None):
    """Own a dedicated worker session: commit/rollback each bounded candidate."""
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError('Choose a batch limit from 1 to 1000')
    if db.new or db.dirty or db.deleted:
        raise ValueError('The expiry worker requires a clean dedicated session')
    cutoff = now or datetime.utcnow()
    rows = db.query(Consultation.id).filter(safely_due_sql(cutoff)).order_by(
        Consultation.requested_expires_at, Consultation.id).limit(limit + 1).all()
    result = {'scanned': min(len(rows), limit), 'expired': 0, 'skipped': 0, 'failed': 0, 'has_more': len(rows) > limit}
    # Do not retain the candidate-read transaction between individual attempts.
    db.rollback()
    for row in rows[:limit]:
        try:
            changed = expire_one(db, row[0], now=now)
            db.commit()
            result['expired' if changed else 'skipped'] += 1
        except Exception:
            db.rollback()
            result['failed'] += 1
    return result
