"""Consent-scoped readings ingestion, atomic retries and legacy personal access."""
from datetime import datetime, timedelta
from uuid import uuid4
import importlib.util
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.health_models import DeviceReading, Patient
from app.models import User
from app.oauth2 import create_access_token
from app.routers import readings
from consent_fixtures import grant_all, withdraw

ROOT = '/api/v1/readings'
CSV = 'Date,Weight(kg)\n2026-01-01T10:00:00+01:00,72.5\n'


@pytest.fixture
def api():
    app = FastAPI(); app.include_router(readings.router)
    with TestClient(app, raise_server_exceptions=False) as client: yield client


@pytest.fixture
def owner(db_session):
    user = User(email=f'readings-{uuid4().hex}@example.invalid', role='patient', is_active=True)
    db_session.add(user); db_session.flush()
    patient = Patient(user_id=user.id); db_session.add(patient); db_session.commit()
    headers = {'Authorization': 'Bearer ' + create_access_token({'uid': user.id, 'sub': user.email, 'role': user.role})}
    return patient, headers


def allow(db, patient, country='AO', language='pt', devices=False):
    grant_all(db, patient, country, language)
    if devices: grant_all(db, patient, country, language, purposes=('devices',))
    db.commit()


def sample(**overrides):
    return {'external_id': str(uuid4()), 'reading_type': 'weight', 'value': 72.5, 'unit': 'kg',
        'measured_at': (datetime.utcnow() - timedelta(hours=1)).isoformat() + 'Z', 'source': 'apple_health', **overrides}


def sync(api, headers, records, country='AO', language='pt'):
    return api.post(ROOT + '/sync', headers=headers, json={'country': country, 'consent_language': language, 'records': records})


def upload(api, headers, csv=CSV, country='AO', language='pt'):
    return api.post(ROOT + '/import', headers=headers, data={'country': country, 'consent_language': language},
                    files={'file': ('measurements.csv', csv.encode(), 'text/csv')})


def test_manual_requires_explicit_scope_and_current_five_but_no_devices(api, owner, db_session):
    patient, headers = owner
    body = {'reading_type': 'weight', 'value': 72.5, 'unit': 'kg'}
    assert api.post(ROOT, headers=headers, json=body).status_code == 422
    denied = api.post(ROOT, headers=headers, json=body | {'country': 'AO'})
    assert denied.status_code == 403 and 'health_data_processing' in denied.json()['detail']['missing_purposes']
    allow(db_session, patient)
    created = api.post(ROOT, headers=headers, json=body | {'country': 'AO', 'measured_at': '2026-01-01T10:00:00+01:00'})
    assert created.status_code == 201, created.text
    assert created.json()['country'] == 'AO' and created.json()['consent_language'] == 'pt'
    assert datetime.fromisoformat(created.json()['measured_at']).hour == 9
    assert api.post(ROOT, headers=headers, json=body | {'country': 'PT'}).status_code == 403
    withdraw(db_session, patient, 'telemedicine_consent'); db_session.commit()
    assert api.post(ROOT, headers=headers, json=body | {'country': 'AO'}).status_code == 403
    assert api.get(ROOT + '/me', headers=headers).json()['total'] == 1
    assert api.get(ROOT + '/me/summary', headers=headers).status_code == 200
    assert api.delete(ROOT + '/' + created.json()['id'], headers=headers).status_code == 204


@pytest.mark.parametrize('path', ['bluetooth', 'unknown-source', 'sync', 'import'])
def test_device_sources_require_separate_optional_grant(api, owner, db_session, path):
    patient, headers = owner; allow(db_session, patient)
    def request():
        if path == 'sync': return sync(api, headers, [sample()])
        if path == 'import': return upload(api, headers)
        return api.post(ROOT, headers=headers, json={'country': 'AO', 'reading_type': 'weight', 'value': 72.5, 'source': path})
    denied = request()
    assert denied.status_code == 403 and denied.json()['detail']['missing_purposes'] == ['devices']
    grant_all(db_session, patient, purposes=('devices',)); db_session.commit()
    assert request().status_code in (200, 201)
    withdraw(db_session, patient, 'health_data_processing'); db_session.commit()
    assert request().status_code == 403


@pytest.mark.parametrize('other_country,other_language', [('PT', 'pt'), ('AO', 'en'), (None, None)])
def test_sync_cannot_rebind_existing_identity_and_rolls_back_whole_batch(api, owner, db_session, other_country, other_language):
    patient, headers = owner; allow(db_session, patient, devices=True)
    existing = sample()
    db_session.add(DeviceReading(patient_id=patient.id, reading_type='weight', value=68, unit='kg',
        measured_at=datetime.utcnow() - timedelta(hours=1), source=existing['source'], external_id=existing['external_id'],
        country=other_country, consent_language=other_language))
    db_session.commit()
    fresh = sample()
    result = sync(api, headers, [fresh, existing])
    assert result.status_code == 409 and result.json()['detail']['code'] == 'reading_scope_conflict'
    rows = db_session.query(DeviceReading).filter_by(patient_id=patient.id).populate_existing().all()
    assert len(rows) == 1 and float(rows[0].value) == 68 and rows[0].country == other_country
    retained = api.get(ROOT + '/me', headers=headers).json()
    assert retained['total'] == 1 and retained['readings'][0]['value'] == 68


def test_same_scope_sync_retries_update_once_then_withdrawal_blocks_processing(api, owner, db_session):
    patient, headers = owner; allow(db_session, patient, devices=True); item = sample()
    assert sync(api, headers, [item, item]).json() == {'imported': 1, 'updated': 0, 'skipped': 1}
    assert sync(api, headers, [item]).json() == {'imported': 0, 'updated': 0, 'skipped': 1}
    corrected = item | {'value': 73.5, 'device_model': 'Synthetic corrected metadata'}
    assert sync(api, headers, [corrected]).json()['updated'] == 1
    row = db_session.query(DeviceReading).filter_by(patient_id=patient.id).one()
    assert row.country == 'AO' and row.consent_language == 'pt' and float(row.value) == 73.5
    summary = api.get(ROOT + '/me/summary', headers=headers).json()['items'][0]
    assert summary['country'] == 'AO' and summary['consent_language'] == 'pt'
    withdraw(db_session, patient, 'devices'); db_session.commit()
    assert sync(api, headers, [corrected]).status_code == 403
    assert api.get(ROOT + '/me', headers=headers).json()['total'] == 1


def test_csv_duplicate_cannot_move_market_or_language(api, owner, db_session):
    patient, headers = owner; allow(db_session, patient, devices=True); allow(db_session, patient, country='PT', devices=True)
    assert upload(api, headers).json()['imported'] == 1
    assert upload(api, headers).json()['skipped'] == 1
    # The first row is new; the following cross-market duplicate must roll it back.
    response = upload(api, headers, country='PT', csv='Date,Weight(kg)\n2026-01-02,74\n2026-01-01T10:00:00+01:00,72.5\n')
    assert response.status_code == 409 and response.json()['detail']['code'] == 'reading_scope_conflict'
    row = db_session.query(DeviceReading).filter_by(patient_id=patient.id).one()
    assert row.country == 'AO' and row.measured_at.hour == 9
    assert api.get(ROOT + '/me', headers=headers).json()['total'] == 1
    excessive = 'Date,Weight(kg)\n' + '2026-01-01,72.5\n' * 2001
    assert upload(api, headers, csv=excessive).status_code == 413


def test_legacy_personal_read_and_delete_do_not_require_new_grants(api, owner, db_session):
    patient, headers = owner
    row = DeviceReading(patient_id=patient.id, reading_type='weight', value=70, measured_at=datetime.utcnow())
    db_session.add(row); db_session.commit()
    result = api.get(ROOT + '/me', headers=headers).json()['readings'][0]
    assert result['country'] is None and result['consent_language'] is None
    assert api.get(ROOT + '/me/summary', headers=headers).json()['items'][0]['country'] is None
    assert api.delete(ROOT + '/' + row.id, headers=headers).status_code == 204


def migration():
    spec = importlib.util.spec_from_file_location('reading_scope_test', Path('alembic/versions/reading_consent_scope_v1.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_migration_preserves_legacy_unknown_scope_and_refuses_loss_of_new_scope():
    engine = create_engine('sqlite://')
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        connection.execute(text('CREATE TABLE device_readings (id VARCHAR(36) PRIMARY KEY)'))
        connection.execute(text("INSERT INTO device_readings (id) VALUES ('legacy')"))
        upgrade = migration(); upgrade.upgrade(); upgrade.upgrade()
        row = connection.execute(text('SELECT country, consent_language FROM device_readings')).one()
        assert tuple(row) == (None, None)
        connection.execute(text("INSERT INTO device_readings VALUES ('new','AO','pt')"))
        with pytest.raises(RuntimeError, match='Retained reading jurisdiction'): upgrade.downgrade()
        connection.execute(text("DELETE FROM device_readings WHERE id='new'"))
        upgrade.downgrade()
        assert connection.execute(text('SELECT id FROM device_readings')).scalar() == 'legacy'


@pytest.mark.parametrize('column', ['country INTEGER', 'country VARCHAR(2) NOT NULL', "country VARCHAR(2) DEFAULT 'AO'", 'consent_language VARCHAR(40)'])
def test_migration_rejects_incompatible_scope_adoption(column):
    engine = create_engine('sqlite://')
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        connection.execute(text('CREATE TABLE device_readings (id VARCHAR(36) PRIMARY KEY,' + column + ')'))
        with pytest.raises(RuntimeError, match='Invalid reading consent scope column'): migration().upgrade()


@pytest.mark.parametrize('csv,error', [
    ('Date,Weight(lb)\n2026-01-01,not-a-number\n', 'could not convert'),
    ('Weight(kg)\n72.5\n', 'measurement date is required'),
    ('Date,Weight(kg)\n2999-01-01,72.5\n', 'measurement date cannot be in the future'),
])
def test_csv_invalid_weight_or_missing_future_time_never_invents_reading(api, owner, db_session, csv, error):
    patient, headers = owner; allow(db_session, patient, devices=True)
    for _ in range(2):
        response = upload(api, headers, csv=csv)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body['imported'] == 0 and any(error in message for message in body['errors'])
    assert api.get(ROOT + '/me', headers=headers).json()['total'] == 0
