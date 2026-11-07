"""Synthetic closeout disclosure, integrity and operational video regressions."""
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, event, inspect, text, update
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.health_models import (
    ClinicalCareTask, Consultation, ConsultationNotes, HealthAuditLog, PatientConsent,
    TeleconsultationParticipant, TeleconsultationSession,
)
from app.services import consultation_closeout as closeout
from tests.test_consultation_lifecycle import api, people, seed_consultation  # noqa: F401


def payload(**values):
    return {"assessment": "Private synthetic assessment", "plan": "Private synthetic plan",
            "subjective": "Private synthetic history", "objective": "Private synthetic examination",
            "patient_summary": "Explicit patient instructions", "outcome": "resolved",
            "follow_up_required": False, **values}


def complete(api, item, people, body=None, who="doctor"):
    return api.post(f"/api/v1/consultations/{item.id}/complete", json=body or payload(), headers=people[who]["headers"])


def read(api, item, people, who="patient"):
    return api.get(f"/api/v1/consultations/{item.id}/closeout", headers=people[who]["headers"])


def video(db, item, people, status="in_progress"):
    room = TeleconsultationSession(consultation_id=item.id, status=status, room_key=f"KAYA-{uuid4().hex}",
                                  identity_confirmed=True, consent_confirmed=True, vitals_reviewed=True,
                                  medication_reviewed=True, clinical_summary_ready=True, preflight_note="Private preparation")
    db.add(room)
    db.flush()
    for who in ("patient", "doctor"):
        db.add(TeleconsultationParticipant(session_id=room.id, user_id=people[who]["user"].id, role=who,
                                          checked_in_at=datetime.utcnow(), camera_ready=True, microphone_ready=True,
                                          joined_at=datetime.utcnow(), consent_confirmed=True))
    db.commit()
    return room


def test_closeout_discloses_only_authored_summary_and_records_read(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    assert complete(api, item, people).status_code == 200
    response = read(api, item, people)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "private, no-store"
    result = response.json()["closeout"]
    assert result["patient_summary"] == "Explicit patient instructions"
    assert result["follow_up"] is None
    assert result["finalized_by_name"] == "Médico responsável"
    assert result["finalized_at"].endswith("+00:00")
    assert "notes" not in result and "Private" not in response.text
    clinician = read(api, item, people, "doctor").json()["closeout"]
    assert clinician["notes"]["assessment"] == "Private synthetic assessment"
    audits = db_session.query(HealthAuditLog).filter_by(resource_id=item.id).all()
    assert sum(row.action == "consultation_closeout_read" for row in audits) == 2
    assert not any("Private" in (row.metadata_json or "") for row in audits)


@pytest.mark.parametrize("who,expected", [("other_patient", 404), ("other_doctor", 404), ("unverified", 403)])
def test_closeout_read_enforces_current_assigned_authority(api, people, db_session, who, expected):
    item = seed_consultation(db_session, people, "in_progress")
    assert complete(api, item, people).status_code == 200
    assert read(api, item, people, who).status_code == expected


@pytest.mark.parametrize("field,value", [
    ("assessment", None), ("assessment", "   "), ("plan", ""), ("patient_summary", None),
    ("follow_up_required", None), ("follow_up_required", "false"), ("follow_up_required", 0),
    ("outcome", None), ("patient_summary", "x" * 10001), ("outcome", "follow_up"),
    ("follow_up_due_at", "2099-01-01T10:00:00Z"),
])
def test_closeout_requires_explicit_complete_decisions(api, people, db_session, field, value):
    item = seed_consultation(db_session, people, "in_progress")
    assert complete(api, item, people, payload(**{field: value})).status_code == 422
    db_session.refresh(item)
    assert item.status == "in_progress"
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 0


@pytest.mark.parametrize("due,instructions", [(None, "instructions"), ("2099-01-01T10:00:00", "instructions"),
                                            ("2000-01-01T10:00:00Z", "instructions"), ("2099-01-01T10:00:00Z", "   ")])
def test_follow_up_requires_future_aware_due_and_instructions(api, people, db_session, due, instructions):
    item = seed_consultation(db_session, people, "in_progress")
    body = payload(follow_up_required=True, follow_up_due_at=due, follow_up_instructions=instructions)
    assert complete(api, item, people, body).status_code == 422
    assert db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).count() == 0


def test_exact_replay_recovers_after_due_date_without_duplicate_note_or_task(api, people, db_session, monkeypatch):
    item = seed_consultation(db_session, people, "in_progress")
    due = datetime.now(timezone.utc) + timedelta(days=1)
    body = payload(outcome="follow_up", follow_up_required=True, follow_up_due_at=due.isoformat(), follow_up_instructions="Owned follow-up")
    first = complete(api, item, people, body)
    assert first.status_code == 200, first.text
    class Later(datetime):
        @classmethod
        def utcnow(cls):
            return (due + timedelta(days=1)).replace(tzinfo=None)
    monkeypatch.setattr(closeout, "datetime", Later)
    replay = complete(api, item, people, body)
    assert replay.status_code == 200 and replay.json() == first.json()
    assert complete(api, item, people, {**body, "patient_summary": "Replacement"}).status_code == 409
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 1
    assert db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).count() == 1
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item.id, action="consultation_completed").count() == 1


def test_legacy_notes_are_never_implicitly_disclosed(api, people, db_session):
    item = seed_consultation(db_session, people, "completed")
    db_session.add(ConsultationNotes(consultation_id=item.id, doctor_id=item.doctor_id, plan="Private legacy plan"))
    db_session.commit()
    response = read(api, item, people)
    assert response.status_code == 200
    assert response.json()["closeout"] is None
    assert "Private" not in response.text
    assert complete(api, item, people).status_code == 409


def test_finalized_content_cannot_be_overwritten_in_the_database(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    assert complete(api, item, people).status_code == 200
    with pytest.raises(IntegrityError, match="finalized_clinical_record_is_retained"):
        db_session.execute(update(ConsultationNotes).where(ConsultationNotes.consultation_id == item.id).values(patient_summary="Changed underneath finalization"))
    db_session.rollback()
    assert read(api, item, people).json()["closeout"]["patient_summary"] == "Explicit patient instructions"
    assert complete(api, item, people).status_code == 200


def test_audit_failure_rolls_back_entire_closeout(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    room = video(db_session, item, people)
    def fail_audit(mapper, connection, target):
        if target.action == "consultation_completed":
            raise RuntimeError("synthetic audit refusal")
    event.listen(HealthAuditLog, "before_insert", fail_audit)
    try:
        body = payload(follow_up_required=True, follow_up_instructions="Follow-up", follow_up_due_at="2099-01-01T10:00:00Z")
        assert complete(api, item, people, body).status_code == 503
    finally:
        event.remove(HealthAuditLog, "before_insert", fail_audit)
    db_session.refresh(item); db_session.refresh(room)
    assert item.status == room.status == "in_progress"
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 0
    assert db_session.query(ClinicalCareTask).filter_by(consultation_id=item.id).count() == 0
    assert db_session.query(TeleconsultationParticipant).filter_by(session_id=room.id, left_at=None).count() == 2


def test_lost_commit_response_is_recovered_with_same_payload(api, people, db_session, monkeypatch):
    item = seed_consultation(db_session, people, "in_progress")
    original = Session.commit
    def lost_ack(session):
        original(session)
        raise RuntimeError("synthetic lost acknowledgement")
    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", lost_ack)
        assert complete(api, item, people).status_code == 503
    assert complete(api, item, people).status_code == 200
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 1


def test_read_audit_failure_does_not_disclose_summary(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    assert complete(api, item, people).status_code == 200
    def fail_audit(mapper, connection, target):
        if target.action == "consultation_closeout_read":
            raise RuntimeError("synthetic audit refusal")
    event.listen(HealthAuditLog, "before_insert", fail_audit)
    try:
        response = read(api, item, people)
        assert response.status_code == 503 and "Explicit patient instructions" not in response.text
    finally:
        event.remove(HealthAuditLog, "before_insert", fail_audit)


def test_episode_snapshot_preserves_closeout_after_later_withdrawal(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    from consent_fixtures import withdraw
    withdraw(db_session, people["patient"]["profile"], "telemedicine_consent")
    db_session.commit()
    assert complete(api, item, people).status_code == 200


def test_video_end_is_idempotent_and_leaves_clinical_closeout_open(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    room = video(db_session, item, people)
    url = f"/api/v1/teleconsultations/{item.id}/complete"
    first = api.post(url, headers=people["doctor"]["headers"])
    assert first.status_code == 200
    assert api.post(url, headers=people["doctor"]["headers"]).json() == first.json()
    db_session.refresh(item)
    assert item.status == "in_progress" and item.ended_at is None
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 0
    assert db_session.query(TeleconsultationParticipant).filter_by(session_id=room.id, left_at=None).count() == 0
    assert complete(api, item, people).status_code == 200
    assert db_session.query(HealthAuditLog).filter_by(resource_id=room.id, action="teleconsultation.completed").count() == 1


@pytest.mark.parametrize("action", ["complete", "cancel"])
def test_terminal_clinical_change_closes_video_and_prevents_new_mutations(api, people, db_session, action):
    item = seed_consultation(db_session, people, "in_progress")
    room = video(db_session, item, people)
    if action == "complete":
        assert complete(api, item, people).status_code == 200
    else:
        assert api.patch(f"/api/v1/consultations/{item.id}", json={}, headers=people["doctor"]["headers"]).status_code == 200
    db_session.refresh(room)
    assert room.status == "completed" and room.ended_at is not None
    assert db_session.query(TeleconsultationParticipant).filter_by(session_id=room.id, left_at=None).count() == 0
    for route in ("prepare", "start", "check-in"):
        body = {"camera_ready": True, "microphone_ready": True, "network_quality": "good"} if route == "check-in" else None
        assert api.post(f"/api/v1/teleconsultations/{item.id}/{route}", json=body, headers=people["doctor"]["headers"]).status_code == 409


def test_video_transport_disabled_even_with_live_looking_config(api, people, db_session, monkeypatch):
    monkeypatch.setenv("VIDEO_ENABLED", "true")
    monkeypatch.setenv("VIDEO_BASE_URL", "https://provider.example.test")
    monkeypatch.setenv("VIDEO_PROVIDER", "made_up_adapter")
    item = seed_consultation(db_session, people, "in_progress")
    room = video(db_session, item, people)
    result = api.get("/api/v1/teleconsultations/capabilities", headers=people["patient"]["headers"])
    assert result.status_code == 200 and result.json()["enabled"] is False
    assert result.headers["cache-control"] == "private, no-store"
    joined = api.post(f"/api/v1/teleconsultations/{item.id}/join", headers=people["doctor"]["headers"])
    assert joined.status_code == 503 and "room_url" not in joined.text and "example.test" not in joined.text
    assert db_session.query(HealthAuditLog).filter_by(resource_id=room.id, action="teleconsultation.joined").count() == 0


def test_patient_session_hides_preflight_note_and_other_participants(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    video(db_session, item, people)
    result = api.get(f"/api/v1/teleconsultations/{item.id}", headers=people["patient"]["headers"])
    assert result.status_code == 200
    assert "preflight_note" not in result.json() and "Private preparation" not in result.text
    assert [row["user_id"] for row in result.json()["participants"]] == [people["patient"]["user"].id]


def test_patient_checkin_requires_explicit_current_consent(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    video(db_session, item, people)
    url = f"/api/v1/teleconsultations/{item.id}/check-in"
    body = {"camera_ready": True, "microphone_ready": True, "network_quality": "fair", "consent_confirmed": False}
    assert api.post(url, json=body, headers=people["patient"]["headers"]).status_code == 422
    from consent_fixtures import withdraw
    withdraw(db_session, people["patient"]["profile"], "telemedicine_consent")
    db_session.commit()
    assert api.post(url, json={**body, "consent_confirmed": True}, headers=people["patient"]["headers"]).status_code == 403
    assert api.post(f"/api/v1/teleconsultations/{item.id}/join", headers=people["patient"]["headers"]).status_code == 403


def migration():
    path = Path(__file__).parents[1] / "alembic/versions/consultation_closeout_v1.py"
    spec = importlib.util.spec_from_file_location("closeout_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_preserves_legacy_content_and_supports_downgrade(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    module = migration()
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE consultation_notes (id VARCHAR(36) PRIMARY KEY, plan TEXT)"))
        conn.execute(text("INSERT INTO consultation_notes (id, plan) VALUES ('legacy', 'original')"))
        with Operations.context(MigrationContext.configure(conn)):
            module.upgrade()
            row = conn.execute(text("SELECT plan, patient_summary, finalized_at, follow_up_required FROM consultation_notes")).one()
            assert tuple(row) == ("original", None, None, 0)
            module.upgrade()  # Already-adopted compatible schema is safe.
            module.downgrade()
        assert tuple(conn.execute(text("SELECT id, plan FROM consultation_notes")).one()) == ("legacy", "original")
    engine.dispose()


def test_migration_adopts_current_create_all_schema_and_rejects_partial(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'current.db'}")
    module = migration()
    with engine.begin() as conn:
        ConsultationNotes.__table__.create(conn)
        with Operations.context(MigrationContext.configure(conn)):
            module.upgrade()
        conn.execute(text("ALTER TABLE consultation_notes DROP COLUMN patient_summary"))
        with Operations.context(MigrationContext.configure(conn)), pytest.raises(RuntimeError, match="Partial"):
            module.upgrade()
    engine.dispose()


def test_video_audit_failure_rolls_back_end_without_clinical_completion(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    room = video(db_session, item, people)
    def fail_audit(mapper, connection, target):
        if target.action == "teleconsultation.completed":
            raise RuntimeError("synthetic audit refusal")
    event.listen(HealthAuditLog, "before_insert", fail_audit)
    try:
        response = api.post(f"/api/v1/teleconsultations/{item.id}/complete", headers=people["doctor"]["headers"])
        assert response.status_code == 503
    finally:
        event.remove(HealthAuditLog, "before_insert", fail_audit)
    db_session.refresh(room); db_session.refresh(item)
    assert room.status == item.status == "in_progress"
    assert db_session.query(TeleconsultationParticipant).filter_by(session_id=room.id, left_at=None).count() == 2


def test_stale_operational_write_cannot_reopen_cancelled_consultation(people, db_session):
    from app.database import engine
    from app.routers.teleconsultation import _lock_active
    from fastapi import HTTPException
    item = seed_consultation(db_session, people, "in_progress")
    with Session(engine) as stale, Session(engine) as cancelling:
        old = stale.get(Consultation, item.id)
        cancelling.execute(update(Consultation).where(Consultation.id == item.id).values(status="cancelled"))
        cancelling.commit()
        with pytest.raises(HTTPException) as conflict:
            _lock_active(stale, old)
        assert conflict.value.status_code == 409
    db_session.refresh(item)
    assert item.status == "cancelled"
