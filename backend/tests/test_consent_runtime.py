"""Exact consent, withdrawal, recovery and retained clinical evidence boundaries."""
from datetime import datetime, timedelta
from uuid import uuid4
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import event, text
from sqlalchemy.exc import IntegrityError

from app.health_models import ConsentCatalogDocument, PatientConsentEvent, PatientConsent, Patient, HealthAuditLog, Consultation, ConsultationConsentSnapshot
from app.models import User
from app.oauth2 import create_access_token
from app.routers import appointments, consultations, compliance, teleconsultation
from app.services import consent_runtime as consent
from consent_fixtures import catalog, references, grant_all, withdraw
from test_appointments import people, book, publish

ROOT = '/api/v1/compliance'


@pytest.fixture
def api():
    app = FastAPI()
    for router in (appointments.router, consultations.router, compliance.router, teleconsultation.router): app.include_router(router)
    with TestClient(app, raise_server_exceptions=False) as client: yield client


@pytest.fixture
def owner(db_session):
    user = User(email=f'consent-{uuid4().hex}@example.invalid', role='patient', password_hash='synthetic', is_active=True)
    db_session.add(user); db_session.flush()
    patient = Patient(user_id=user.id); db_session.add(patient); db_session.commit()
    return patient, {'Authorization': 'Bearer ' + create_access_token({'sub': user.email, 'uid': user.id, 'role': 'patient'})}


def decision(api, headers, body, key=None):
    return api.post(ROOT + '/consent', headers=headers | {'Idempotency-Key': key or str(uuid4())}, json=body)


def test_empty_catalog_and_old_type_declarations_never_authorize(api, owner, db_session):
    patient, headers = owner
    for purpose in consent.REQUIRED_PURPOSES:
        db_session.add(PatientConsent(patient_id=patient.id, consent_type=purpose))
    db_session.commit()
    response = api.get(ROOT + '/catalog', params={'country': 'AO', 'language': 'zz'}, headers=headers)
    assert response.status_code == 200 and not response.json()['available'] and response.json()['documents'] == []
    assert response.headers['cache-control'] == 'private, no-store'
    assert api.get(ROOT + '/catalog', headers=headers).status_code == 422
    assert decision(api, headers, {'consent_type': 'privacy_policy'}).status_code == 422
    denied = api.post('/api/v1/consultations/book', headers=headers,
        json={'country': 'AO', 'consent_language': 'zz', 'specialty': 'clinica_geral', 'next_available': True})
    assert denied.status_code == 403 and denied.json()['detail']['code'] == 'consent_required'
    assert all(not row['effective'] and row['evidence_status'] == 'legacy_unversioned' for row in api.get(ROOT + '/consents', headers=headers).json())


def test_exact_replay_after_withdrawal_preserves_original_receipt_and_current_state(api, owner, db_session):
    patient, headers = owner
    reference = references(db_session)[0]; db_session.commit()
    body = reference | {'action': 'grant', 'expected_revision': 0}; key = str(uuid4())
    granted = decision(api, headers, body, key)
    assert granted.status_code == 200, granted.text
    withdrawal = decision(api, headers, reference | {'action': 'withdraw', 'expected_revision': 1})
    assert withdrawal.status_code == 200
    replay = decision(api, headers, body, key.upper())
    assert replay.json()['event']['id'] == granted.json()['event']['id'] and replay.json()['revision'] == 2
    assert next(row for row in replay.json()['state']['states'] if row['purpose'] == granted.json()['event']['purpose'])['status'] == 'withdrawn'
    stale = decision(api, headers, body)
    assert stale.status_code == 409 and stale.json()['detail']['request_key_committed'] is False
    changed = decision(api, headers, body | {'action': 'refuse'}, key)
    assert changed.status_code == 409 and isinstance(changed.json()['detail'], str)
    assert db_session.query(PatientConsentEvent).filter_by(patient_id=patient.id).count() == 2
    assert api.get(ROOT + '/consent-requests/' + key, headers=headers).json()['event']['id'] == granted.json()['event']['id']
    missing = api.get(ROOT + '/consent-requests/' + str(uuid4()), headers=headers)
    assert missing.status_code == 404 and missing.json()['detail']['request_in_flight_may_commit'] is True


def test_history_cursor_and_lookup_are_owner_bound(api, owner, people, db_session):
    patient, headers = owner
    grant_all(db_session, patient); db_session.commit()
    first = api.get(ROOT + '/consent-history/page', params={'limit': 2}, headers=headers).json()
    assert len(first['items']) == 2 and first['next_cursor']
    second = api.get(ROOT + '/consent-history/page', params={'limit': 2, 'cursor': first['next_cursor']}, headers=headers).json()
    assert not {row['id'] for row in first['items']} & {row['id'] for row in second['items']}
    assert api.get(ROOT + '/consent-history/page', params={'cursor': first['next_cursor']}, headers=people['patient']['headers']).status_code == 422
    assert api.get(ROOT + '/consent-requests/' + first['items'][0]['request_key'], headers=people['patient']['headers']).status_code == 404


def test_market_and_language_grants_are_separate(api, owner, db_session):
    patient, headers = owner
    grant_all(db_session, patient, 'AO'); catalog(db_session, 'PT'); db_session.commit()
    response = api.post('/api/v1/consultations/book', headers=headers,
        json={'country': 'PT', 'specialty': 'clinica_geral', 'next_available': True})
    assert response.status_code == 403 and response.json()['detail']['country'] == 'PT'
    state = api.get(ROOT + '/consent-state', headers=headers, params={'country': 'PT'}).json()
    assert state['available'] and not any(row['effective'] for row in state['states'])


def test_retirement_blocks_fallback_but_allows_withdrawal_and_outcome_recovery(api, owner, db_session):
    patient, headers = owner
    rows = grant_all(db_session, patient); db_session.commit()
    event = rows[0]; previous = db_session.get(ConsentCatalogDocument, event.document_id)
    successor = ConsentCatalogDocument(**{column.name: getattr(previous, column.name) for column in previous.__table__.columns
        if column.name not in ('id', 'version', 'status', 'effective_from', 'created_at')}, version=previous.version + 1,
        status='retired', effective_from=datetime.utcnow() - timedelta(seconds=1))
    db_session.add(successor); db_session.commit()
    state = api.get(ROOT + '/consent-state', headers=headers, params={'country': 'AO'}).json()
    target = next(row for row in state['states'] if row['purpose'] == previous.purpose)
    assert target['status'] == 'unavailable' and target['document'] is None and not target['effective']
    reference = {name: getattr(previous, 'id' if name == 'document_id' else name) for name in ('document_id', 'version', 'content_hash', 'country', 'language')}
    assert decision(api, headers, reference | {'action': 'grant', 'expected_revision': 5}).status_code == 409
    result = decision(api, headers, reference | {'action': 'withdraw', 'expected_revision': 5})
    assert result.status_code == 200 and result.json()['event']['action'] == 'withdraw'
    assert api.get(ROOT + '/consent-requests/' + event.request_key, headers=headers).status_code == 200


def test_booking_recovery_survives_withdrawal_but_fresh_acceptance_does_not(api, people, db_session):
    slot = publish(api, people); key = str(uuid4()); item = book(api, people, slot, key=key).json()
    withdraw(db_session, people['patient']['profile'], 'telemedicine_consent'); db_session.commit()
    assert book(api, people, slot, key=key).json()['id'] == item['id']
    denied = api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people['doctor']['headers'])
    assert denied.status_code == 403
    assert db_session.get(Consultation, item['id'], populate_existing=True).status == 'requested'


def test_actual_start_captures_retained_episode_proof(api, people, db_session):
    item = book(api, people).json()
    accepted = api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people['doctor']['headers'])
    assert accepted.status_code == 200, accepted.text
    snapshot = db_session.query(ConsultationConsentSnapshot).filter_by(consultation_id=item['id']).one()
    assert len(json.loads(snapshot.grant_ids_json)) == 5
    withdraw(db_session, people['patient']['profile'], 'telemedicine_consent'); db_session.commit()
    consent.require_episode(db_session, db_session.get(Consultation, item['id'], populate_existing=True))
    with pytest.raises(Exception):
        db_session.execute(text('DELETE FROM consultation_consent_snapshots WHERE id=:id'), {'id': snapshot.id})
        db_session.commit()
    db_session.rollback()


def test_catalog_events_and_subject_replacement_are_retained(api, owner, db_session):
    patient, headers = owner
    rows = grant_all(db_session, patient); db_session.commit()
    event_id = rows[0].id; document_id = rows[0].document_id; patient_id = patient.id
    for statement, params in [
        ('UPDATE consent_catalog_documents SET content=:value WHERE id=:id', {'id': document_id, 'value': 'changed'}),
        ('DELETE FROM patient_consent_events WHERE id=:id', {'id': event_id}),
        ('INSERT OR REPLACE INTO patient_consent_events SELECT * FROM patient_consent_events WHERE id=:id', {'id': event_id}),
        ('INSERT OR REPLACE INTO patients SELECT * FROM patients WHERE id=:id', {'id': patient_id}),
    ]:
        with pytest.raises(IntegrityError):
            db_session.execute(text(statement), params); db_session.commit()
        db_session.rollback()
    assert db_session.query(PatientConsentEvent).filter_by(patient_id=patient_id).count() == 5


def test_audit_failure_rolls_back_grant_and_exact_retry_is_safe(api, owner, db_session):
    patient, headers = owner; body = references(db_session)[0] | {'action': 'grant', 'expected_revision': 0}; db_session.commit()
    key = str(uuid4())
    def fail(mapper, connection, row):
        if row.action == 'consent_grant': raise RuntimeError('Synthetic audit failure')
    event.listen(HealthAuditLog, 'before_insert', fail)
    try:
        assert decision(api, headers, body, key).status_code == 503
    finally: event.remove(HealthAuditLog, 'before_insert', fail)
    assert db_session.query(PatientConsentEvent).filter_by(patient_id=patient.id).count() == 0
    assert decision(api, headers, body, key).status_code == 200


def test_retired_version_cannot_be_replaced_or_silently_reapproved(db_session):
    document = catalog(db_session)[0]; db_session.commit()
    with pytest.raises(IntegrityError):
        db_session.execute(text('INSERT OR REPLACE INTO consent_catalog_documents SELECT * FROM consent_catalog_documents WHERE id=:id'), {'id': document.id})
        db_session.commit()
    db_session.rollback()


def test_consent_migration_has_no_implicit_approval_or_historical_market_backfill():
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, inspect
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    spec = importlib.util.spec_from_file_location('consent_migration', Path(__file__).parents[1] / 'alembic/versions/consent_runtime_v1.py')
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    database = create_engine('sqlite://')
    with database.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, email VARCHAR(200) UNIQUE)')
        connection.exec_driver_sql('CREATE TABLE patients (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) UNIQUE)')
        connection.exec_driver_sql('CREATE TABLE consultations (id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36), doctor_id VARCHAR(36), country VARCHAR(2), booking_request_key VARCHAR(36))')
        connection.exec_driver_sql('CREATE TABLE patient_documents (id VARCHAR(36) PRIMARY KEY)')
        connection.exec_driver_sql('CREATE TABLE triage_sessions (id VARCHAR(36) PRIMARY KEY)')
        connection.exec_driver_sql("INSERT INTO consultations (id) VALUES ('historical')")
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade(); migration.upgrade()
            assert connection.execute(text("SELECT consent_language FROM consultations WHERE id='historical'")).scalar() is None
            assert connection.execute(text('SELECT COUNT(*) FROM consent_catalog_documents')).scalar() == 0
            assert connection.execute(text('SELECT COUNT(*) FROM patient_consent_events')).scalar() == 0
            migration.downgrade()
            assert 'patient_consent_events' not in inspect(connection).get_table_names()
    database.dispose()


def test_new_photo_requires_required_processing_grant_even_when_images_remains(api, people, db_session):
    from app.routers import triage
    from app.health_models import TriageSession
    api.app.include_router(triage.router)
    grant_all(db_session, people['patient']['profile'], purposes=('images',))
    session = TriageSession(patient_id=people['patient']['profile'].id, country='AO', consent_language='pt', status='in_progress')
    db_session.add(session); db_session.commit()
    withdraw(db_session, people['patient']['profile'], 'health_data_processing'); db_session.commit()
    response = api.post(f'/api/v1/triage/{session.id}/photos', headers=people['patient']['headers'],
        data={'view_type': 'overview'}, files={'file': ('synthetic.png', b'not-a-live-file', 'image/png')})
    assert response.status_code == 403 and response.json()['detail']['code'] == 'consent_required'
    assert 'health_data_processing' in response.json()['detail']['missing_purposes']


@pytest.mark.parametrize('action', ['withdraw', 'refuse'])
def test_denial_blocks_older_translations_in_same_market_only(api, owner, db_session, action):
    patient, headers = owner
    grant_all(db_session, patient, 'AO', 'pt')
    grant_all(db_session, patient, 'AO', 'en')
    grant_all(db_session, patient, 'PT', 'pt')
    reference = references(db_session, 'AO', 'pt')[0]
    body = reference | {'action': action, 'expected_revision': consent.revision(db_session, patient.id)}
    db_session.commit()
    denied = decision(api, headers, body)
    assert denied.status_code == 200, denied.text
    purpose = denied.json()['event']['purpose']
    state = api.get(ROOT + '/consent-state', headers=headers, params={'country': 'AO', 'language': 'en'}).json()
    row = next(row for row in state['states'] if row['purpose'] == purpose)
    assert row['status'] == ('withdrawn' if action == 'withdraw' else 'refused') and not row['effective']
    assert row['latest_event']['language'] == 'pt'
    portugal = api.get(ROOT + '/consent-state', headers=headers, params={'country': 'PT', 'language': 'pt'}).json()
    assert all(row['effective'] for row in portugal['states'] if row['purpose'] in consent.REQUIRED_PURPOSES)
    current = next(row for row in references(db_session, 'AO', 'en') if db_session.get(ConsentCatalogDocument, row['document_id']).purpose == purpose)
    renewed = decision(api, headers, current | {'action': 'grant', 'expected_revision': state['revision']})
    assert renewed.status_code == 200
    assert next(row for row in renewed.json()['state']['states'] if row['purpose'] == purpose)['effective']


@pytest.mark.parametrize('broken', ['snapshot_unique', 'event_fk', 'hash_length'])
def test_migration_rejects_incomplete_bootstrapped_evidence_schema(broken):
    import importlib.util
    from pathlib import Path
    from sqlalchemy import create_engine, MetaData, UniqueConstraint, String
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from app.database import Base
    spec = importlib.util.spec_from_file_location('broken_consent_migration', Path(__file__).parents[1] / 'alembic/versions/consent_runtime_v1.py')
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    metadata = MetaData()
    for table in Base.metadata.tables.values(): table.to_metadata(metadata)
    if broken == 'snapshot_unique':
        table = metadata.tables['consultation_consent_snapshots']
        table.constraints.remove(next(constraint for constraint in table.constraints if isinstance(constraint, UniqueConstraint)))
    elif broken == 'event_fk':
        table = metadata.tables['patient_consent_events']
        table.constraints.remove(next(constraint for constraint in table.foreign_key_constraints if list(constraint.columns)[0].name == 'document_id'))
    else:
        metadata.tables['consent_catalog_documents'].c.content_hash.type = String(63)
    database = create_engine('sqlite://')
    metadata.create_all(database)
    with database.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        with pytest.raises(RuntimeError, match='Invalid consent evidence'):
            migration.upgrade()
    database.dispose()

@pytest.mark.parametrize('denial_language', ['pt', 'en'])
def test_state_uses_one_immutable_revision_prefix(owner, db_session, monkeypatch, denial_language):
    patient, _ = owner
    grant_all(db_session, patient)
    if denial_language != 'pt': grant_all(db_session, patient, language=denial_language)
    db_session.commit()
    displayed_revision = consent.revision(db_session, patient.id)
    reference = references(db_session)[0]
    original = consent.latest_events
    called = False

    def append_after_revision(db, patient_id, country, language, **kwargs):
        nonlocal called
        if not called:
            called = True
            withdraw(db, patient, 'privacy_policy', language=denial_language)
            db.commit()
        return original(db, patient_id, country, language, **kwargs)

    monkeypatch.setattr(consent, 'latest_events', append_after_revision)
    state = consent.state_out(db_session, patient.id, 'AO', 'pt')
    assert state['revision'] == displayed_revision
    required = [row for row in state['states'] if row['purpose'] in consent.REQUIRED_PURPOSES]
    assert all(row['effective'] for row in required)
    assert all(row['latest_event']['sequence'] <= displayed_revision for row in required)
    current = consent.state_out(db_session, patient.id, 'AO', 'pt')
    assert current['revision'] == displayed_revision + 1
    assert next(row for row in current['states'] if row['purpose'] == 'privacy_policy')['status'] == 'withdrawn'
    with pytest.raises(Exception) as error:
        consent.append_event(db_session, patient, patient.user_id,
            reference | {'action': 'grant', 'expected_revision': state['revision']}, str(uuid4()))
    assert error.value.status_code == 409 and error.value.detail['request_key_committed'] is False
