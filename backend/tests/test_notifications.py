"""Synthetic atomic in-app delivery, private inbox and retry regressions."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import importlib.util
import json
from pathlib import Path
from threading import Barrier
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.health_models import ClinicalCareTask, Consultation, ConsultationNotes, HealthAuditLog, Notification
from app.health_schemas import NotificationOut
from app.models import User
from app.routers import appointments, clinical_operations, consultations, messages, notifications, teleconsultation
from app.services import notifications as service
from tests.test_consultation_lifecycle import people, seed_consultation
from tests.test_consultation_closeout import payload, video
from tests.test_appointments import publish, book


@pytest.fixture
def api():
    app = FastAPI()
    for router in (appointments.router, clinical_operations.router, consultations.router,
                   messages.router, notifications.router, teleconsultation.router):
        app.include_router(router)
    with TestClient(app) as client:
        yield client


def add_notifications(db, user_id, count=1, created_at=None, is_read=False):
    rows = [Notification(user_id=user_id, title=f'Synthetic {number}', message='Synthetic inbox item',
                         is_read=is_read, created_at=created_at or datetime.utcnow()) for number in range(count)]
    db.add_all(rows)
    db.commit()
    return rows


def inbox(api, people, who='patient', suffix=''):
    return api.get('/api/v1/notifications/inbox' + suffix, headers=people[who]['headers'])


def test_capabilities_only_claim_in_app_and_require_authentication(api, people):
    assert api.get('/api/v1/notifications/capabilities').status_code == 403
    result = api.get('/api/v1/notifications/capabilities', headers=people['patient']['headers'])
    assert result.json() == {'channels': {'in_app': True, 'email': False, 'sms': False, 'push': False},
                             'read_is_care_acknowledgement': False}
    assert result.headers['cache-control'] == 'private, no-store'


def test_cursor_pagination_handles_equal_timestamps_without_duplicates(api, people, db_session):
    rows = add_notifications(db_session, people['patient']['user'].id, 5, datetime(2026, 1, 1, 12))
    add_notifications(db_session, people['other_patient']['user'].id, 2)
    first = inbox(api, people, suffix='?limit=2').json()
    assert len(first['items']) == 2 and first['unread_count'] == 5
    # A new item arriving after page one belongs to refresh, not an older page.
    newer = add_notifications(db_session, people['patient']['user'].id)[0]
    second = inbox(api, people, suffix='?limit=2&cursor=' + first['next_cursor']).json()
    third = inbox(api, people, suffix='?limit=2&cursor=' + second['next_cursor']).json()
    ids = [row['id'] for page in (first, second, third) for row in page['items']]
    assert ids == sorted([row.id for row in rows], reverse=True)
    assert newer.id not in ids and third['next_cursor'] is None and third['unread_count'] == 6


def test_unread_filter_and_count_cover_more_than_first_page(api, people, db_session):
    add_notifications(db_session, people['patient']['user'].id, 5)
    add_notifications(db_session, people['patient']['user'].id, 2, is_read=True)
    result = inbox(api, people, suffix='?limit=2&unread_only=true')
    assert len(result.json()['items']) == 2 and result.json()['unread_count'] == 5
    assert all(not row['is_read'] for row in result.json()['items'])
    count = api.get('/api/v1/notifications/unread-count', headers=people['patient']['headers'])
    assert count.json() == {'unread': 5}
    assert result.headers['cache-control'] == count.headers['cache-control'] == 'private, no-store'


@pytest.mark.parametrize('query', ['?limit=0', '?limit=-1', '?limit=101', '?cursor=', '?cursor=invalid!', '?cursor=' + 'x' * 513])
def test_inbox_rejects_unbounded_or_invalid_input(api, people, query):
    assert inbox(api, people, suffix=query).status_code == 422


def test_cursor_cannot_change_owner_or_filter(api, people, db_session):
    add_notifications(db_session, people['patient']['user'].id, 3)
    token = inbox(api, people, suffix='?limit=1').json()['next_cursor']
    assert inbox(api, people, who='other_patient', suffix='?cursor=' + token).status_code == 422
    assert inbox(api, people, suffix='?unread_only=true&cursor=' + token).status_code == 422


@pytest.mark.parametrize('stamp', ['not-a-date', '2026-01-01T00:00:00', 10, None])
def test_cursor_rejects_invalid_timestamps(api, people, stamp):
    value = {'v': 1, 'owner': people['patient']['user'].id, 'unread': False, 'id': str(uuid4()), 'at': stamp}
    token = base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    assert inbox(api, people, suffix='?cursor=' + token).status_code == 422


def test_legacy_list_stays_array_bounded_and_serializes_utc(api, people, db_session):
    row = add_notifications(db_session, people['patient']['user'].id)[0]
    response = api.get('/api/v1/notifications/me?limit=1', headers=people['patient']['headers'])
    assert isinstance(response.json(), list) and response.json()[0]['id'] == row.id
    assert response.json()[0]['created_at'].endswith('+00:00')
    assert response.json()[0]['channel'] == 'in_app' and response.json()[0]['read_at'] is None
    assert response.headers['cache-control'] == 'private, no-store'
    assert api.get('/api/v1/notifications/me?limit=-1', headers=people['patient']['headers']).status_code == 422


def test_read_owner_isolation_first_timestamp_and_audit_idempotency(api, people, db_session):
    row = add_notifications(db_session, people['patient']['user'].id)[0]
    url = f'/api/v1/notifications/{row.id}/read'
    assert api.patch(url, headers=people['other_patient']['headers']).status_code == 404
    first = api.patch(url, headers=people['patient']['headers'])
    second = api.patch(url, headers=people['patient']['headers'])
    assert first.status_code == second.status_code == 200
    assert first.json()['is_read'] is True
    assert first.json()['read_at'].endswith('+00:00') and first.json()['read_at'] == second.json()['read_at']
    assert first.headers['cache-control'] == 'private, no-store'
    audits = db_session.query(HealthAuditLog).filter_by(resource_id=row.id).all()
    assert len(audits) == 1 and audits[0].action == 'notification_marked_read'
    assert not audits[0].metadata_json


def test_mark_all_is_owned_audited_and_does_not_hide_later_arrivals(api, people, db_session):
    add_notifications(db_session, people['patient']['user'].id, 3)
    foreign = add_notifications(db_session, people['other_patient']['user'].id)[0]
    result = api.patch('/api/v1/notifications/read-all', headers=people['patient']['headers'])
    assert result.json() == {'ok': True, 'updated_count': 3}
    assert result.headers['cache-control'] == 'private, no-store'
    assert api.patch('/api/v1/notifications/read-all', headers=people['patient']['headers']).json()['updated_count'] == 0
    add_notifications(db_session, people['patient']['user'].id)
    assert inbox(api, people).json()['unread_count'] == 1
    db_session.refresh(foreign)
    assert foreign.is_read is False
    audits = db_session.query(HealthAuditLog).filter_by(resource_id=people['patient']['user'].id, action='notifications_marked_read').all()
    assert len(audits) == 1 and json.loads(audits[0].metadata_json) == {'updated_count': 3}


@pytest.mark.parametrize('all_rows', [False, True])
def test_read_audit_failure_rolls_back_markers(api, people, db_session, all_rows):
    row = add_notifications(db_session, people['patient']['user'].id)[0]
    def fail(mapper, connection, target):
        if target.action in ('notification_marked_read', 'notifications_marked_read'):
            raise RuntimeError('synthetic audit failure')
    event.listen(HealthAuditLog, 'before_insert', fail)
    try:
        path = '/api/v1/notifications/read-all' if all_rows else f'/api/v1/notifications/{row.id}/read'
        assert api.patch(path, headers=people['patient']['headers']).status_code == 503
    finally:
        event.remove(HealthAuditLog, 'before_insert', fail)
    db_session.refresh(row)
    assert row.is_read is False and row.read_at is None


def test_concurrent_read_has_one_audit(api, people, db_session):
    row = add_notifications(db_session, people['patient']['user'].id)[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(api.patch, f'/api/v1/notifications/{row.id}/read', headers=people['patient']['headers']) for _ in range(2)]
        results = [future.result() for future in futures]
    assert [result.status_code for result in results] == [200, 200]
    assert db_session.query(HealthAuditLog).filter_by(resource_id=row.id, action='notification_marked_read').count() == 1


def test_enqueue_does_not_commit_or_rollback_the_caller(people, db_session):
    key = 'synthetic:' + str(uuid4())
    with Session(engine) as transaction:
        row = service.enqueue_notification(transaction, user_id=people['patient']['user'].id, event_key=key, title='One', message='Two')
        again = service.enqueue_notification(transaction, user_id=people['patient']['user'].id, event_key=key, title='One', message='Two')
        assert row.id == again.id
        assert db_session.query(Notification).filter_by(event_key=key).count() == 0
        transaction.rollback()
    assert db_session.query(Notification).filter_by(event_key=key).count() == 0


def test_concurrent_enqueue_deduplicates_without_losing_other_transaction_work(people, db_session):
    key, barrier = 'synthetic:' + str(uuid4()), Barrier(2)
    user_id = people['patient']['user'].id
    def insert(marker):
        with Session(engine) as transaction:
            barrier.wait(timeout=5)
            row = service.enqueue_notification(transaction, user_id=user_id, event_key=key, title='One', message='Two')
            transaction.add(HealthAuditLog(actor_user_id=user_id, action='synthetic_concurrent_notification', resource_type='notification', resource_id=marker))
            transaction.commit()
            return row.id
    markers = [str(uuid4()), str(uuid4())]
    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(insert, markers))
    assert ids[0] == ids[1]
    assert db_session.query(Notification).filter_by(event_key=key).count() == 1
    assert db_session.query(HealthAuditLog).filter(HealthAuditLog.resource_id.in_(markers)).count() == 2


def test_legacy_helper_still_commits_its_callers_pending_work(people, db_session):
    marker = str(uuid4())
    with Session(engine) as transaction:
        transaction.add(HealthAuditLog(actor_user_id=people['patient']['user'].id,
                        action='synthetic_legacy_commit', resource_type='notification', resource_id=marker))
        row = notifications.create_notification(transaction, people['patient']['user'].id, 'Legacy', 'Legacy')
        identifier = row.id
    assert db_session.get(Notification, identifier) is not None
    assert db_session.query(HealthAuditLog).filter_by(resource_id=marker).count() == 1


def test_booking_replay_has_exactly_one_event_per_recipient(api, people, db_session):
    slot = publish(api, people)
    key = str(uuid4())
    item = book(api, people, slot, key=key).json()
    assert book(api, people, slot, key=key).json()['id'] == item['id']
    rows = db_session.query(Notification).filter_by(event_key=f"consultation:{item['id']}:booked").all()
    assert {row.user_id for row in rows} == {people['patient']['user'].id, people['doctor']['user'].id}
    assert len(rows) == 2


def test_failed_notification_rolls_back_booking_and_reservation(api, people, db_session, monkeypatch):
    slot = publish(api, people)
    def fail(*args, **kwargs): raise RuntimeError('synthetic notification failure')
    monkeypatch.setattr(service, 'enqueue_notification', fail)
    assert book(api, people, slot).status_code == 503
    from app.health_models import AppointmentSlot
    assert db_session.query(Consultation).filter_by(slot_id=slot['id']).count() == 0
    assert db_session.get(AppointmentSlot, slot['id']).reserved_consultation_id is None


def test_accept_start_cancel_notifications_share_clinical_state_transaction(api, people, db_session, monkeypatch):
    slot = publish(api, people)
    item = book(api, people, slot).json()
    assert api.post(f"/api/v1/doctor/queue/{item['id']}/accept", headers=people['doctor']['headers']).status_code == 200
    assert api.post(f"/api/v1/doctor/queue/{item['id']}/start", headers=people['doctor']['headers']).status_code == 200
    original = service.enqueue_notification
    def fail(*args, **kwargs): raise RuntimeError('synthetic notification failure')
    monkeypatch.setattr(service, 'enqueue_notification', fail)
    response = api.patch(f"/api/v1/consultations/{item['id']}", json={}, headers=people['doctor']['headers'])
    assert response.status_code == 503
    db_session.expire_all()
    assert db_session.get(Consultation, item['id']).status == 'in_progress'
    monkeypatch.setattr(service, 'enqueue_notification', original)
    assert api.patch(f"/api/v1/consultations/{item['id']}", json={}, headers=people['doctor']['headers']).status_code == 200
    keys = [row.event_key for row in db_session.query(Notification).filter_by(user_id=people['patient']['user'].id).all()]
    assert set(keys) == {f"consultation:{item['id']}:{name}" for name in ('booked', 'accepted', 'started', 'cancelled')}


def close_with_follow_up(api, people, db_session):
    item = seed_consultation(db_session, people, 'in_progress')
    body = payload(follow_up_required=True, follow_up_due_at=(datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                   follow_up_instructions='Private explicitly disclosed follow-up')
    response = api.post(f'/api/v1/consultations/{item.id}/complete', json=body, headers=people['doctor']['headers'])
    assert response.status_code == 200, response.text
    task = db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).one()
    return item, task, body


def test_closeout_follow_up_and_completion_are_private_and_retry_deduped(api, people, db_session):
    item, task, body = close_with_follow_up(api, people, db_session)
    assert api.post(f'/api/v1/consultations/{item.id}/complete', json=body, headers=people['doctor']['headers']).status_code == 200
    url = f'/api/v1/clinical-operations/care-tasks/{task.id}/complete'
    for _ in range(2):
        result = api.post(url, json={'completion_note': 'Private completion note'}, headers=people['doctor']['headers'])
        assert result.status_code == 200, result.text
    rows = db_session.query(Notification).filter_by(user_id=people['patient']['user'].id).all()
    assert {row.event_key for row in rows} == {f'consultation:{item.id}:closed', f'task:{task.id}:created', f'task:{task.id}:completed'}
    assert len(rows) == 3
    assert all(row.related_entity_type == 'consultation' and row.related_entity_id == item.id for row in rows)
    assert all('Private' not in row.title + row.message and 'assessment' not in row.message for row in rows)


def test_closeout_notification_failure_rolls_back_notes_follow_up_and_state(api, people, db_session, monkeypatch):
    item = seed_consultation(db_session, people, 'in_progress')
    def fail(*args, **kwargs): raise RuntimeError('synthetic notification failure')
    monkeypatch.setattr(service, 'enqueue_notification', fail)
    body = payload(follow_up_required=True, follow_up_due_at=(datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                   follow_up_instructions='Private follow-up')
    response = api.post(f'/api/v1/consultations/{item.id}/complete', json=body, headers=people['doctor']['headers'])
    assert response.status_code == 503
    db_session.refresh(item)
    assert item.status == 'in_progress'
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 0
    assert db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).count() == 0


def test_internal_follow_up_task_never_notifies_patient(api, people, db_session):
    item = seed_consultation(db_session, people, 'in_progress')
    response = api.post('/api/v1/clinical-operations/care-tasks', headers=people['doctor']['headers'], json={
        'patient_id': item.patient_id, 'consultation_id': item.id, 'assigned_role': 'doctor',
        'assigned_user_id': people['doctor']['user'].id, 'task_type': 'follow_up',
        'title': 'Private internal investigation', 'instructions': 'Private internal instructions'})
    assert response.status_code == 201, response.text
    task_id = response.json()['id']
    assert api.post(f'/api/v1/clinical-operations/care-tasks/{task_id}/complete', json={}, headers=people['doctor']['headers']).status_code == 200
    assert db_session.query(Notification).filter_by(user_id=people['patient']['user'].id).count() == 0
    doctor_rows = db_session.query(Notification).filter_by(user_id=people['doctor']['user'].id).all()
    assert len(doctor_rows) == 2 and all('Private' not in row.message + row.title for row in doctor_rows)


def test_follow_up_completion_notification_failure_preserves_open_task(api, people, db_session, monkeypatch):
    item, task, _ = close_with_follow_up(api, people, db_session)
    def fail(*args, **kwargs): raise RuntimeError('synthetic notification failure')
    monkeypatch.setattr(service, 'enqueue_notification', fail)
    response = api.post(f'/api/v1/clinical-operations/care-tasks/{task.id}/complete', json={}, headers=people['doctor']['headers'])
    assert response.status_code == 503
    db_session.refresh(task)
    assert task.status == 'open'
    assert db_session.query(Notification).filter_by(event_key=f'task:{task.id}:completed').count() == 0


def test_legacy_message_notification_omits_message_preview(api, people, db_session):
    item = seed_consultation(db_session, people, 'in_progress')
    response = api.post(f'/api/v1/consultations/{item.id}/messages', json={'body': 'Secret clinical detail'}, headers=people['patient']['headers'])
    assert response.status_code == 201, response.text
    rows = db_session.query(Notification).filter_by(user_id=people['doctor']['user'].id).all()
    assert len(rows) == 1 and 'Secret' not in rows[0].message


def migration():
    spec = importlib.util.spec_from_file_location('notifications_migration', Path(__file__).parents[1] / 'alembic/versions/durable_notifications_v1.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_preserves_legacy_read_without_fabricating_timestamp(tmp_path):
    local = create_engine(f'sqlite:///{tmp_path / "notification-migration.db"}')
    with local.begin() as connection:
        connection.execute(text('CREATE TABLE notifications (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36), is_read BOOLEAN, created_at DATETIME)'))
        connection.execute(text("INSERT INTO notifications VALUES ('legacy', 'user', 1, '2026-01-01 12:00:00')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade()
            row = connection.execute(text('SELECT is_read, read_at, event_key FROM notifications')).one()
            assert tuple(row) == (1, None, None)
            migration().downgrade()
        assert connection.execute(text('SELECT id FROM notifications')).scalar() == 'legacy'


def test_migration_adopts_create_all_and_rejects_missing_event_uniqueness(tmp_path):
    local = create_engine(f'sqlite:///{tmp_path / "notification-adoption.db"}')
    Base.metadata.create_all(local)
    with local.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        migration().upgrade()
        connection.execute(text('DROP INDEX uq_notifications_user_event'))
        with pytest.raises(RuntimeError, match='uniqueness'):
            migration().upgrade()
