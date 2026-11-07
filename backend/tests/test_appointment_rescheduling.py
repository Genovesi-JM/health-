"""Atomic reservation moves, stale clinician actions and exact lost-response retry."""
from datetime import datetime, timedelta
import importlib.util
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.health_models import AppointmentSlot, ClinicianCredential, Consultation, ConsultationReschedule, HealthAuditLog, Notification, PatientConsent
from app.services import appointment_rescheduling as service
from app.services.consultation_lifecycle import transition
from test_appointments import api, people, publish, book, slot_payload


def pair(api, people, **overrides):
    first = publish(api, people)
    payload = slot_payload()
    start = datetime.fromisoformat(payload["starts_at"]) + timedelta(hours=2)
    second = publish(api, people, starts_at=start.isoformat(), ends_at=(start + timedelta(minutes=30)).isoformat(), **overrides)
    item = book(api, people, first).json()
    return first, second, item


def move(api, people, item, target, *, key=None, revision=None, who="patient", **changes):
    return api.post(f'/api/v1/consultations/{item["id"]}/reschedule',
        json={"slot_id": target["id"], "expected_revision": item.get("reschedule_revision", 0) if revision is None else revision} | changes,
        headers=people[who]["headers"] | {"Idempotency-Key": key if key is not None else str(uuid4())})


def test_move_preserves_identity_releases_old_slot_and_requires_new_acceptance(api, people, db_session):
    first, second, item = pair(api, people)
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people["doctor"]["headers"]).status_code == 200
    result = move(api, people, item, second)
    assert result.status_code == 200, result.text
    result = result.json()
    assert result["id"] == item["id"] and result["status"] == "requested"
    assert result["reschedule_revision"] == 1 and result["scheduled_at"] == second["starts_at"]
    assert result["scheduled_end_at"] == second["ends_at"] and result["timezone"] == second["timezone"]
    assert db_session.get(AppointmentSlot, first["id"], populate_existing=True).reserved_consultation_id is None
    assert db_session.get(AppointmentSlot, second["id"], populate_existing=True).reserved_consultation_id == item["id"]
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/start', headers=people["doctor"]["headers"]).status_code == 404
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', params={"expected_revision": 1}, headers=people["doctor"]["headers"]).status_code == 200
    notices = db_session.query(Notification).filter_by(user_id=people["patient"]["user"].id).all()
    assert len([n for n in notices if n.title == "Consulta aceite"]) == 2
    assert book(api, people, first, who="other_patient").status_code == 200


def test_exact_retry_and_changed_payload_have_no_duplicate_move_audit_or_notice(api, people, db_session):
    first, second, item = pair(api, people); key = str(uuid4())
    assert move(api, people, item, second, key=key).status_code == 200
    assert move(api, people, item, second, key=key).json()["reschedule_revision"] == 1
    mismatch = move(api, people, item, first, key=key)
    assert mismatch.status_code == 409 and isinstance(mismatch.json()["detail"], str)
    assert db_session.query(ConsultationReschedule).filter_by(consultation_id=item["id"]).count() == 1
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item["id"], action="consultation_rescheduled").count() == 1
    assert db_session.query(Notification).filter_by(related_entity_id=item["id"], title="Alteração de horário pedida").count() == 2


def test_lost_commit_acknowledgment_recovers_same_move(api, people, db_session, monkeypatch):
    first, second, item = pair(api, people); key = str(uuid4()); original = Session.commit
    def lost(session):
        original(session)
        raise RuntimeError("Synthetic connection lost after commit")
    monkeypatch.setattr(Session, "commit", lost)
    assert move(api, people, item, second, key=key).status_code == 503
    monkeypatch.setattr(Session, "commit", original)
    result = move(api, people, item, second, key=key)
    assert result.status_code == 200 and result.json()["reschedule_revision"] == 1
    assert db_session.query(ConsultationReschedule).filter_by(consultation_id=item["id"]).count() == 1


def test_notification_failure_rolls_back_both_capacity_claims_and_history(api, people, db_session, monkeypatch):
    first, second, item = pair(api, people)
    monkeypatch.setattr(service, "enqueue_notification", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("write failed")))
    assert move(api, people, item, second).status_code == 503
    assert db_session.get(AppointmentSlot, first["id"], populate_existing=True).reserved_consultation_id == item["id"]
    assert db_session.get(AppointmentSlot, second["id"], populate_existing=True).reserved_consultation_id is None
    assert db_session.get(Consultation, item["id"], populate_existing=True).reschedule_revision == 0
    assert db_session.query(ConsultationReschedule).filter_by(consultation_id=item["id"]).count() == 0


@pytest.mark.parametrize("who,status", [("other_patient", 404), ("doctor", 404)])
def test_only_owner_can_move(api, people, who, status):
    _, second, item = pair(api, people)
    assert move(api, people, item, second, who=who).status_code == status


@pytest.mark.parametrize("invalid", ["occupied", "withdrawn", "past", "same_slot", "other_doctor", "unknown_country", "paid", "payment_reference", "wrong_zone", "broken_old_claim", "stale_revision"])
def test_rejected_move_preserves_original_reservation(api, people, db_session, invalid):
    first, second, item = pair(api, people)
    target = db_session.get(AppointmentSlot, second["id"])
    stored = db_session.get(Consultation, item["id"])
    if invalid == "occupied":
        assert book(api, people, second, who="other_patient").status_code == 200
    elif invalid == "withdrawn": target.withdrawn = True
    elif invalid == "past": target.starts_at = datetime(2000, 1, 1)
    elif invalid == "same_slot": second = first
    elif invalid == "other_doctor": target.doctor_id = people["other_doctor"]["profile"].id
    elif invalid == "unknown_country": stored.country = None
    elif invalid == "paid": stored.payment_status = "paid"
    elif invalid == "payment_reference": stored.payment_id = str(uuid4())
    elif invalid == "wrong_zone": target.timezone = "Europe/Lisbon"
    elif invalid == "broken_old_claim": db_session.get(AppointmentSlot, first["id"]).reserved_consultation_id = None
    db_session.commit()
    response = move(api, people, item, second, revision=9 if invalid == "stale_revision" else None)
    assert response.status_code == 409, response.text
    assert response.json()["detail"]["request_key_committed"] is False
    assert db_session.get(Consultation, item["id"], populate_existing=True).slot_id == first["id"]
    assert db_session.query(ConsultationReschedule).filter_by(consultation_id=item["id"]).count() == 0


@pytest.mark.parametrize("status", ["in_progress", "completed", "cancelled", "no_show"])
def test_terminal_or_started_care_cannot_move(api, people, db_session, status):
    _, second, item = pair(api, people)
    db_session.get(Consultation, item["id"]).status = status; db_session.commit()
    assert move(api, people, item, second).status_code == 409


def test_patient_conflict_with_other_clinician_keeps_original(api, people):
    first, second, item = pair(api, people)
    start = datetime.fromisoformat(second["starts_at"]).astimezone(ZoneInfo("Africa/Luanda"))
    competing = publish(api, people, who="other_doctor", starts_at=start.isoformat(), ends_at=(start + timedelta(minutes=30)).isoformat())
    assert book(api, people, competing).status_code == 200
    response = move(api, people, item, second)
    assert response.status_code == 409 and response.json()["detail"]["request_key_committed"] is False
    assert next(c for c in api.get('/api/v1/consultations/me', headers=people["patient"]["headers"]).json() if c["id"] == item["id"])["slot_id"] == first["id"]


@pytest.mark.parametrize("mutation", ["consent", "credential"])
def test_current_authority_is_required_for_new_move(api, people, db_session, mutation):
    _, second, item = pair(api, people)
    if mutation == "consent":
        from consent_fixtures import withdraw
        withdraw(db_session, people["patient"]["profile"], "telemedicine_consent")
    else:
        db_session.query(ClinicianCredential).filter_by(user_id=people["doctor"]["user"].id).update({"status": "revoked"})
    db_session.commit()
    assert move(api, people, item, second).status_code == 403


def test_stale_doctor_accept_cannot_approve_new_time(api, people):
    _, second, item = pair(api, people)
    with Session(engine) as stale:
        old = stale.get(Consultation, item["id"])
        assert old.reschedule_revision == 0
        assert move(api, people, item, second).status_code == 200
        with pytest.raises(HTTPException) as error:
            transition(stale, old, actor_id=people["doctor"]["user"].id, action="consultation_accepted", allowed_from=("requested",), status="scheduled")
        assert error.value.status_code == 409


@pytest.mark.parametrize("revision", [-1, True, "0", 1.5])
def test_expected_revision_is_strict_and_nonnegative(api, people, revision):
    _, second, item = pair(api, people)
    assert move(api, people, item, second, revision=revision).status_code == 422


def migration():
    spec = importlib.util.spec_from_file_location("reschedule_migration", Path(__file__).parents[1] / "alembic/versions/appointment_reschedules_v1.py")
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_fresh_migration_preserves_existing_records_and_revision_zero():
    database = create_engine("sqlite://")
    with database.begin() as connection:
        connection.execute(text("CREATE TABLE consultations (id VARCHAR(36) PRIMARY KEY NOT NULL)"))
        connection.execute(text("INSERT INTO consultations (id) VALUES ('historical')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration().upgrade()
            assert connection.execute(text("SELECT reschedule_revision FROM consultations")).scalar() == 0
            migration().upgrade()
            migration().downgrade()
        assert "reschedule_revision" not in {c["name"] for c in inspect(connection).get_columns("consultations")}
    database.dispose()


def test_adopt_runtime_schema_and_refuse_history_erasing_downgrade(api, people):
    _, second, item = pair(api, people)
    assert move(api, people, item, second).status_code == 200
    with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
        migration().upgrade()
        with pytest.raises(RuntimeError, match="Retained"):
            migration().downgrade()
