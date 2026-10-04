"""Persist family relationships and expose only currently authorized clinicians."""
from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.health_models import ClinicianCredential, Doctor, FamilyMember
from app.routers import doctors, family
from tests.test_consultation_lifecycle import people  # noqa: F401


@pytest.fixture
def api():
    application = FastAPI()
    application.include_router(family.router)
    application.include_router(doctors.router)
    with TestClient(application) as client:
        yield client


def test_family_relationship_round_trip_update_ownership_and_delete(api, people, db_session):
    auth = people['patient']['headers']
    created = api.post('/api/v1/family', headers=auth, json={'full_name': 'Synthetic relative', 'relationship': 'filha', 'is_minor': True})
    assert created.status_code == 201, created.text
    row = created.json()
    assert row['relationship'] == 'filha' and 'relationship_type' not in row
    assert created.headers['cache-control'] == 'private, no-store'
    assert db_session.get(FamilyMember, row['id'], populate_existing=True).relationship_type == 'filha'
    url = '/api/v1/family/' + row['id']
    patched = api.patch(url, headers=auth, json={'relationship': 'outro', 'notes': 'Synthetic private note'})
    assert patched.status_code == 200 and patched.json()['relationship'] == 'outro'
    db_session.expire_all()
    assert db_session.get(FamilyMember, row['id']).relationship_type == 'outro'
    listed = api.get('/api/v1/family/me', headers=auth)
    assert next(entry for entry in listed.json() if entry['id'] == row['id'])['relationship'] == 'outro'
    other = people['other_patient']['headers']
    assert row['id'] not in {entry['id'] for entry in api.get('/api/v1/family/me', headers=other).json()}
    assert api.patch(url, headers=other, json={'relationship': 'pai'}).status_code == 404
    assert api.delete(url, headers=other).status_code == 404
    assert api.patch(url, headers=auth, json={'notes': None}).json()['notes'] is None
    assert api.delete(url, headers=auth).status_code == 204
    assert row['id'] not in {entry['id'] for entry in api.get('/api/v1/family/me', headers=auth).json()}


@pytest.mark.parametrize('field', ['full_name', 'relationship', 'is_minor', 'emergency_contact'])
def test_family_cannot_clear_required_persisted_values(api, people, field):
    auth = people['patient']['headers']
    row = api.post('/api/v1/family', headers=auth, json={'full_name': 'Synthetic relative', 'relationship': 'pai'}).json()
    result = api.patch('/api/v1/family/' + row['id'], headers=auth, json={field: None})
    assert result.status_code == 422, result.text
    assert api.patch('/api/v1/family/' + row['id'], headers=auth, json={}).status_code == 200


@pytest.fixture
def public_doctor(people, db_session):
    doctor = people['doctor']['profile']
    doctor.slug = 'synthetic-' + uuid4().hex
    doctor.location_city = 'Synthetic city'
    doctor.consultation_types_json = '["teleconsultation"]'
    credential = db_session.query(ClinicianCredential).filter_by(user_id=doctor.user_id).one()
    db_session.commit()
    yield doctor, credential, people['doctor']['user']
    # Independent expiry-scanner tests share this synthetic database.
    stored = db_session.get(ClinicianCredential, credential.id, populate_existing=True)
    if stored:
        stored.licence_expiry_date = None
        db_session.commit()


@pytest.mark.parametrize('invalid', ['expired', 'expires_today', 'invalid_date', 'revoked', 'pending', 'missing',
                                    'inactive', 'wrong_role', 'wrong_profession', 'profile_suspended'])
def test_public_discovery_rechecks_current_authority_without_waiting_for_scanner(api, db_session, public_doctor, invalid):
    doctor, credential, user = public_doctor
    url = '/api/v1/doctors/by-slug/' + doctor.slug
    assert api.get(url).status_code == 200
    if invalid == 'expired': credential.licence_expiry_date = (date.today() - timedelta(days=1)).isoformat()
    elif invalid == 'expires_today': credential.licence_expiry_date = date.today().isoformat()
    elif invalid == 'invalid_date': credential.licence_expiry_date = 'invalid'
    elif invalid in ('revoked', 'pending'): credential.status = invalid
    elif invalid == 'missing': db_session.delete(credential)
    elif invalid == 'inactive': user.is_active = False
    elif invalid == 'wrong_role': user.role = 'patient'
    elif invalid == 'wrong_profession': credential.profession = 'nurse'
    else: doctor.verification_status = 'suspended'
    db_session.commit()
    assert api.get(url).status_code == 404
    assert doctor.id not in {item['id'] for item in api.get('/api/v1/doctors/').json()}


def test_discovery_country_is_explicit_credential_country_and_filters_compose(api, db_session, public_doctor):
    doctor, credential, _ = public_doctor
    credential.practice_country = 'PT'
    credential.licence_expiry_date = (date.today() + timedelta(days=7)).isoformat()
    db_session.commit()
    url = '/api/v1/doctors/by-slug/' + doctor.slug
    assert api.get(url).json()['practice_country'] == 'PT'
    assert api.get(url, params={'country': 'AO'}).status_code == 404
    assert api.get(url, params={'country': 'PT'}).status_code == 200
    result = api.get('/api/v1/doctors/', params={'country': 'PT', 'city': 'Synthetic', 'specialty': doctor.specialization,
                                               'consultation_type': 'teleconsultation'})
    assert doctor.id in {row['id'] for row in result.json()}
    assert all(row['practice_country'] == 'PT' for row in result.json())
    assert doctor.id not in {row['id'] for row in api.get('/api/v1/doctors/', params={'country': 'AO'}).json()}
    for route in ('/api/v1/doctors/', url):
        assert api.get(route, params={'country': 'BR'}).status_code == 422
    credential.practice_country = ''
    db_session.commit()
    assert api.get(url).json()['practice_country'] is None
    assert api.get(url, params={'country': 'AO'}).status_code == 404
