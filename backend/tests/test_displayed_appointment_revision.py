"""A clinician action must refer to the appointment time actually displayed."""
import pytest

from app.health_models import Consultation
from tests.test_appointment_rescheduling import pair, move
from tests.test_appointments import api, people  # noqa: F401
from tests.test_consultation_closeout import video


def route(identifier, action):
    if action == "video_start":
        return f"/api/v1/teleconsultations/{identifier}/start"
    return f"/api/v1/doctor/queue/{identifier}/{action}"


@pytest.mark.parametrize("action", ["accept", "start", "video_start"])
def test_old_displayed_time_cannot_accept_or_start_a_completed_move(api, people, db_session, action):
    _, target, item = pair(api, people)
    assert move(api, people, item, target).status_code == 200
    queue = api.get('/api/v1/doctor/queue', headers=people['doctor']['headers']).json()
    assert next(row for row in queue if row['id'] == item['id'])['reschedule_revision'] == 1
    if action != 'accept':
        assert api.post(route(item['id'], 'accept'), headers=people['doctor']['headers'], params={'expected_revision': 1}).status_code == 200
    if action == 'video_start':
        stored = db_session.get(Consultation, item['id'], populate_existing=True)
        video(db_session, stored, people, status='waiting')
        session = api.get(f"/api/v1/teleconsultations/{item['id']}", headers=people['doctor']['headers'])
        assert session.status_code == 200 and session.json()['reschedule_revision'] == 1
    for params in ({}, {'expected_revision': 0}):
        stale = api.post(route(item['id'], action), headers=people['doctor']['headers'], params=params)
        assert stale.status_code == 409, stale.text
        assert db_session.get(Consultation, item['id'], populate_existing=True).status == ('requested' if action == 'accept' else 'scheduled')
    fresh = api.post(route(item['id'], action), headers=people['doctor']['headers'], params={'expected_revision': 1})
    assert fresh.status_code == 200, fresh.text
    assert db_session.get(Consultation, item['id'], populate_existing=True).status == ('scheduled' if action == 'accept' else 'in_progress')


@pytest.mark.parametrize('action', ['accept', 'start', 'video_start'])
@pytest.mark.parametrize('revision', ['-1', 'true', '1.0', '1e0', '01', '', '99999999999'])
def test_displayed_revision_query_rejects_coercions(api, people, action, revision):
    _, _, item = pair(api, people)
    result = api.post(route(item['id'], action), headers=people['doctor']['headers'], params={'expected_revision': revision})
    assert result.status_code == 422, result.text
