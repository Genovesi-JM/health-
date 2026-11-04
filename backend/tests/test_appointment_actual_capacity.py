"""Real API coverage for capacity after an appointment starts early."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.health_models import AppointmentSlot, Consultation
from test_appointments import api, book, people, publish
from test_consultation_lifecycle import seed_consultation


def current_slot_payload():
    begin = datetime.now(ZoneInfo("Africa/Luanda")) + timedelta(minutes=5)
    return {"country": "AO", "timezone": "Africa/Luanda", "starts_at": begin.isoformat(),
            "ends_at": (begin + timedelta(minutes=15)).isoformat()}


def start_future_appointment(api, people):
    slot = publish(api, people)
    response = book(api, people, slot)
    assert response.status_code == 200, response.text
    identifier = response.json()["id"]
    headers = people["doctor"]["headers"]
    accepted = api.post(f"/api/v1/doctor/queue/{identifier}/accept", headers=headers)
    assert accepted.status_code == 200, accepted.text
    started = api.post(f"/api/v1/doctor/queue/{identifier}/start", headers=headers)
    assert started.status_code == 200, started.text
    return identifier


def test_started_early_blocks_publication_during_actual_care(api, people, db_session):
    identifier = start_future_appointment(api, people)
    ongoing = db_session.get(Consultation, identifier)
    assert ongoing.status == "in_progress"
    assert ongoing.started_at < ongoing.scheduled_at
    response = api.post("/api/v1/doctor/appointment-slots", headers=people["doctor"]["headers"],
                        json=current_slot_payload())
    assert response.status_code == 409, response.text
    assert db_session.query(AppointmentSlot).filter_by(doctor_id=ongoing.doctor_id).count() == 1


@pytest.mark.parametrize("slot_doctor,booking_patient", [("doctor", "other_patient"), ("other_doctor", "patient")])
def test_started_early_blocks_booking_for_either_busy_participant(api, people, db_session, slot_doctor, booking_patient):
    # An unreserved published slot does not itself represent an ongoing visit.
    # It must be rechecked against actual care when a patient tries to claim it.
    open_slot = publish(api, people, who=slot_doctor, **current_slot_payload())
    start_future_appointment(api, people)
    response = book(api, people, open_slot, who=booking_patient)
    assert response.status_code == 409, response.text
    slot = db_session.get(AppointmentSlot, open_slot["id"])
    assert slot.reserved_consultation_id is None
    assert db_session.query(Consultation).filter_by(slot_id=slot.id).count() == 0


def test_legacy_ongoing_visit_without_start_timestamp_still_blocks_current_capacity(api, people, db_session):
    future = datetime.utcnow() + timedelta(days=2)
    seed_consultation(db_session, people, status="in_progress", scheduled_at=future,
                      scheduled_end_at=future + timedelta(minutes=30), started_at=None)
    response = api.post("/api/v1/doctor/appointment-slots", headers=people["doctor"]["headers"],
                        json=current_slot_payload())
    assert response.status_code == 409, response.text
