"""Regression coverage for the request/accept/start/complete boundary.

Synthetic records only. Route tests use real authentication and database
dependencies without booting demo seeding or external integrations.
"""
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.database import engine
from app.health_models import (
    ClinicianCredential, Consultation, ConsultationNotes, Doctor, HealthAuditLog,
    Patient, PatientConsent, TeleconsultationParticipant, TeleconsultationSession,
)
from app.models import User
from app.oauth2 import create_access_token
from app.rbac import assert_doctor_can_access_patient
from app.routers import consultations, doctor_portal, teleconsultation
from app.services.consultation_lifecycle import transition


@pytest.fixture
def api():
    app = FastAPI()
    for router in (consultations.router, doctor_portal.router, teleconsultation.router):
        app.include_router(router)
    with TestClient(app) as client:
        yield client


@pytest.fixture
def people(db_session):
    def person(role, specialty="clinica_geral", verified=True):
        user = User(email=f"lifecycle-{uuid4().hex}@example.com", role=role,
                    password_hash="unused-test-password", is_active=True)
        db_session.add(user)
        db_session.flush()
        if role == "patient":
            profile = Patient(user_id=user.id)
            db_session.add(profile)
            db_session.flush()
            for kind in ("privacy_policy", "telemedicine_consent", "terms_of_service"):
                db_session.add(PatientConsent(patient_id=profile.id, consent_type=kind))
        else:
            profile = Doctor(user_id=user.id, license_number=f"TEST-{uuid4().hex}",
                             specialization=specialty,
                             verification_status="verified" if verified else "pending")
            db_session.add(profile)
            db_session.add(ClinicianCredential(
                user_id=user.id, profession="doctor", legal_name="Synthetic clinician",
                practice_country="AO", licence_country="AO", issuing_authority="Test",
                licence_number=f"TEST-{uuid4().hex}", diploma_country="AO",
                diploma_institution="Test", degree_title="Test", status="verified" if verified else "pending_review",
            ))
        db_session.commit()
        token = create_access_token({"sub": user.email, "uid": user.id})
        return {"user": user, "profile": profile, "headers": {"Authorization": f"Bearer {token}"}}
    return {
        "patient": person("patient"), "other_patient": person("patient"),
        "doctor": person("doctor"), "other_doctor": person("doctor"),
        "specialist": person("doctor", specialty="cardiologia"),
        "unverified": person("doctor", verified=False),
    }


def scheduled_payload(people):
    return {"doctor_id": people["doctor"]["profile"].id,
            "scheduled_at": (datetime.now(timezone(timedelta(hours=2))) + timedelta(days=2)).isoformat(),
            "specialty": "clinica_geral"}


def seed_consultation(db, people, status="requested", assigned=True, **values):
    item = Consultation(patient_id=people["patient"]["profile"].id,
                        doctor_id=people["doctor"]["profile"].id if assigned else None,
                        status=status, **values)
    db.add(item)
    db.commit()
    return item


def test_directed_request_requires_acceptance_before_start_and_record_access(api, people, db_session):
    payload = scheduled_payload(people)
    response = api.post("/api/v1/consultations/book", json=payload, headers=people["patient"]["headers"])
    assert response.status_code == 200, response.text
    item = response.json()
    cid = item["id"]
    assert item["status"] == "requested"
    assert item["started_at"] is None
    assert datetime.fromisoformat(item["scheduled_at"]) == datetime.fromisoformat(payload["scheduled_at"])
    assert item["scheduled_at"].endswith("+00:00")

    for who, visible in (("doctor", True), ("other_doctor", False)):
        queue = api.get("/api/v1/doctor/queue", headers=people[who]["headers"]).json()
        assert (cid in {row["id"] for row in queue}) == visible
    assert api.post(f"/api/v1/doctor/queue/{cid}/accept", headers=people["other_doctor"]["headers"]).status_code == 404
    assert api.post(f"/api/v1/doctor/queue/{cid}/start", headers=people["doctor"]["headers"]).status_code == 404
    with pytest.raises(HTTPException) as denied:
        assert_doctor_can_access_patient(people["doctor"]["profile"], people["patient"]["profile"].id, db_session)
    assert denied.value.status_code == 403
    patient_id = people["patient"]["profile"].id
    assert api.get(f"/api/v1/doctor/patients/{patient_id}/summary", headers=people["doctor"]["headers"]).status_code == 404

    accepted = api.post(f"/api/v1/doctor/queue/{cid}/accept", headers=people["doctor"]["headers"])
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "scheduled"
    assert accepted.json()["started_at"] is None
    assert_doctor_can_access_patient(people["doctor"]["profile"], patient_id, db_session)
    assert api.post(f"/api/v1/doctor/queue/{cid}/accept", headers=people["doctor"]["headers"]).status_code == 409
    started = api.post(f"/api/v1/doctor/queue/{cid}/start", headers=people["doctor"]["headers"])
    assert started.status_code == 200
    assert started.json()["status"] == "in_progress"
    completed = api.post(f"/api/v1/consultations/{cid}/complete", headers=people["doctor"]["headers"],
                         json={"assessment": "Synthetic assessment", "plan": "Synthetic follow-up", "outcome": "follow_up"})
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=cid).count() == 1
    events = db_session.query(HealthAuditLog).filter_by(resource_id=cid).order_by(HealthAuditLog.created_at).all()
    assert [e.action for e in events] == ["consultation_booked", "consultation_accepted", "consultation_started", "consultation_completed"]
    assert json.loads(events[1].metadata_json) == {"from_status": "requested", "to_status": "scheduled"}


@pytest.mark.parametrize("invalid", ["doctor_only", "time_only", "past", "no_timezone", "conflicting_mode", "specialty"])
def test_invalid_booking_cannot_create_a_request(api, people, db_session, invalid):
    payload = scheduled_payload(people)
    if invalid == "doctor_only":
        del payload["scheduled_at"]
    elif invalid == "time_only":
        del payload["doctor_id"]
    elif invalid == "past":
        payload["scheduled_at"] = "2000-01-01T10:00:00Z"
    elif invalid == "no_timezone":
        payload["scheduled_at"] = "2099-01-01T10:00:00"
    elif invalid == "conflicting_mode":
        payload["next_available"] = True
    else:
        payload["specialty"] = "cardiologia"
    response = api.post("/api/v1/consultations/book", json=payload, headers=people["patient"]["headers"])
    assert response.status_code == 422, response.text
    assert db_session.query(Consultation).filter_by(patient_id=people["patient"]["profile"].id).count() == 0


def test_unverified_doctor_cannot_be_selected_or_accept(api, people, db_session):
    payload = scheduled_payload(people)
    payload["doctor_id"] = people["unverified"]["profile"].id
    assert api.post("/api/v1/consultations/book", json=payload, headers=people["patient"]["headers"]).status_code == 400
    item = seed_consultation(db_session, people, assigned=False)
    assert api.post(f"/api/v1/doctor/queue/{item.id}/accept", headers=people["unverified"]["headers"]).status_code == 403


def test_specialty_filter_cannot_expand_queue_or_acceptance(api, people, db_session):
    item = seed_consultation(db_session, people, assigned=False, specialty="cardiologia")
    queue = api.get("/api/v1/doctor/queue?specialty=cardiologia", headers=people["doctor"]["headers"]).json()
    assert item.id not in {row["id"] for row in queue}
    assert api.post(f"/api/v1/doctor/queue/{item.id}/accept", headers=people["doctor"]["headers"]).status_code == 404
    accepted = api.post(f"/api/v1/doctor/queue/{item.id}/accept", headers=people["specialist"]["headers"])
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "in_progress"


@pytest.mark.parametrize("status", ["requested", "scheduled", "cancelled", "no_show", "completed"])
def test_only_in_progress_consultations_can_complete(api, people, db_session, status):
    item = seed_consultation(db_session, people, status)
    response = api.post(f"/api/v1/consultations/{item.id}/complete", json={"outcome": "resolved"},
                        headers=people["doctor"]["headers"])
    assert response.status_code == 409
    db_session.refresh(item)
    assert item.status == status
    assert db_session.query(ConsultationNotes).filter_by(consultation_id=item.id).count() == 0
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item.id).count() == 0


def test_patient_isolation_and_terminal_cancellation(api, people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    url = f"/api/v1/consultations/{item.id}"
    assert api.patch(url, json={}, headers=people["other_patient"]["headers"]).status_code == 403
    assert api.post(url + "/complete", json={}, headers=people["other_doctor"]["headers"]).status_code == 404
    assert api.post(url + "/complete", json={}, headers=people["patient"]["headers"]).status_code == 403
    assert api.patch(url, json={"reason": "Synthetic cancellation"}, headers=people["patient"]["headers"]).status_code == 200
    assert api.patch(url, json={}, headers=people["patient"]["headers"]).status_code == 409
    audit = db_session.query(HealthAuditLog).filter_by(resource_id=item.id).one()
    assert audit.action == "consultation_cancelled"
    assert "Synthetic cancellation" not in audit.metadata_json


def test_stale_second_clinician_cannot_claim_same_request(people, db_session):
    item = seed_consultation(db_session, people, assigned=False)
    with Session(engine) as first, Session(engine) as second:
        first_copy = first.get(Consultation, item.id)
        stale_copy = second.get(Consultation, item.id)
        transition(first, first_copy, actor_id=people["doctor"]["user"].id,
                   action="consultation_accepted", allowed_from=("requested",),
                   status="in_progress", doctor_id=people["doctor"]["profile"].id)
        first.commit()
        with pytest.raises(HTTPException) as conflict:
            transition(second, stale_copy, actor_id=people["other_doctor"]["user"].id,
                       action="consultation_accepted", allowed_from=("requested",),
                       status="in_progress", doctor_id=people["other_doctor"]["profile"].id)
        assert conflict.value.status_code == 409
    db_session.refresh(item)
    assert item.doctor_id == people["doctor"]["profile"].id
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item.id).count() == 1


def test_stale_completion_cannot_overwrite_cancellation(people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    with Session(engine) as cancelling, Session(engine) as completing:
        cancel_copy = cancelling.get(Consultation, item.id)
        stale_copy = completing.get(Consultation, item.id)
        transition(cancelling, cancel_copy, actor_id=people["patient"]["user"].id,
                   action="consultation_cancelled", allowed_from=("in_progress",), status="cancelled")
        cancelling.commit()
        with pytest.raises(HTTPException) as conflict:
            transition(completing, stale_copy, actor_id=people["doctor"]["user"].id,
                       action="consultation_completed", allowed_from=("in_progress",), status="completed")
        assert conflict.value.status_code == 409
    db_session.refresh(item)
    assert item.status == "cancelled"


def test_audit_write_failure_rolls_back_state(people, db_session):
    item = seed_consultation(db_session, people, "in_progress")
    def fail_audit(mapper, connection, target):
        raise RuntimeError("synthetic audit failure")
    event.listen(HealthAuditLog, "before_insert", fail_audit)
    try:
        with Session(engine) as session, pytest.raises(RuntimeError, match="synthetic audit failure"):
            transition(session, session.get(Consultation, item.id), actor_id=people["doctor"]["user"].id,
                       action="consultation_completed", allowed_from=("in_progress",), status="completed")
            session.commit()
    finally:
        event.remove(HealthAuditLog, "before_insert", fail_audit)
    db_session.refresh(item)
    assert item.status == "in_progress"
    assert db_session.query(HealthAuditLog).filter_by(resource_id=item.id).count() == 0


@pytest.mark.parametrize("status", ["requested", "cancelled", "completed", "no_show"])
@pytest.mark.parametrize("action", ["start", "complete"])
def test_video_endpoints_cannot_bypass_consultation_state(api, people, db_session, status, action):
    item = seed_consultation(db_session, people, status)
    video = TeleconsultationSession(
        consultation_id=item.id, status="in_progress", room_key=f"test-{uuid4().hex}",
        identity_confirmed=True, consent_confirmed=True, vitals_reviewed=True,
        medication_reviewed=True, clinical_summary_ready=True,
    )
    db_session.add(video)
    db_session.flush()
    db_session.add(TeleconsultationParticipant(
        session_id=video.id, user_id=people["doctor"]["user"].id, role="doctor",
        camera_ready=True, microphone_ready=True, checked_in_at=datetime.utcnow(),
    ))
    db_session.commit()
    response = api.post(f"/api/v1/teleconsultations/{item.id}/{action}", headers=people["doctor"]["headers"])
    assert response.status_code == 409, response.text
    db_session.refresh(item)
    assert item.status == status
