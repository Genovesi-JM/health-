"""Owned follow-up completion, using synthetic identities and real auth."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.database import engine
from app.health_models import ClinicalCareTask, HealthAuditLog
from app.routers import clinical_operations as operations
from app.routers import consultations
from tests.test_consultation_lifecycle import people, seed_consultation  # noqa: F401


@pytest.fixture
def api():
    app = FastAPI()
    app.include_router(operations.router)
    app.include_router(consultations.router)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def task(people, db_session):
    consultation = seed_consultation(db_session, people, status="completed")
    owner = people["doctor"]["user"].id
    item = ClinicalCareTask(
        patient_id=consultation.patient_id, consultation_id=consultation.id,
        created_by_user_id=owner, assigned_role="doctor", assigned_user_id=owner,
        task_type="follow_up", title="Synthetic follow-up", status="open",
    )
    db_session.add(item)
    db_session.commit()
    return item


def complete(api, task, people, note="Synthetic completion", who="doctor"):
    return api.post(f"/api/v1/clinical-operations/care-tasks/{task.id}/complete",
                    json={"completion_note": note}, headers=people[who]["headers"])


def test_owned_follow_up_completes_once_and_recovers_a_lost_response(api, task, people, db_session):
    result = complete(api, task, people)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "completed"
    assert result.json()["completed_at"].endswith("+00:00")
    repeated = complete(api, task, people, "  Synthetic completion  ")
    assert repeated.status_code == 200
    assert repeated.json() == result.json()
    changed = complete(api, task, people, "Replacement text")
    assert changed.status_code == 409
    db_session.refresh(task)
    assert task.completion_note == "Synthetic completion"
    assert task.completed_by_user_id == people["doctor"]["user"].id
    audit = db_session.query(HealthAuditLog).filter_by(resource_id=task.id).one()
    assert audit.action == "clinical_care_task.completed"
    assert "Synthetic completion" not in (audit.metadata_json or "")


@pytest.mark.parametrize("who", ["patient", "other_doctor", "unverified"])
def test_only_authorized_owner_can_complete(api, task, people, db_session, who):
    assert complete(api, task, people, who=who).status_code == 403
    db_session.refresh(task)
    assert task.status == "open"
    assert db_session.query(HealthAuditLog).filter_by(resource_id=task.id).count() == 0


def test_audit_failure_rolls_back_completion(api, task, people, db_session):
    def refuse_audit(session, flush_context, instances):
        if any(isinstance(row, HealthAuditLog) and row.action == "clinical_care_task.completed"
               for row in session.new):
            raise RuntimeError("Synthetic audit failure")
    event.listen(Session, "before_flush", refuse_audit)
    try:
        result = complete(api, task, people)
        assert result.status_code == 503
    finally:
        event.remove(Session, "before_flush", refuse_audit)
    db_session.refresh(task)
    assert task.status == "open"
    assert task.completed_by_user_id is None
    assert task.completion_note is None
    assert db_session.query(HealthAuditLog).filter_by(resource_id=task.id).count() == 0


@pytest.mark.parametrize("same_payload", [True, False])
def test_stale_task_cannot_replace_saved_completion(task, people, db_session, same_payload):
    request = Request({"type": "http", "method": "POST", "path": "/synthetic", "headers": []})
    with Session(engine) as first, Session(engine) as second:
        first.get(ClinicalCareTask, task.id)
        stale = second.get(ClinicalCareTask, task.id)
        operations.complete_care_task(task.id, operations.CareTaskComplete(completion_note="First"),
                                      request, people["doctor"]["user"], first)
        assert stale.status == "open"
        payload = operations.CareTaskComplete(completion_note="First" if same_payload else "Second")
        if same_payload:
            result = operations.complete_care_task(task.id, payload, request, people["doctor"]["user"], second)
            assert result["completion_note"] == "First"
        else:
            with pytest.raises(HTTPException) as conflict:
                operations.complete_care_task(task.id, payload, request, people["doctor"]["user"], second)
            assert conflict.value.status_code == 409
    db_session.refresh(task)
    assert task.completion_note == "First"
    assert db_session.query(HealthAuditLog).filter_by(resource_id=task.id).count() == 1


def test_lost_commit_acknowledgment_recovers_without_duplicate_audit(api, task, people, db_session, monkeypatch):
    original_commit = Session.commit
    def commit_then_fail(session):
        original_commit(session)
        raise RuntimeError("Synthetic lost commit acknowledgment")
    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", commit_then_fail)
        assert complete(api, task, people).status_code == 503
    assert complete(api, task, people).status_code == 200
    assert db_session.query(HealthAuditLog).filter_by(resource_id=task.id).count() == 1


def test_stale_owner_cannot_complete_a_reassigned_task(task, people, db_session):
    request = Request({"type": "http", "method": "POST", "path": "/synthetic", "headers": []})
    with Session(engine) as first, Session(engine) as second:
        stale = second.get(ClinicalCareTask, task.id)
        changed = first.get(ClinicalCareTask, task.id)
        changed.assigned_user_id = people["other_doctor"]["user"].id
        first.commit()
        assert stale.assigned_user_id == people["doctor"]["user"].id
        with pytest.raises(HTTPException) as conflict:
            operations.complete_care_task(task.id, operations.CareTaskComplete(), request,
                                         people["doctor"]["user"], second)
        assert conflict.value.status_code == 409
    db_session.refresh(task)
    assert task.status == "open"
    assert task.assigned_user_id == people["other_doctor"]["user"].id
    assert db_session.query(HealthAuditLog).filter_by(resource_id=task.id).count() == 0


def test_published_closeout_tracks_owned_follow_up_without_disclosing_private_notes(api, people, db_session):
    consultation = seed_consultation(db_session, people, status="in_progress")
    url = f"/api/v1/consultations/{consultation.id}"
    payload = {
        "assessment": "Synthetic internal assessment",
        "plan": "Synthetic internal plan",
        "patient_summary": "Synthetic patient summary",
        "outcome": "follow_up", "follow_up_required": True,
        "follow_up_instructions": "Synthetic follow-up instructions",
        "follow_up_due_at": (datetime.now(timezone(timedelta(hours=1))) + timedelta(days=3)).isoformat(),
    }
    saved = api.post(url + "/complete", json=payload, headers=people["doctor"]["headers"])
    assert saved.status_code == 200, saved.text
    published = api.get(url + "/closeout", headers=people["patient"]["headers"])
    assert published.status_code == 200, published.text
    closeout = published.json()["closeout"]
    assert closeout["patient_summary"] == payload["patient_summary"]
    assert "notes" not in closeout
    assert payload["assessment"] not in published.text
    assert payload["plan"] not in published.text
    follow_up = closeout["follow_up"]
    assert follow_up["assigned_user_id"] == people["doctor"]["user"].id
    assert follow_up["status"] == "open"
    assert datetime.fromisoformat(follow_up["due_at"]) == datetime.fromisoformat(payload["follow_up_due_at"])
    assert complete(api, SimpleNamespace(id=follow_up["id"]), people, "Private completion note").status_code == 200
    refreshed = api.get(url + "/closeout", headers=people["patient"]["headers"])
    assert refreshed.json()["closeout"]["follow_up"]["status"] == "completed"
    assert "Private completion note" not in refreshed.text
    retry = api.post(url + "/complete", json=payload, headers=people["doctor"]["headers"])
    assert retry.status_code == 200, retry.text
    assert db_session.query(ClinicalCareTask).filter_by(consultation_id=consultation.id).count() == 1
