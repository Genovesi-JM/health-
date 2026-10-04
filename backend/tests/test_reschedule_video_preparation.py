"""A moved reservation cannot inherit attendance or checklist confirmations."""
from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy import event

from app.health_models import (
    AppointmentSlot, ClinicianCredential, Consultation, ConsultationReschedule,
    HealthAuditLog, TeleconsultationParticipant, TeleconsultationSession,
)
from app.oauth2 import create_access_token
from tests.test_appointment_rescheduling import pair, move
from tests.test_appointments import api, people  # noqa: F401
from tests.test_consultation_closeout import video


CHECK_IN = dict(camera_ready=True, microphone_ready=True, network_quality="good", consent_confirmed=True)
PREFLIGHT = dict(identity_confirmed=True, consent_confirmed=True, vitals_reviewed=True,
                 medication_reviewed=True, clinical_summary_ready=True, preflight_note="Private preparation")


def prepared(api, people, db):
    first, target, item = pair(api, people)
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people['doctor']['headers']).status_code == 200
    room = video(db, db.get(Consultation, item['id']), people, status='waiting')
    for participant in db.query(TeleconsultationParticipant).filter_by(session_id=room.id):
        participant.joined_at = None
        participant.network_quality = 'good'
    db.commit()
    return first, target, item, room.id


def nurse_headers(people, db):
    user = people['other_doctor']['user']
    user.role = 'nurse'
    db.query(ClinicianCredential).filter_by(user_id=user.id).one().profession = 'nurse'
    db.commit()
    token = create_access_token({'sub': user.email, 'uid': user.id, 'role': 'nurse', 'mfa_verified': True})
    return {'Authorization': f'Bearer {token}'}


def test_move_resets_preparation_and_requires_fresh_displayed_revision(api, people, db_session):
    _, target, item, session_id = prepared(api, people, db_session)
    nurse = nurse_headers(people, db_session)
    key = str(uuid4())
    assert move(api, people, item, target, key=key).status_code == 200
    room = db_session.get(TeleconsultationSession, session_id, populate_existing=True)
    assert room.status == 'scheduled' and room.preflight_note == 'Private preparation'
    assert not any(getattr(room, field) for field in PREFLIGHT if field != 'preflight_note')
    for participant in db_session.query(TeleconsultationParticipant).filter_by(session_id=session_id).populate_existing():
        assert not any((participant.camera_ready, participant.microphone_ready, participant.consent_confirmed,
                        participant.checked_in_at, participant.network_quality, participant.joined_at, participant.left_at))
    assert db_session.query(HealthAuditLog).filter_by(resource_id=session_id, action='teleconsultation.preparation_reset').count() == 1
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people['doctor']['headers'], params={'expected_revision': 1}).status_code == 200
    url = f'/api/v1/teleconsultations/{item["id"]}'
    assert api.post(url + '/start', headers=people['doctor']['headers'], params={'expected_revision': 1}).status_code == 409
    for params in ({}, {'expected_revision': 0}):
        for role in ('patient', 'doctor'):
            assert api.post(url + '/check-in', headers=people[role]['headers'], json=CHECK_IN, params=params).status_code == 409
        assert api.put(url + '/preflight', headers=nurse, json=PREFLIGHT, params=params).status_code == 409
    for role in ('patient', 'doctor'):
        result = api.post(url + '/check-in', headers=people[role]['headers'], json=CHECK_IN, params={'expected_revision': 1})
        assert result.status_code == 200, result.text
    assert api.put(url + '/preflight', headers=nurse, json=PREFLIGHT, params={'expected_revision': 1}).status_code == 200
    # An old move acknowledgment must not erase newer readiness.
    assert move(api, people, item, target, key=key).status_code == 200
    room = db_session.get(TeleconsultationSession, session_id, populate_existing=True)
    assert room.status == 'waiting' and room.clinical_summary_ready
    assert db_session.query(HealthAuditLog).filter_by(resource_id=session_id, action='teleconsultation.preparation_reset').count() == 1
    assert api.post(url + '/start', headers=people['doctor']['headers'], params={'expected_revision': 1}).status_code == 200


@pytest.mark.parametrize('evidence', ['consultation_started', 'consultation_ended', 'session_started', 'session_ended',
                                   'session_in_progress', 'session_completed', 'participant_joined', 'participant_left'])
def test_actual_care_evidence_blocks_move_even_if_consultation_still_scheduled(api, people, db_session, evidence):
    first, target, item, session_id = prepared(api, people, db_session)
    consultation = db_session.get(Consultation, item['id'])
    room = db_session.get(TeleconsultationSession, session_id)
    if evidence.startswith('consultation_'):
        setattr(consultation, evidence.removeprefix('consultation_') + '_at', datetime.utcnow())
    elif evidence in ('session_in_progress', 'session_completed'):
        room.status = evidence.removeprefix('session_')
    elif evidence.startswith('session_'):
        setattr(room, evidence.removeprefix('session_') + '_at', datetime.utcnow())
    else:
        participant = db_session.query(TeleconsultationParticipant).filter_by(session_id=session_id).first()
        setattr(participant, evidence.removeprefix('participant_') + '_at', datetime.utcnow())
    db_session.commit()
    result = move(api, people, item, target)
    assert result.status_code == 409, result.text
    assert result.json()['detail']['request_key_committed'] is False
    assert db_session.get(AppointmentSlot, first['id'], populate_existing=True).reserved_consultation_id == item['id']
    assert db_session.get(AppointmentSlot, target['id'], populate_existing=True).reserved_consultation_id is None
    assert db_session.query(ConsultationReschedule).filter_by(consultation_id=item['id']).count() == 0
    assert db_session.get(TeleconsultationSession, session_id, populate_existing=True).clinical_summary_ready


def test_reset_audit_failure_rolls_back_preparation_and_reservations(api, people, db_session):
    first, target, item, session_id = prepared(api, people, db_session)
    key = str(uuid4())
    def fail(mapper, connection, row):
        if row.action == 'teleconsultation.preparation_reset':
            raise RuntimeError('Synthetic audit failure')
    event.listen(HealthAuditLog, 'before_insert', fail)
    try:
        assert move(api, people, item, target, key=key).status_code == 503
    finally:
        event.remove(HealthAuditLog, 'before_insert', fail)
    assert db_session.get(AppointmentSlot, first['id'], populate_existing=True).reserved_consultation_id == item['id']
    assert db_session.get(AppointmentSlot, target['id'], populate_existing=True).reserved_consultation_id is None
    assert db_session.get(TeleconsultationSession, session_id, populate_existing=True).clinical_summary_ready
    assert all(p.checked_in_at for p in db_session.query(TeleconsultationParticipant).filter_by(session_id=session_id).populate_existing())
    assert db_session.query(ConsultationReschedule).filter_by(consultation_id=item['id']).count() == 0
    assert move(api, people, item, target, key=key).status_code == 200
