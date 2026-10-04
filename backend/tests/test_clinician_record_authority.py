"""Existing bearer sessions must lose record access when clinical authority ends."""
from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.health_models import (
    ClinicianCredential, Consultation, ConsultationMessage, DeviceReading, Doctor,
    MfaCredential, Patient, PatientMedication, Prescription, Referral,
)
from app.models import User
from app.oauth2 import create_access_token


def _headers(user, *, mfa_verified=False):
    token = create_access_token({
        "sub": user.email, "uid": user.id, "role": user.role,
        "mfa_verified": mfa_verified,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def records(db_session, monkeypatch):
    """Synthetic rows; requests still use the real authentication dependencies."""
    doctor_user = User(email=f"record-doctor-{uuid4().hex}@example.com", role="doctor", password_hash="unused", is_active=True)
    patient_user = User(email=f"record-patient-{uuid4().hex}@example.com", role="patient", password_hash="unused", is_active=True)
    db_session.add_all([doctor_user, patient_user])
    db_session.flush()
    credential = ClinicianCredential(
        user_id=doctor_user.id, profession="doctor", legal_name="Synthetic Doctor",
        practice_country="AO", licence_country="AO", issuing_authority="Synthetic Registry",
        licence_number="TEST-ONLY", licence_expiry_date=(date.today() + timedelta(days=30)).isoformat(),
        diploma_country="AO", diploma_institution="Synthetic University", degree_title="Medicine",
        status="verified",
    )
    doctor = Doctor(user_id=doctor_user.id, verification_status="verified")
    patient = Patient(user_id=patient_user.id)
    db_session.add_all([
        credential, doctor, patient,
        MfaCredential(user_id=doctor_user.id, secret="JBSWY3DPEHPK3PXP", enabled=True),
    ])
    db_session.flush()
    consultation = Consultation(patient_id=patient.id, doctor_id=doctor.id, status="completed")
    db_session.add(consultation)
    db_session.flush()
    message = ConsultationMessage(
        consultation_id=consultation.id, sender_role="patient", sender_user_id=patient_user.id,
        body="Synthetic patient message",
    )
    medication = PatientMedication(patient_id=patient.id, medication_name="Synthetic medication")
    reading = DeviceReading(patient_id=patient.id, reading_type="weight", value=70, unit="kg")
    prescription = Prescription(consultation_id=consultation.id, file_storage_key=f"synthetic/{uuid4().hex}.pdf")
    referral = Referral(consultation_id=consultation.id, destination="Synthetic clinic", file_storage_key=f"synthetic/{uuid4().hex}.pdf")
    db_session.add_all([message, medication, reading, prescription, referral])
    db_session.commit()
    signed_keys = []

    class SyntheticStorage:
        def get_signed_url(self, key):
            signed_keys.append(key)
            return f"https://synthetic.invalid/{key}"

        def get_signed_url_expiry_seconds(self):
            return 60

    monkeypatch.setattr("app.routers.prescriptions.get_health_storage", lambda: SyntheticStorage())
    credential_id = credential.id
    yield {
        "doctor_user": doctor_user, "patient_user": patient_user,
        "doctor": doctor, "credential": credential, "patient": patient,
        "consultation": consultation, "message": message,
        "medication": medication, "reading": reading,
        "prescription": prescription, "referral": referral,
        "doctor_headers": _headers(doctor_user, mfa_verified=True),
        "patient_headers": _headers(patient_user), "signed_keys": signed_keys,
    }
    # The shared test database outlives each request scenario. Do not leave
    # expiry candidates for the independent global-scanner regression suite.
    db_session.rollback()
    db_session.query(ClinicianCredential).filter_by(id=credential_id).update(
        {"licence_expiry_date": None}, synchronize_session=False,
    )
    db_session.commit()


def _clinical_requests(records):
    return [
        ("GET", f"/api/v1/consultations/{records['consultation'].id}/messages", None),
        ("POST", f"/api/v1/consultations/{records['consultation'].id}/messages", {"body": "Synthetic response"}),
        ("GET", "/api/v1/doctor/message-threads", None),
        ("GET", f"/api/v1/medications/patient/{records['patient'].id}", None),
        ("GET", f"/api/v1/readings/patient/{records['patient'].id}", None),
        ("GET", f"/api/v1/files/{records['prescription'].id}", None),
        ("GET", f"/api/v1/files/{records['referral'].id}", None),
    ]


@pytest.mark.parametrize("authority", [
    "revoked", "suspended", "expired", "licence_elapsed", "doctor_suspended", "missing_dossier",
])
def test_existing_mfa_session_loses_all_clinical_record_routes(client, db_session, records, authority):
    # The bearer was issued while verified; withdrawal must be evaluated afresh.
    if authority == "licence_elapsed":
        records["credential"].licence_expiry_date = (date.today() - timedelta(days=1)).isoformat()
    elif authority == "doctor_suspended":
        records["doctor"].verification_status = "suspended"
    elif authority == "missing_dossier":
        db_session.delete(records["credential"])
    else:
        records["credential"].status = authority
    db_session.commit()

    for method, path, body in _clinical_requests(records):
        response = client.request(method, path, headers=records["doctor_headers"], json=body)
        assert response.status_code == 403, (method, path, response.text)
        assert response.json()["detail"]["code"] == "credential_verification_required"
    db_session.refresh(records["message"])
    assert records["message"].read_at is None
    assert db_session.query(ConsultationMessage).filter_by(consultation_id=records["consultation"].id).count() == 1
    assert records["signed_keys"] == []


def test_current_assigned_clinician_can_use_all_record_routes(client, records):
    responses = []
    for method, path, body in _clinical_requests(records):
        response = client.request(method, path, headers=records["doctor_headers"], json=body)
        assert response.status_code == (201 if method == "POST" else 200), (path, response.text)
        responses.append(response.json())
    assert responses[0][0]["id"] == records["message"].id
    assert responses[1]["sender_role"] == "doctor"
    assert responses[2][0]["consultation_id"] == records["consultation"].id
    assert responses[3][0]["id"] == records["medication"].id
    assert responses[4]["readings"][0]["id"] == records["reading"].id
    assert len(records["signed_keys"]) == 2


def test_current_authority_does_not_replace_patient_relationship(client, db_session, records):
    records["consultation"].doctor_id = None
    db_session.commit()
    for method, path, body in _clinical_requests(records):
        response = client.request(method, path, headers=records["doctor_headers"], json=body)
        if path == "/api/v1/doctor/message-threads":
            assert response.status_code == 200
            assert response.json() == []
        else:
            assert response.status_code == 403, (method, path, response.text)
    assert records["signed_keys"] == []


def test_patient_keeps_own_records_when_assigned_doctor_is_revoked(client, db_session, records):
    records["credential"].status = "revoked"
    db_session.commit()
    paths = [
        f"/api/v1/consultations/{records['consultation'].id}/messages",
        "/api/v1/patient/message-threads", "/api/v1/medications/me", "/api/v1/readings/me",
        f"/api/v1/files/{records['prescription'].id}", f"/api/v1/files/{records['referral'].id}",
    ]
    for path in paths:
        response = client.get(path, headers=records["patient_headers"])
        assert response.status_code == 200, (path, response.text)
    sent = client.post(paths[0], headers=records["patient_headers"], json={"body": "Synthetic follow-up"})
    assert sent.status_code == 201
    assert sent.json()["sender_role"] == "patient"


def test_unrelated_patient_cannot_read_or_send_records(client, db_session, records):
    outsider = User(email=f"record-outsider-{uuid4().hex}@example.com", role="patient", password_hash="unused", is_active=True)
    db_session.add(outsider)
    db_session.flush()
    db_session.add(Patient(user_id=outsider.id))
    db_session.commit()
    headers = _headers(outsider)
    for method, path, body in _clinical_requests(records):
        response = client.request(method, path, headers=headers, json=body)
        assert response.status_code == 403, (method, path, response.text)
    assert records["signed_keys"] == []


def test_applicant_with_assigned_doctor_row_cannot_use_doctor_messaging(client, db_session, records):
    records["doctor_user"].role = "patient"
    records["credential"].status = "draft"
    db_session.commit()
    headers = _headers(records["doctor_user"], mfa_verified=True)
    for method, path, body in _clinical_requests(records)[:3]:
        response = client.request(method, path, headers=headers, json=body)
        assert response.status_code == 403, (method, path, response.text)


def test_record_routes_still_require_mfa_for_current_clinicians(client, records):
    headers = _headers(records["doctor_user"])
    for method, path, body in _clinical_requests(records):
        response = client.request(method, path, headers=headers, json=body)
        assert response.status_code == 401, (method, path, response.text)
        assert response.headers["X-Kaya-Error-Code"] == "mfa_verification_required"
