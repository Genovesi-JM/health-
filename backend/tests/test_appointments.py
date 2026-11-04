"""Synthetic dated-capacity journeys, races and timezone boundaries."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session

from app.database import Base, engine
from app.health_models import AppointmentSlot, ClinicianCredential, Consultation, HealthAuditLog
from app.routers import appointments, consultations, teleconsultation
from app.services.appointments import slot_interval
from app.services.consultation_lifecycle import transition
from test_consultation_lifecycle import people, seed_consultation


@pytest.fixture
def api():
    app = FastAPI()
    for router in (appointments.router, consultations.router, teleconsultation.router):
        app.include_router(router)
    with TestClient(app) as client:
        yield client


def slot_payload(**overrides):
    start = (datetime.now(ZoneInfo("Africa/Luanda")) + timedelta(days=2)).replace(second=0, microsecond=0)
    payload = {"country": "AO", "timezone": "Africa/Luanda", "starts_at": start.isoformat(),
               "ends_at": (start + timedelta(minutes=30)).isoformat()}
    return payload | overrides


def publish(api, people, who="doctor", **overrides):
    response = api.post("/api/v1/doctor/appointment-slots", json=slot_payload(**overrides), headers=people[who]["headers"])
    assert response.status_code == 201, response.text
    return response.json()


def book(api, people, slot=None, who="patient", key=None, **overrides):
    payload = {"country": "AO", "specialty": "clinica_geral"}
    payload.update({"slot_id": slot["id"]} if slot else {"next_available": True})
    return api.post("/api/v1/consultations/book", json=payload | overrides,
                    headers=people[who]["headers"] | {"Idempotency-Key": key if key is not None else str(uuid4())})


def test_publish_reserve_accept_cancel_release_journey(api, people, db_session):
    slot = publish(api, people)
    assert slot["status"] == "open" and slot["starts_at"].endswith("+00:00")
    listed = api.get("/api/v1/appointments/slots", headers=people["patient"]["headers"])
    assert slot["id"] in {item["id"] for item in listed.json()}
    assert listed.headers["cache-control"] == "private, no-store"
    key = str(uuid4())
    response = book(api, people, slot, key=key)
    assert response.status_code == 200, response.text
    item = response.json()
    assert item["status"] == "requested" and item["slot_id"] == slot["id"]
    assert item["country"] == "AO" and item["timezone"] == "Africa/Luanda"
    assert item["scheduled_end_at"] == slot["ends_at"]
    assert book(api, people, slot, key=key).json()["id"] == item["id"]
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item["id"], action="consultation_booked").count() == 1
    assert book(api, people, slot, who="other_patient").status_code == 409
    assert api.delete(f'/api/v1/doctor/appointment-slots/{slot["id"]}', headers=people["doctor"]["headers"]).status_code == 409
    assert api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people["doctor"]["headers"]).status_code == 200
    assert api.patch(f'/api/v1/consultations/{item["id"]}', json={}, headers=people["patient"]["headers"]).status_code == 200
    replacement = book(api, people, slot, who="other_patient")
    assert replacement.status_code == 200
    # Retrying an old cancelled booking must not acquire the replacement claim.
    assert book(api, people, slot, key=key).json()["status"] == "cancelled"
    db_session.refresh(db_session.get(AppointmentSlot, slot["id"]))
    assert db_session.get(AppointmentSlot, slot["id"]).reserved_consultation_id == replacement.json()["id"]


def test_idempotency_payload_mismatch_and_patient_scope(api, people):
    key = str(uuid4())
    first = book(api, people, key=key)
    assert first.status_code == 200
    assert book(api, people, key=key, specialty="cardiologia").status_code == 409
    other = book(api, people, who="other_patient", key=key)
    assert other.status_code == 200 and other.json()["id"] != first.json()["id"]


@pytest.mark.parametrize("key", ["", "invalid", "0" * 200])
def test_invalid_request_key_cannot_create(api, people, key):
    assert book(api, people, key=key).status_code == 422


def test_unpublished_directed_time_cannot_bypass_capacity(api, people):
    payload = {"country": "AO", "doctor_id": people["doctor"]["profile"].id, "scheduled_at": slot_payload()["starts_at"]}
    response = api.post("/api/v1/consultations/book", json=payload, headers=people["patient"]["headers"])
    assert response.status_code == 409


def test_withdrawn_slot_is_never_bookable_and_delete_is_replay_safe(api, people):
    slot = publish(api, people)
    url = f'/api/v1/doctor/appointment-slots/{slot["id"]}'
    assert api.delete(url, headers=people["other_doctor"]["headers"]).status_code == 404
    assert api.delete(url, headers=people["doctor"]["headers"]).status_code == 200
    assert api.delete(url, headers=people["doctor"]["headers"]).status_code == 200
    assert book(api, people, slot).status_code == 409


def test_overlapping_publication_rejected_but_adjacent_is_allowed(api, people):
    payload = slot_payload()
    publish(api, people, **payload)
    response = api.post("/api/v1/doctor/appointment-slots", json=payload, headers=people["doctor"]["headers"])
    assert response.status_code == 409
    start = datetime.fromisoformat(payload["ends_at"])
    publish(api, people, starts_at=start.isoformat(), ends_at=(start + timedelta(minutes=30)).isoformat())


def test_patient_overlap_across_doctors_is_rejected(api, people):
    one = publish(api, people)
    two = publish(api, people, who="other_doctor")
    assert book(api, people, one).status_code == 200
    assert book(api, people, two).status_code == 409
    assert book(api, people, two, who="other_patient").status_code == 200


@pytest.mark.parametrize("mutation", ["revoked", "expired", "country"])
def test_authority_rechecked_after_publication_and_reservation(api, people, db_session, mutation):
    slot = publish(api, people)
    item = book(api, people, slot).json()
    credential = db_session.query(ClinicianCredential).filter_by(user_id=people["doctor"]["user"].id).one()
    original = (credential.status, credential.licence_expiry_date, credential.practice_country)
    if mutation == "expired": credential.licence_expiry_date = "2000-01-01"
    elif mutation == "country": credential.practice_country = "PT"
    else: credential.status = mutation
    db_session.commit()
    try:
        listed = api.get("/api/v1/appointments/slots", headers=people["patient"]["headers"]).json()
        assert slot["id"] not in {entry["id"] for entry in listed}
        response = api.post(f'/api/v1/doctor/queue/{item["id"]}/accept', headers=people["doctor"]["headers"])
        assert response.status_code in (403, 409)
    finally:
        # The legacy suite shares one database, including an all-credential
        # expiry scan. Do not leak this test's artificial revocation into it.
        credential.status, credential.licence_expiry_date, credential.practice_country = original
        db_session.commit()


@pytest.mark.parametrize("country,zone,start,end", [
    ("PT", "Africa/Luanda", "2027-01-10T12:00:00+01:00", "2027-01-10T12:30:00+01:00"),
    ("AO", "Africa/Luanda", "2027-01-10T12:00:00Z", "2027-01-10T12:30:00Z"),
    ("AO", "Africa/Luanda", "2027-01-10T12:00:00", "2027-01-10T12:30:00"),
    ("PT", "Europe/Lisbon", "2027-03-28T01:15:00+00:00", "2027-03-28T01:45:00+00:00"),
    ("AO", "Africa/Luanda", "2027-01-10T12:00:00+01:00", "2027-01-10T12:10:00+01:00"),
    ("AO", "Africa/Luanda", "2027-01-10T12:00:00+01:00", "2027-01-10T15:00:00+01:00"),
])
def test_invalid_zone_offset_gap_or_duration(country, zone, start, end):
    with pytest.raises(HTTPException) as error:
        slot_interval(datetime.fromisoformat(start), datetime.fromisoformat(end), country, zone)
    assert error.value.status_code == 422


def test_repeated_portugal_hour_is_unambiguous_with_explicit_offset(monkeypatch):
    from app.services import appointments as service
    class FixedTime(datetime):
        @classmethod
        def utcnow(cls):
            return datetime(2026, 10, 4)
    monkeypatch.setattr(service, "datetime", FixedTime)
    summer = slot_interval(datetime.fromisoformat("2026-10-25T01:15:00+01:00"),
                           datetime.fromisoformat("2026-10-25T01:45:00+01:00"), "PT", "Europe/Lisbon")
    winter = slot_interval(datetime.fromisoformat("2026-10-25T01:15:00+00:00"),
                           datetime.fromisoformat("2026-10-25T01:45:00+00:00"), "PT", "Europe/Lisbon")
    assert winter[0] - summer[0] == timedelta(hours=1)


@pytest.mark.parametrize("zone", ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"])
def test_portugal_slots_use_their_own_timezone_and_market(api, people, db_session, zone):
    from consent_fixtures import grant_all
    grant_all(db_session, people["patient"]["profile"], country="PT")
    credential = db_session.query(ClinicianCredential).filter_by(user_id=people["doctor"]["user"].id).one()
    credential.practice_country = "PT"
    db_session.commit()
    start = datetime.now(ZoneInfo(zone)) + timedelta(days=3)
    slot = publish(api, people, country="PT", timezone=zone, starts_at=start.isoformat(), ends_at=(start + timedelta(minutes=30)).isoformat())
    assert book(api, people, slot).status_code == 409
    response = book(api, people, slot, country="PT")
    assert response.status_code == 200 and response.json()["country"] == "PT"


def test_queue_acceptance_cannot_create_two_active_consultations(api, people, db_session):
    one = book(api, people).json()
    two = book(api, people, who="other_patient").json()
    first = api.post(f'/api/v1/doctor/queue/{one["id"]}/accept', headers=people["doctor"]["headers"])
    assert first.status_code == 200
    assert api.post(f'/api/v1/doctor/queue/{two["id"]}/accept', headers=people["doctor"]["headers"]).status_code == 409
    assert api.patch(f'/api/v1/consultations/{one["id"]}', json={}, headers=people["doctor"]["headers"]).status_code == 200
    assert api.post(f'/api/v1/doctor/queue/{two["id"]}/accept', headers=people["doctor"]["headers"]).status_code == 200


def test_simultaneous_slot_reservations_have_one_winner(api, people, db_session):
    slot = publish(api, people)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(book, api, people, slot, who=who) for who in ("patient", "other_patient")]
        results = [future.result() for future in futures]
    assert sorted(response.status_code for response in results) == [200, 409]
    assert db_session.query(Consultation).filter_by(slot_id=slot["id"]).count() == 1


def test_simultaneous_acceptance_of_distinct_requests_has_one_winner(api, people, db_session):
    ids = [book(api, people, who=who).json()["id"] for who in ("patient", "other_patient")]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(api.post, f'/api/v1/doctor/queue/{cid}/accept', headers=people["doctor"]["headers"]) for cid in ids]
        results = [future.result() for future in futures]
    assert sorted(response.status_code for response in results) == [200, 409]


def test_stale_cancel_cannot_release_replacement_claim(api, people, db_session):
    slot = publish(api, people)
    item = book(api, people, slot).json()
    with Session(engine) as stale:
        copy = stale.get(Consultation, item["id"])
        assert api.patch(f'/api/v1/consultations/{item["id"]}', json={}, headers=people["patient"]["headers"]).status_code == 200
        replacement = book(api, people, slot, who="other_patient").json()
        with pytest.raises(HTTPException):
            transition(stale, copy, actor_id=people["patient"]["user"].id, action="consultation_cancelled", allowed_from=("requested",), status="cancelled")
    db_session.expire_all()
    assert db_session.get(AppointmentSlot, slot["id"]).reserved_consultation_id == replacement["id"]


def test_booking_audit_failure_rolls_back_capacity(api, people, db_session):
    slot = publish(api, people)
    def fail(mapper, connection, target):
        if target.action == "consultation_booked": raise RuntimeError("synthetic audit failure")
    event.listen(HealthAuditLog, "before_insert", fail)
    try:
        assert book(api, people, slot).status_code == 503
    finally:
        event.remove(HealthAuditLog, "before_insert", fail)
    db_session.expire_all()
    assert db_session.get(AppointmentSlot, slot["id"]).reserved_consultation_id is None
    assert book(api, people, slot).status_code == 200


def test_committed_booking_response_failure_recovers_same_request(api, people, db_session, monkeypatch):
    slot = publish(api, people)
    original = Session.refresh
    failed = []
    def fail_refresh(session, instance, *args, **kwargs):
        if isinstance(instance, Consultation) and instance.booking_request_key and not failed:
            failed.append(instance.id)
            raise RuntimeError("synthetic response failure after commit")
        return original(session, instance, *args, **kwargs)
    monkeypatch.setattr(Session, "refresh", fail_refresh)
    key = str(uuid4())
    assert book(api, people, slot, key=key).status_code == 503
    replay = book(api, people, slot, key=key)
    assert replay.status_code == 200 and replay.json()["id"] == failed[0]
    assert db_session.query(Consultation).filter_by(slot_id=slot["id"]).count() == 1


def test_queue_discovery_and_acceptance_observe_market(api, people, db_session):
    from consent_fixtures import grant_all
    grant_all(db_session, people["patient"]["profile"], country="PT")
    db_session.commit()
    request = book(api, people, country="PT").json()
    queue = api.get("/api/v1/doctor/queue", headers=people["doctor"]["headers"]).json()
    assert request["id"] not in {item["id"] for item in queue}
    assert api.post(f'/api/v1/doctor/queue/{request["id"]}/accept', headers=people["doctor"]["headers"]).status_code == 409
    credential = db_session.query(ClinicianCredential).filter_by(user_id=people["doctor"]["user"].id).one()
    credential.practice_country = "PT"
    db_session.commit()
    assert api.post(f'/api/v1/doctor/queue/{request["id"]}/accept', headers=people["doctor"]["headers"]).status_code == 200


def test_overrunning_consultation_blocks_another_start(api, people, db_session):
    ongoing = seed_consultation(db_session, people, status="in_progress", scheduled_at=datetime.utcnow() - timedelta(hours=2),
                               scheduled_end_at=datetime.utcnow() - timedelta(hours=1))
    pending = Consultation(patient_id=people["other_patient"]["profile"].id,
        doctor_id=people["doctor"]["profile"].id, status="scheduled",
        scheduled_at=datetime.utcnow() + timedelta(hours=3), scheduled_end_at=datetime.utcnow() + timedelta(hours=4))
    db_session.add(pending)
    db_session.commit()
    assert api.post(f'/api/v1/doctor/queue/{pending.id}/start', headers=people["doctor"]["headers"]).status_code == 409
    db_session.refresh(pending)
    assert pending.status == "scheduled"


def test_late_start_checks_actual_interval_against_current_reservation(api, people, db_session):
    late = seed_consultation(db_session, people, status="scheduled", scheduled_at=datetime.utcnow() - timedelta(hours=2),
                            scheduled_end_at=datetime.utcnow() - timedelta(hours=1))
    next_item = Consultation(patient_id=people["other_patient"]["profile"].id,
        doctor_id=people["doctor"]["profile"].id, status="scheduled",
        scheduled_at=datetime.utcnow() + timedelta(minutes=15), scheduled_end_at=datetime.utcnow() + timedelta(minutes=45))
    db_session.add(next_item)
    db_session.commit()
    assert api.post(f'/api/v1/doctor/queue/{late.id}/start', headers=people["doctor"]["headers"]).status_code == 409
    db_session.refresh(late)
    assert late.status == "scheduled"


def test_duplicate_unscheduled_patient_request_is_blocked(api, people):
    assert book(api, people).status_code == 200
    assert book(api, people).status_code == 409


def test_patient_cannot_cancel_care_that_has_started(api, people, db_session):
    item = seed_consultation(db_session, people, status="in_progress")
    response = api.patch(f'/api/v1/consultations/{item.id}', json={}, headers=people["patient"]["headers"])
    assert response.status_code == 409
    db_session.refresh(item)
    assert item.status == "in_progress"
    assert api.patch(f'/api/v1/consultations/{item.id}', json={}, headers=people["doctor"]["headers"]).status_code == 200


def test_window_is_bounded_and_timezone_aware(api, people):
    headers = people["patient"]["headers"]
    assert api.get("/api/v1/appointments/slots?from_at=2027-01-01T00:00:00Z&to_at=2027-03-01T00:00:00Z", headers=headers).status_code == 422
    assert api.get("/api/v1/appointments/slots?from_at=2027-01-01T00:00:00", headers=headers).status_code == 422


def test_capabilities_and_clinician_authorization(api, people):
    assert api.get("/api/v1/appointments/capabilities").status_code == 403
    response = api.get("/api/v1/appointments/capabilities", headers=people["patient"]["headers"])
    assert [market["country"] for market in response.json()["markets"]] == ["AO", "PT"]
    assert api.post("/api/v1/doctor/appointment-slots", json=slot_payload(), headers=people["patient"]["headers"]).status_code == 403
    assert api.post("/api/v1/doctor/appointment-slots", json=slot_payload(), headers=people["unverified"]["headers"]).status_code == 403


def migration():
    spec = importlib.util.spec_from_file_location("slot_migration", Path(__file__).parents[1] / "alembic/versions/appointment_slots_v1.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_preserves_unknown_legacy_country_and_downgrades(tmp_path):
    local = create_engine(f'sqlite:///{tmp_path / "migration.db"}')
    with local.begin() as conn:
        conn.execute(text("CREATE TABLE doctors (id VARCHAR(36) PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE consultations (id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36), scheduled_at DATETIME)"))
        conn.execute(text("INSERT INTO consultations (id, patient_id) VALUES ('historical', 'patient')"))
        with Operations.context(MigrationContext.configure(conn)):
            migration().upgrade()
            assert conn.execute(text("SELECT country FROM consultations WHERE id='historical'")).scalar() is None
            migration().downgrade()
        assert conn.execute(text("SELECT id FROM consultations")).scalar() == "historical"
        assert "appointment_slots" not in inspect(conn).get_table_names()


def test_migration_adopts_current_schema_and_rejects_missing_uniqueness(tmp_path):
    local = create_engine(f'sqlite:///{tmp_path / "adoption.db"}')
    Base.metadata.create_all(local)
    with local.begin() as conn, Operations.context(MigrationContext.configure(conn)):
        migration().upgrade()
        conn.execute(text("DROP INDEX ix_consultations_patient_booking_key"))
        with pytest.raises(RuntimeError, match="uniqueness"):
            migration().upgrade()
