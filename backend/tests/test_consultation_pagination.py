"""Real-auth traversal beyond the legacy limits, without broadening clinical access."""
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from app.config import settings
from app.health_models import ClinicianCredential, Consultation
from tests.test_consultation_lifecycle import api, people  # noqa: F401


@pytest.fixture(autouse=True)
def cursor_secret(monkeypatch):
    monkeypatch.setattr(settings, 'secret_key', 'synthetic-consultation-history-cursor-secret')


def rows(db, people, count=113, status='requested', **values):
    result = []
    for i in range(count):
        item = Consultation(id=str(uuid4()), patient_id=people['patient']['profile'].id,
            doctor_id=people['doctor']['profile'].id, country='AO', status=status, specialty='cardiologia',
            created_at=datetime(2026, 1, 1) + timedelta(seconds=i // 4), **values)
        db.add(item); result.append(item)
    db.commit()
    return sorted(result, key=lambda row: (row.created_at, row.id))


@pytest.mark.parametrize('path,who,ascending', [
    ('/api/v1/consultations/me/page', 'patient', False),
    ('/api/v1/doctor/consultations/page', 'doctor', False),
    ('/api/v1/doctor/queue/page', 'doctor', True),
])
def test_traverses_all_records_with_timestamp_ties_and_private_headers(api, people, db_session, path, who, ascending):
    seeded = rows(db_session, people)
    expected = [row.id for row in seeded[::1 if ascending else -1]]
    found, cursor = [], None
    while True:
        # Other suites may retain eligible shared general-care requests. Narrow
        # this traversal to these directed synthetic cardiology records.
        result = api.get(path, headers=people[who]['headers'], params={'limit': 17,
            **({'specialty': 'cardiologia'} if ascending else {}), **({'cursor': cursor} if cursor else {})})
        assert result.status_code == 200, result.text
        assert result.headers['cache-control'] == 'private, no-store'
        assert result.headers['x-content-type-options'] == 'nosniff'
        payload = result.json()
        assert set(payload) == {'items', 'next_cursor'}
        found += [row['id'] for row in payload['items']]
        cursor = payload['next_cursor']
        if cursor is None: break
    assert found == expected
    assert len(set(found)) == 113


def test_patient_filter_is_applied_before_pagination_and_bound_to_cursor(api, people, db_session):
    old = rows(db_session, people, 3, 'completed')
    rows(db_session, people, 101, 'requested')
    path = '/api/v1/consultations/me/page'
    first = api.get(path, headers=people['patient']['headers'], params={'view': 'past', 'limit': 1})
    assert first.status_code == 200
    assert first.json()['items'][0]['id'] == old[-1].id
    cursor = first.json()['next_cursor']
    for params in ({'cursor': cursor}, {'view': 'upcoming', 'cursor': cursor}, {'view': 'past', 'status': 'completed', 'cursor': cursor}):
        assert api.get(path, headers=people['patient']['headers'], params=params).status_code == 422
    assert api.get(path, headers=people['other_patient']['headers'], params={'view': 'past', 'cursor': cursor}).status_code == 422
    assert api.get(path, headers=people['patient']['headers'], params={'view': 'past', 'cursor': cursor}).json()['items'][0]['id'] == old[-2].id


def test_authority_and_owner_checked_again_after_first_page(api, people, db_session):
    rows(db_session, people, 3)
    path = '/api/v1/doctor/queue/page'
    first = api.get(path, headers=people['doctor']['headers'], params={'limit': 1}).json()
    cursor = first['next_cursor']
    assert api.get(path, headers=people['other_doctor']['headers'], params={'cursor': cursor}).status_code == 422
    assert api.get('/api/v1/doctor/consultations/page', headers=people['doctor']['headers'], params={'cursor': cursor}).status_code == 422
    cred = db_session.query(ClinicianCredential).filter_by(user_id=people['doctor']['user'].id).one()
    cred.status = 'revoked'; db_session.commit()
    assert api.get(path, headers=people['doctor']['headers'], params={'cursor': cursor}).status_code == 403
    assert api.get('/api/v1/doctor/consultations/page', headers=people['doctor']['headers']).status_code == 403


def test_queue_specialty_filter_cannot_expand_access_and_is_bound(api, people, db_session):
    rows(db_session, people, 3)
    path = '/api/v1/doctor/queue/page'
    cursor = api.get(path, headers=people['doctor']['headers'], params={'limit': 1}).json()['next_cursor']
    assert api.get(path, headers=people['doctor']['headers'], params={'cursor': cursor, 'specialty': 'cardiologia'}).status_code == 422
    assert api.get(path, headers=people['specialist']['headers'], params={'specialty': 'cardiologia'}).json()['items'] == []
    assert api.get('/api/v1/doctor/consultations/page', headers=people['other_doctor']['headers']).json()['items'] == []


@pytest.mark.parametrize('params', [{'limit': 0}, {'limit': 101}, {'limit': -1}, {'cursor': 'tampered'}, {'cursor': 'x' * 1025}, {'view': 'unknown'}])
def test_invalid_traversal_rejected(api, people, params):
    assert api.get('/api/v1/consultations/me/page', headers=people['patient']['headers'], params=params).status_code == 422


def test_new_records_do_not_duplicate_or_skip_older_positions(api, people, db_session):
    seeded = rows(db_session, people, 4)
    path = '/api/v1/consultations/me/page'
    first = api.get(path, headers=people['patient']['headers'], params={'limit': 2}).json()
    newest = Consultation(patient_id=people['patient']['profile'].id, status='requested', created_at=datetime(2027, 1, 1))
    db_session.add(newest); db_session.commit()
    second = api.get(path, headers=people['patient']['headers'], params={'limit': 2, 'cursor': first['next_cursor']}).json()
    assert [row['id'] for row in first['items'] + second['items']] == [row.id for row in reversed(seeded)]
    assert second['next_cursor'] is None
    assert api.get(path, headers=people['patient']['headers']).json()['items'][0]['id'] == newest.id
