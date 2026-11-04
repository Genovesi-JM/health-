"""Synthetic two-session interleavings and ingestion scope, with real routes."""
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import DeviceReading, Patient, TriageAnswer, TriageResult, TriageSession
from app.models import User
from app.routers import triage
from app.services import appointments
from tests.consent_fixtures import grant_all, withdraw


@pytest.fixture
def context(db):
    owner = User(email='triage-ingestion@example.invalid', role='patient', password_hash='synthetic', is_active=True)
    db.add(owner); db.flush()
    patient = Patient(user_id=owner.id); db.add(patient); db.flush()
    grant_all(db, patient, country='AO'); grant_all(db, patient, country='PT'); db.commit()
    app = FastAPI(); app.include_router(triage.router)
    def database():
        with Session(db.bind, autoflush=False) as session:
            yield session
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = lambda: owner
    with TestClient(app, raise_server_exceptions=False) as client:
        yield SimpleNamespace(client=client, owner=owner, patient=patient)


@pytest.mark.parametrize('source', ['bluetooth', 'wifi'])
def test_device_ingestion_requires_separate_current_grant(context, db, source):
    body = {'country': 'AO', 'chief_complaint': 'Synthetic self report',
            'vital_signs': {'temperature': 37, 'source': source}}
    denied = context.client.post('/api/v1/triage/start', json=body)
    assert denied.status_code == 403
    assert denied.json()['detail']['missing_purposes'] == ['devices']
    assert db.query(TriageSession).count() == db.query(DeviceReading).count() == 0
    grant_all(db, context.patient, purposes=('devices',)); db.commit()
    allowed = context.client.post('/api/v1/triage/start', json=body)
    assert allowed.status_code == 200, allowed.text
    reading = db.query(DeviceReading).one()
    assert (reading.country, reading.consent_language, reading.source) == ('AO', 'pt', source)
    withdraw(db, context.patient, 'devices'); db.commit()
    denied_again = context.client.post('/api/v1/triage/start', json=body)
    assert denied_again.status_code == 403
    assert db.query(TriageSession).count() == db.query(DeviceReading).count() == 1


def test_manual_measurement_does_not_implicitly_require_device_processing(context, db):
    response = context.client.post('/api/v1/triage/start', json={'country': 'PT',
        'vital_signs': {'temperature': 37, 'source': 'manual'}})
    assert response.status_code == 200, response.text
    reading = db.query(DeviceReading).one()
    assert (reading.country, reading.consent_language, reading.source) == ('PT', 'pt', 'manual')


@pytest.mark.parametrize('operation', ['answers', 'complete', 'photos'])
def test_waiting_mutation_rechecks_completed_state_after_lock(context, db, monkeypatch, operation):
    item = TriageSession(patient_id=context.patient.id, country='AO', consent_language='pt',
        status='in_progress', chief_complaint='Synthetic self report')
    db.add(item); db.flush()
    db.add(TriageAnswer(triage_session_id=item.id, question_key='mild_headache', answer_value='true'))
    grant_all(db, context.patient, purposes=('images',)); db.commit()
    original = appointments.lock_resources
    interleaved = False
    def complete_before_lock(session, doctor_id, patient_id):
        nonlocal interleaved
        if not interleaved:
            interleaved = True
            with Session(db.bind, autoflush=False) as other:
                triage.complete_triage(item.id, other.get(Patient, context.patient.id), other.get(User, context.owner.id), other)
        return original(session, doctor_id, patient_id)
    monkeypatch.setattr(appointments, 'lock_resources', complete_before_lock)
    url = f'/api/v1/triage/{item.id}/{operation}'
    if operation == 'answers': response = context.client.post(url, json={'answers': {'severe_chest_pain': True}})
    elif operation == 'photos': response = context.client.post(url, data={'view_type': 'context'}, files={'file': ('synthetic.jpg', b'\xff\xd8\xffsynthetic', 'image/jpeg')})
    else: response = context.client.post(url)
    assert response.status_code == 400, response.text
    db.expire_all()
    assert db.get(TriageSession, item.id).status == 'completed'
    assert db.query(TriageAnswer).filter_by(triage_session_id=item.id).count() == 1
    assert db.query(TriageResult).filter_by(triage_session_id=item.id).count() == 1


def test_waiting_answer_rechecks_withdrawal_before_any_new_evidence(context, db, monkeypatch):
    item = TriageSession(patient_id=context.patient.id, country='AO', consent_language='pt', status='in_progress')
    db.add(item); db.commit()
    original = appointments.lock_resources
    interleaved = False
    def withdraw_before_lock(session, doctor_id, patient_id):
        nonlocal interleaved
        if not interleaved:
            interleaved = True
            with Session(db.bind, autoflush=False) as other:
                withdraw(other, other.get(Patient, context.patient.id), 'health_data_processing'); other.commit()
        return original(session, doctor_id, patient_id)
    monkeypatch.setattr(appointments, 'lock_resources', withdraw_before_lock)
    response = context.client.post(f'/api/v1/triage/{item.id}/answers', json={'answers': {'mild_headache': True}})
    assert response.status_code == 403
    assert db.query(TriageAnswer).filter_by(triage_session_id=item.id).count() == 0


def test_empty_completion_returns_validation_error_without_result(context, db):
    item = TriageSession(patient_id=context.patient.id, country='AO', consent_language='pt', status='in_progress')
    db.add(item); db.commit()
    response = context.client.post(f'/api/v1/triage/{item.id}/complete')
    assert response.status_code == 422
    db.expire_all()
    assert db.get(TriageSession, item.id).status == 'in_progress'
    assert db.query(TriageResult).filter_by(triage_session_id=item.id).count() == 0
