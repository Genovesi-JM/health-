"""One synthetic journey through the real onboarding, review and care APIs."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.health_models import Doctor
from tests._authutil import login_with_mfa
from tests.test_patient_onboarding_completion import patient_payload
from tests.test_professional_application_journey import _applicant, _submit, _admin, _decision, _headers


def test_angola_registration_onboarding_review_booking_and_record_access(client, db_session):
    registered = client.post('/auth/register', json={
        'email': f'journey-{uuid4().hex}@example.com', 'password': 'strong-pass',
        'full_name': 'Synthetic Patient', 'sector_focus': 'health', 'role': 'patient',
    })
    assert registered.status_code == 201, registered.text
    patient_auth = registered.json()
    patient_headers = _headers(patient_auth)
    account = client.get('/auth/me', headers=patient_headers).json()
    assert account['id'] == patient_auth['user']['id']
    assert account['professional_application'] is None
    assert account['patient_onboarding_complete'] is False
    blocked = client.post('/api/v1/consultations/book', headers=patient_headers,
                          json={'specialty': 'clinica_geral', 'next_available': True})
    assert blocked.status_code == 403, blocked.text

    started = client.post('/api/v1/onboarding/start', headers=patient_headers, json={'role': 'patient'})
    assert started.status_code == 200, started.text
    for step, answers in patient_payload(account['email'], 'AO').items():
        saved = client.put(f'/api/v1/onboarding/steps/{step}?role=patient', headers=patient_headers,
                           json={'data': answers, 'completed': True})
        assert saved.status_code == 200, saved.text
    completed = client.post('/api/v1/onboarding/submit?role=patient', headers=patient_headers)
    assert completed.status_code == 200, completed.text
    assert completed.json()['completion_status'] == 'complete'
    assert client.get('/auth/me', headers=patient_headers).json()['patient_onboarding_complete'] is True
    patient = client.get('/api/v1/patients/me', headers=patient_headers).json()
    assert patient['date_of_birth'] == '1990-05-20'

    applicant = _applicant(client)
    application_state = client.get('/auth/me', headers=_headers(applicant)).json()
    assert application_state['role'] == 'patient'
    assert application_state['professional_application'] == {'profession': 'doctor', 'status': 'draft'}
    case = _submit(client, applicant)
    approval = _decision(client, case, _admin(client))
    assert approval.status_code == 200, approval.text
    assert client.get('/api/v1/doctor/queue', headers=_headers(applicant)).status_code == 403
    clinician_auth = login_with_mfa(client, applicant['user']['email'], 'strong-pass')
    clinician_headers = _headers(clinician_auth)
    assert clinician_auth['user']['role'] == 'doctor'
    doctor = db_session.query(Doctor).filter_by(user_id=applicant['user']['id']).one()

    start = datetime.now(timezone(timedelta(hours=1))) + timedelta(days=2)
    published = client.post('/api/v1/doctor/appointment-slots', headers=clinician_headers, json={
        'country': 'AO', 'timezone': 'Africa/Luanda',
        'starts_at': start.isoformat(), 'ends_at': (start + timedelta(minutes=30)).isoformat(),
    })
    assert published.status_code == 201, published.text
    available = client.get('/api/v1/appointments/slots', headers=patient_headers,
                           params={'country': 'AO', 'doctor_id': doctor.id})
    assert available.status_code == 200, available.text
    assert published.json()['id'] in {slot['id'] for slot in available.json()}
    booked = client.post('/api/v1/consultations/book',
                         headers=patient_headers | {'Idempotency-Key': str(uuid4())}, json={
        'slot_id': published.json()['id'], 'specialty': 'clinica_geral', 'country': 'AO',
    })
    assert booked.status_code == 200, booked.text
    consultation = booked.json()
    assert consultation['status'] == 'requested'
    summary_url = f"/api/v1/doctor/patients/{patient['id']}/clinical-summary"
    assert client.get(summary_url, headers=clinician_headers).status_code in (403, 404)
    accepted = client.post(f"/api/v1/doctor/queue/{consultation['id']}/accept", headers=clinician_headers)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()['status'] == 'scheduled'
    summary = client.get(summary_url, headers=clinician_headers)
    assert summary.status_code == 200, summary.text
    assert summary.json()['identity']['date_of_birth'] == '1990-05-20'
    assert summary.json()['allergies'] == ['penicilina', 'marisco']
    listed = client.get('/api/v1/consultations/me', headers=patient_headers)
    assert listed.status_code == 200, listed.text
    assert next(item for item in listed.json() if item['id'] == consultation['id'])['status'] == 'scheduled'
