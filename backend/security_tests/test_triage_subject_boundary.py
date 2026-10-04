"""Real isolated HTTP routes must not attribute another subject to the account holder."""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.database import get_db
from app.deps import get_current_user
from app.health_models import ClinicianCredential, Consultation, DeviceReading, Doctor, Patient, TriagePhoto, TriageSession
from app.models import User
from app.routers import triage


@pytest.fixture
def context(db, monkeypatch, tmp_path):
    patient_user = User(email="synthetic-patient@example.invalid", role="patient", password_hash="unused", is_active=True)
    doctor_user = User(email="synthetic-doctor@example.invalid", role="doctor", password_hash="unused", is_active=True)
    nurse = User(email="synthetic-nurse@example.invalid", role="nurse", password_hash="unused", is_active=True)
    db.add_all([patient_user, doctor_user, nurse]); db.flush()
    patient = Patient(user_id=patient_user.id)
    doctor = Doctor(user_id=doctor_user.id, verification_status="verified")
    credential = ClinicianCredential(user_id=doctor_user.id, profession="doctor", legal_name="Synthetic Doctor",
        practice_country="AO", licence_country="AO", issuing_authority="Synthetic Registry", licence_number="SYNTHETIC",
        licence_expiry_date=(date.today() + timedelta(days=30)).isoformat(), diploma_country="AO",
        diploma_institution="Synthetic University", degree_title="Medicine", status="verified")
    db.add_all([patient, doctor, credential]); db.flush()
    session = TriageSession(patient_id=patient.id, chief_complaint="Synthetic self complaint", status="completed")
    db.add(session); db.flush()
    visit = Consultation(patient_id=patient.id, doctor_id=doctor.id, triage_session_id=session.id, status="scheduled", country="AO")
    photo = TriagePhoto(triage_session_id=session.id, view_type="context", original_filename="synthetic.png",
        content_type="image/png", size_bytes=8, storage_key="synthetic/photo.png")
    db.add_all([visit, photo]); db.commit()
    signed = []; content = tmp_path / "synthetic.png"; content.write_bytes(b"\x89PNG\r\n\x1a\n")
    storage = SimpleNamespace(location=str(content))
    def signed_url(key):
        signed.append(key); return storage.location
    monkeypatch.setattr(triage, "get_health_storage", lambda: SimpleNamespace(get_signed_url=signed_url))
    actor = {"user": patient_user}
    app = FastAPI(); app.include_router(triage.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: actor["user"]
    with TestClient(app) as client:
        yield SimpleNamespace(client=client, actor=actor, patient=patient, patient_user=patient_user, doctor_user=doctor_user,
            nurse=nurse, credential=credential, session=session, photo=photo, storage=storage, signed=signed)


@pytest.mark.parametrize("context_fields", [
    {"dependent_id": "synthetic-child"}, {"dependent_id": "foreign-identifier"}, {"dependent_id": None},
    {"dependent_id": {"id": "malformed"}}, {"dependent_id": 7}, {"patient_id": "foreign-patient"},
    {"subject_selector": "unrecognized"}, {"age_group": "pediatric"}, {"age_group": "unknown"},
    {"answered_by_guardian": True},
])
def test_unsupported_subject_never_creates_triage_or_readings(context, db, context_fields):
    before = (db.query(TriageSession).count(), db.query(DeviceReading).count())
    response = context.client.post("/api/v1/triage/start", json={"chief_complaint": "Synthetic other-person complaint",
        "age_group": "adult", "answered_by_guardian": False, "vital_signs": {"temperature": 39}, **context_fields})
    assert response.status_code == 409
    assert "não está disponível" in response.json()["detail"]
    assert (db.query(TriageSession).count(), db.query(DeviceReading).count()) == before


def test_explicit_self_adult_preserves_subject_for_session_and_measurement(context, db):
    response = context.client.post("/api/v1/triage/start", json={"chief_complaint": "Synthetic self complaint",
        "age_group": "adult", "answered_by_guardian": False, "vital_signs": {"temperature": 37}})
    assert response.status_code == 200
    session = db.get(TriageSession, response.json()["triage_id"])
    reading = db.query(DeviceReading).one()
    assert session.patient_id == reading.patient_id == context.patient.id


@pytest.mark.parametrize("role_state", ["nurse", "revoked", "expired", "inactive"])
@pytest.mark.parametrize("resource", ["photos", "photo-requests", "content"])
def test_photo_reads_require_current_assigned_doctor_authority(context, db, role_state, resource):
    context.actor["user"] = context.nurse if role_state == "nurse" else context.doctor_user
    if role_state == "revoked": context.credential.status = "revoked"
    if role_state == "expired": context.credential.licence_expiry_date = (date.today() - timedelta(days=1)).isoformat()
    if role_state == "inactive": context.doctor_user.is_active = False
    db.commit()
    path = f"/api/v1/triage/{context.session.id}/" + (f"photos/{context.photo.id}/content" if resource == "content" else resource)
    response = context.client.get(path, follow_redirects=False)
    assert response.status_code == 403
    assert context.signed == []
    assert "synthetic.png" not in response.text


@pytest.mark.parametrize("actor", ["patient", "doctor"])
@pytest.mark.parametrize("remote", [False, True])
def test_authorized_photo_responses_are_private_even_for_files_and_redirects(context, actor, remote):
    context.actor["user"] = context.patient_user if actor == "patient" else context.doctor_user
    if remote: context.storage.location = "https://synthetic.invalid/private-photo"
    metadata = context.client.get(f"/api/v1/triage/{context.session.id}/photos")
    assert metadata.status_code == 200
    assert metadata.headers["cache-control"] == "private, no-store"
    response = context.client.get(f"/api/v1/triage/{context.session.id}/photos/{context.photo.id}/content", follow_redirects=False)
    assert response.status_code == (307 if remote else 200)
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert context.signed == [context.photo.storage_key]
