"""Provider summary routes must not bypass finalized-note integrity checks."""
from datetime import datetime

import pytest
from sqlalchemy import update

from app.health_models import ConsultationNotes
from test_consultation_lifecycle import api, people, seed_consultation
from test_consultation_closeout import complete


def read_summary(api, item, people, route):
    if route == "agenda":
        path = f"/api/v1/doctor/agenda/today?date={item.scheduled_at.date().isoformat()}"
    else:
        path = f"/api/v1/doctor/patients/{item.patient_id}/clinical-summary"
    return api.get(path, headers=people["doctor"]["headers"])


@pytest.mark.parametrize("route", ["agenda", "clinical-summary"])
@pytest.mark.parametrize("changed", [
    {"subjective": "CORRUPTED_CONTENT"}, {"assessment": "CORRUPTED_CONTENT"},
    {"finalization_digest": None}, {"finalized_at": None}, {"finalized_by_user_id": None},
])
def test_finalized_note_corruption_is_withheld_on_provider_summary_routes(api, people, db_session, route, changed):
    item = seed_consultation(db_session, people, "in_progress", scheduled_at=datetime(2026, 10, 5, 12))
    assert complete(api, item, people).status_code == 200
    db_session.execute(update(ConsultationNotes).where(ConsultationNotes.consultation_id == item.id).values(**changed))
    db_session.commit()
    response = read_summary(api, item, people, route)
    assert response.status_code == 409, response.text
    assert "CORRUPTED_CONTENT" not in response.text
    assert "Private synthetic" not in response.text


@pytest.mark.parametrize("route", ["agenda", "clinical-summary"])
def test_valid_finalization_remains_readable_to_the_assigned_doctor(api, people, db_session, route):
    item = seed_consultation(db_session, people, "in_progress", scheduled_at=datetime(2026, 10, 5, 12))
    assert complete(api, item, people).status_code == 200
    response = read_summary(api, item, people, route)
    assert response.status_code == 200, response.text
    assert "Private synthetic history" in response.text


@pytest.mark.parametrize("route", ["agenda", "clinical-summary"])
def test_legacy_unsigned_notes_remain_available_only_as_existing_clinician_content(api, people, db_session, route):
    item = seed_consultation(db_session, people, "completed", scheduled_at=datetime(2026, 10, 5, 12))
    db_session.add(ConsultationNotes(consultation_id=item.id, doctor_id=item.doctor_id, subjective="Legacy clinician history"))
    db_session.commit()
    response = read_summary(api, item, people, route)
    assert response.status_code == 200, response.text
    assert "Legacy clinician history" in response.text
    patient = api.get(f"/api/v1/consultations/{item.id}/closeout", headers=people["patient"]["headers"])
    assert patient.status_code == 200
    assert patient.json()["closeout"] is None
    assert "Legacy clinician history" not in patient.text
