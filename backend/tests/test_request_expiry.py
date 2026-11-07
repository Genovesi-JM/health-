"""Audited deadlines, safe overdue exclusion and conservative care retention."""
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine
from app.models import UserProfile
from app.health_models import (AppointmentSlot, Consultation, HealthAuditLog, HealthPayment, Notification,
                              TeleconsultationParticipant, TeleconsultationSession)
from app.services import request_expiry as expiry
from app.services.consultation_lifecycle import transition
from tests.test_appointments import api, people, book, publish  # noqa: F401
from tests.test_appointment_rescheduling import pair, move
from tests.test_reschedule_video_preparation import prepared


@pytest.fixture(autouse=True)
def isolate_pending_deadlines(db_session):
    existing = {row[0] for row in db_session.query(Consultation.id)}
    yield
    db_session.rollback()
    db_session.query(Consultation).filter(Consultation.id.not_in(existing), Consultation.status == 'requested').update(
        {'status': 'cancelled'}, synchronize_session=False)
    db_session.commit()


def due(db, identifier):
    item = db.get(Consultation, identifier, populate_existing=True)
    item.created_at = datetime.utcnow() - timedelta(days=3)
    item.requested_expires_at = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    return item


def read(api, people, identifier):
    return api.get('/api/v1/consultations/me', headers=people['patient']['headers'], params={'consultation_id': identifier}).json()[0]


def test_new_deadline_uses_configured_ttl_and_nearest_slot_start(api, people, monkeypatch):
    monkeypatch.setattr(settings, 'consultation_request_ttl_hours', 2)
    before = datetime.utcnow()
    queued = book(api, people).json()
    until = datetime.fromisoformat(queued['requested_expires_at']).replace(tzinfo=None)
    assert before + timedelta(hours=2) <= until <= datetime.utcnow() + timedelta(hours=2)
    assert queued['request_expiry_state'] == 'open' and queued['expired_at'] is None
    local = (datetime.now(ZoneInfo('Africa/Luanda')) + timedelta(hours=1)).replace(microsecond=0)
    slot = publish(api, people, starts_at=local.isoformat(), ends_at=(local + timedelta(minutes=30)).isoformat())
    timed = book(api, people, slot, who='other_patient').json()
    assert timed['requested_expires_at'] == timed['scheduled_at'] == slot['starts_at']


def test_safe_overdue_queue_request_cannot_be_accepted_and_does_not_block_new_request(api, people, db_session):
    key = str(uuid4()); original = book(api, people, key=key).json(); due(db_session, original['id'])
    assert read(api, people, original['id'])['request_expiry_state'] == 'expiry_pending'
    for path in ('/api/v1/doctor/queue', '/api/v1/doctor/queue/page'):
        result = api.get(path, headers=people['doctor']['headers']).json()
        assert original['id'] not in {row['id'] for row in (result if isinstance(result, list) else result['items'])}
    rejected = api.post(f'/api/v1/doctor/queue/{original["id"]}/accept', headers=people['doctor']['headers'])
    assert rejected.status_code == 409 and rejected.json()['detail']['code'] == 'consultation_request_not_open'
    fresh = book(api, people)
    assert fresh.status_code == 200 and fresh.json()['id'] != original['id']
    # Exact retries preserve the original episode; GET and replay never sweep it.
    assert book(api, people, key=key).json()['request_expiry_state'] == 'expiry_pending'
    assert db_session.get(Consultation, original['id'], populate_existing=True).status == 'requested'
    assert not db_session.query(HealthAuditLog).filter_by(resource_id=original['id'], action='consultation_request_expired').count()


def test_sweep_releases_matching_slot_and_preserves_exact_retry(api, people, db_session):
    slot = publish(api, people); key = str(uuid4()); item = book(api, people, slot, key=key).json()
    due(db_session, item['id'])
    assert book(api, people, slot, who='other_patient').status_code == 409
    report = expiry.sweep(db_session)
    assert report['expired'] >= 1 and report['failed'] == 0
    result = read(api, people, item['id'])
    assert result['status'] == result['request_expiry_state'] == 'expired'
    assert result['expired_at'].endswith('+00:00') and result['scheduled_at'] == item['scheduled_at']
    assert book(api, people, slot, key=key).json()['status'] == 'expired'
    replacement = book(api, people, slot, who='other_patient')
    assert replacement.status_code == 200
    assert not expiry.expire_one(db_session, item['id'])
    db_session.commit()
    assert db_session.get(AppointmentSlot, slot['id'], populate_existing=True).reserved_consultation_id == replacement.json()['id']
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item['id'], action='consultation_request_expired').count() == 1
    notices = db_session.query(Notification).filter(Notification.event_key.like(f'consultation:{item["id"]}:expired%')).all()
    assert len(notices) == 2 and all(notice.related_entity_id == item['id'] for notice in notices)


@pytest.mark.parametrize('evidence', ['paid', 'payment_reference', 'unknown_payment', 'started', 'ended',
    'session_started', 'session_ended', 'session_active', 'joined', 'left', 'missing_deadline', 'invalid_chronology'])
def test_due_anomalies_stay_visible_blocking_and_held_for_review(api, people, db_session, evidence):
    if evidence.startswith('session_') or evidence in ('joined', 'left'):
        _, _, item, session_id = prepared(api, people, db_session)
        stored = due(db_session, item['id']); stored.status = 'requested'
        room = db_session.get(TeleconsultationSession, session_id)
        if evidence == 'session_active': room.status = 'in_progress'
        elif evidence.startswith('session_'): setattr(room, evidence.removeprefix('session_') + '_at', datetime.utcnow())
        else:
            participant = db_session.query(TeleconsultationParticipant).filter_by(session_id=session_id).first()
            setattr(participant, evidence + '_at', datetime.utcnow())
    else:
        item = book(api, people).json(); stored = due(db_session, item['id'])
        if evidence == 'paid': stored.payment_status = 'paid'
        elif evidence == 'payment_reference': stored.payment_id = str(uuid4())
        elif evidence == 'unknown_payment': stored.payment_status = 'legacy_unknown'
        elif evidence == 'missing_deadline': stored.requested_expires_at = None
        elif evidence == 'invalid_chronology': stored.requested_expires_at = stored.created_at - timedelta(hours=1)
        else: setattr(stored, evidence + '_at', datetime.utcnow())
    db_session.commit()
    assert read(api, people, item['id'])['request_expiry_state'] == 'review_required'
    queue = api.get('/api/v1/doctor/queue', headers=people['doctor']['headers']).json()
    assert next(row for row in queue if row['id'] == item['id'])['request_expiry_state'] == 'review_required'
    assert not expiry.expire_one(db_session, item['id'])
    db_session.commit()
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people['doctor']['headers']).status_code == 409
    if not evidence.startswith('session_') and evidence not in ('joined', 'left'):
        assert book(api, people).status_code == 409


def test_preparation_without_actual_care_does_not_prevent_expiry(api, people, db_session):
    _, _, item, session_id = prepared(api, people, db_session)
    stored = due(db_session, item['id']); stored.status = 'requested'; db_session.commit()
    assert expiry.expire_one(db_session, item['id'])
    db_session.commit()
    assert db_session.get(TeleconsultationSession, session_id).preflight_note == 'Private preparation'
    assert read(api, people, item['id'])['status'] == 'expired'


@pytest.mark.parametrize('evidence', ['started', 'ended', 'joined', 'left'])
def test_patient_cannot_cancel_actual_care_disguised_as_an_unaccepted_request(api, people, db_session, evidence):
    _, _, item, session_id = prepared(api, people, db_session)
    stored = due(db_session, item['id']); stored.status = 'requested'
    if evidence in ('started', 'ended'):
        setattr(stored, evidence + '_at', datetime.utcnow())
    else:
        participant = db_session.query(TeleconsultationParticipant).filter_by(session_id=session_id).first()
        setattr(participant, evidence + '_at', datetime.utcnow())
    db_session.commit()
    result = api.patch(f'/api/v1/consultations/{item["id"]}', headers=people['patient']['headers'], json={})
    assert result.status_code == 409
    assert db_session.get(Consultation, item['id'], populate_existing=True).status == 'requested'


def test_patient_can_cancel_a_safe_overdue_request_before_worker_runs(api, people, db_session):
    item = book(api, people).json(); due(db_session, item['id'])
    result = api.patch(f'/api/v1/consultations/{item["id"]}', headers=people['patient']['headers'], json={})
    assert result.status_code == 200 and result.json()['status'] == 'cancelled'


@pytest.mark.parametrize('payment_status', ['pending', 'paid', 'failed', 'refunded'])
def test_any_linked_financial_record_blocks_move_and_automatic_expiry(api, people, db_session, payment_status):
    first, target, item = pair(api, people)
    db_session.add(HealthPayment(patient_id=item['patient_id'], consultation_id=item['id'], amount=100,
        currency='AOA', status=payment_status, provider='synthetic'))
    db_session.commit()
    assert db_session.get(Consultation, item['id']).payment_id is None
    result = move(api, people, item, target)
    assert result.status_code == 409 and result.json()['detail']['request_key_committed'] is False
    due(db_session, item['id'])
    assert read(api, people, item['id'])['request_expiry_state'] == 'review_required'
    assert not expiry.expire_one(db_session, item['id'])
    db_session.commit()
    assert db_session.get(AppointmentSlot, first['id'], populate_existing=True).reserved_consultation_id == item['id']


@pytest.mark.parametrize('status', ['scheduled', 'in_progress', 'cancelled', 'completed'])
def test_accepted_or_terminal_consultations_never_expire(api, people, db_session, status):
    item = book(api, people).json(); stored = due(db_session, item['id']); stored.status = status; db_session.commit()
    assert not expiry.expire_one(db_session, item['id'])
    db_session.commit()
    assert read(api, people, item['id'])['request_expiry_state'] is None


def test_move_refreshes_deadline_once_and_cannot_rescue_overdue_request(api, people, db_session):
    _, target, item = pair(api, people)
    stored = db_session.get(Consultation, item['id']); stored.requested_expires_at = datetime.utcnow() + timedelta(hours=1); db_session.commit()
    key = str(uuid4()); result = move(api, people, item, target, key=key)
    assert result.status_code == 200 and result.json()['requested_expires_at'] > item['created_at']
    replay = move(api, people, item, target, key=key)
    assert replay.json()['requested_expires_at'] == result.json()['requested_expires_at']
    due(db_session, item['id'])
    rejected = move(api, people, result.json(), target)
    assert rejected.status_code == 409 and rejected.json()['detail']['request_key_committed'] is False
    assert move(api, people, item, target, key=key).json()['request_expiry_state'] == 'expiry_pending'


@pytest.mark.parametrize('failure', ['audit', 'notification'])
def test_failure_rolls_back_expiry_slot_release_and_notices(api, people, db_session, monkeypatch, failure):
    slot = publish(api, people); item = book(api, people, slot).json(); due(db_session, item['id'])
    def fail(mapper, connection, row):
        if row.action == 'consultation_request_expired': raise RuntimeError('Synthetic audit failure')
    if failure == 'audit': event.listen(HealthAuditLog, 'before_insert', fail)
    else:
        from app.services import notifications
        original = notifications.consultation_event
        monkeypatch.setattr(notifications, 'consultation_event', lambda *args: (_ for _ in ()).throw(RuntimeError('Synthetic notice failure')))
    try:
        report = expiry.sweep(db_session)
        assert report['failed'] >= 1
    finally:
        if failure == 'audit': event.remove(HealthAuditLog, 'before_insert', fail)
        else: monkeypatch.setattr(notifications, 'consultation_event', original)
    assert db_session.get(Consultation, item['id'], populate_existing=True).status == 'requested'
    assert db_session.get(AppointmentSlot, slot['id'], populate_existing=True).reserved_consultation_id == item['id']
    assert not db_session.query(Notification).filter(Notification.event_key.like(f'consultation:{item["id"]}:expired%')).count()
    assert expiry.expire_one(db_session, item['id']); db_session.commit()


def test_sweep_is_bounded_and_sql_candidates_skip_payment_anomalies(api, people, db_session):
    ids = []
    for index in range(5):
        item = Consultation(patient_id=people['patient']['profile'].id,
            created_at=datetime.utcnow() - timedelta(days=20), requested_expires_at=datetime.utcnow() - timedelta(days=10),
            payment_status='paid' if index == 0 else 'pending')
        db_session.add(item); db_session.flush(); ids.append(item.id)
    db_session.commit()
    result = expiry.sweep(db_session, limit=2)
    assert result['scanned'] == result['expired'] == 2 and result['has_more']
    assert db_session.get(Consultation, ids[0], populate_existing=True).status == 'requested'
    with pytest.raises(ValueError): expiry.sweep(db_session, limit=0)


def test_accept_rechecks_deadline_after_loading_a_stale_open_request(api, people, db_session):
    item = book(api, people).json()
    with Session(engine) as stale:
        captured = stale.get(Consultation, item['id'])
        assert captured.requested_expires_at > datetime.utcnow()
        due(db_session, item['id'])
        with pytest.raises(HTTPException) as error:
            transition(stale, captured, actor_id=people['doctor']['user'].id,
                action='consultation_accepted', allowed_from=('requested',), status='in_progress',
                doctor_id=people['doctor']['profile'].id)
        assert error.value.status_code == 409


def test_boundary_instant_is_due_and_read_annotation_batches_care_checks(api, people, db_session):
    one = book(api, people).json(); stored = due(db_session, one['id'])
    at = stored.requested_expires_at
    assert expiry.annotate_expiry([stored], db_session, now=at)[0].request_expiry_state == 'expiry_pending'
    assert expiry.annotate_expiry([stored], db_session, now=at - timedelta(microseconds=1))[0].request_expiry_state == 'open'
    assert db_session.query(Consultation).filter(Consultation.id == stored.id, expiry.safely_due_sql(at)).count() == 1


def test_deadline_normalizes_aware_server_instants():
    now = datetime(2026, 1, 1, 10, tzinfo=timezone.utc)
    appointment = now.astimezone(ZoneInfo('Africa/Luanda')) + timedelta(hours=1)
    assert expiry.deadline(appointment, now=now) == datetime(2026, 1, 1, 11)


def test_worker_cli_refuses_hold_before_initializing_database(monkeypatch):
    from app import database, expire_consultation_requests
    monkeypatch.setenv('KAYA_EXECUTION_MODE', 'hold')
    monkeypatch.setattr('sys.argv', ['expiry-worker', '--limit', '10'])
    monkeypatch.setattr(database, 'init_db_engine', lambda: pytest.fail('HOLD must not open a database'))
    with pytest.raises(SystemExit) as error:
        expire_consultation_requests.main()
    assert error.value.code == 2


def test_assigned_history_exposes_profile_name_without_email_fallback(api, people, db_session):
    slot = publish(api, people); item = book(api, people, slot).json()
    db_session.add(UserProfile(user_id=people['patient']['user'].id, full_name='Synthetic Patient Name'))
    db_session.commit()
    result = api.get('/api/v1/doctor/consultations/page', headers=people['doctor']['headers'])
    row = next(row for row in result.json()['items'] if row['id'] == item['id'])
    assert row['patient_name'] == 'Synthetic Patient Name' and row['request_expiry_state'] == 'open'
    assert people['patient']['user'].email not in result.text


def migration():
    spec = importlib.util.spec_from_file_location('expiry_migration', Path(__file__).parents[1] / 'alembic/versions/consultation_request_expiry_v1.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_migration_backfills_valid_chronology_preserves_unknown_and_never_changes_status():
    database = create_engine('sqlite://')
    with database.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE consultations (id VARCHAR(36) PRIMARY KEY, status VARCHAR(20), created_at DATETIME, scheduled_at DATETIME, reschedule_revision INTEGER)')
        connection.exec_driver_sql('CREATE TABLE consultation_reschedules (consultation_id VARCHAR(36), revision INTEGER, created_at DATETIME)')
        connection.exec_driver_sql('CREATE TABLE health_audit_logs (id VARCHAR(36), actor_user_id VARCHAR(36), action VARCHAR(100), resource_type VARCHAR(50), resource_id VARCHAR(36), metadata_json TEXT, created_at DATETIME)')
        connection.exec_driver_sql("INSERT INTO consultations VALUES ('queue','requested','2026-01-01 10:00:00',NULL,0), ('timed','requested','2026-01-01 10:00:00','2026-01-01 12:00:00',0), ('invalid','requested','broken',NULL,0), ('accepted','scheduled','2026-01-01 10:00:00',NULL,0), ('moved','requested','2026-01-01 10:00:00','2026-01-05 10:00:00',1), ('missing_move','requested','2026-01-01 10:00:00',NULL,1)")
        connection.exec_driver_sql("INSERT INTO consultation_reschedules VALUES ('moved',1,'2026-01-03 10:00:00')")
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade(); migration().upgrade()
            rows = {r[0]: r[1:] for r in connection.execute(text('SELECT id,status,requested_expires_at,expired_at FROM consultations'))}
            assert rows['queue'][1] == '2026-01-02 10:00:00' and rows['timed'][1] == '2026-01-01 12:00:00'
            assert rows['moved'][1] == '2026-01-04 10:00:00'
            assert all(rows[key][1] is None for key in ('invalid', 'accepted', 'missing_move'))
            assert rows['queue'][0] == 'requested' and all(row[2] is None for row in rows.values())
            audits = connection.execute(text('SELECT resource_id,metadata_json FROM health_audit_logs')).all()
            assert {row[0] for row in audits} == {'queue', 'timed', 'moved'}
            assert json.loads(next(row[1] for row in audits if row[0] == 'moved'))['source'] == 'reschedule_created_at'
            with pytest.raises(RuntimeError, match='Retained'): migration().downgrade()
    database.dispose()


def test_migration_adoption_requires_the_expiry_index_and_preserves_runtime_schema():
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        migration().upgrade()
    database = create_engine('sqlite://')
    with database.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE consultations (id VARCHAR(36), status VARCHAR(20), requested_expires_at DATETIME, expired_at DATETIME)')
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match='index'): migration().upgrade()
    database.dispose()
