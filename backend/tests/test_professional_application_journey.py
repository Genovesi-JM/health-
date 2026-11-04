"""Professional applications remain nonclinical until audited review and MFA."""
import asyncio

from datetime import date, datetime, timedelta
from fastapi import HTTPException
from uuid import uuid4

import pytest
from sqlalchemy import event

from app import database
from app.health_models import ClinicianCredential, Doctor, MfaCredential, Patient, PatientConsent, PrescriptionRequest, StandalonePrescription, VerificationTransition
from app.models import User
from app.oauth2 import create_access_token
from app.routers import credentials
from app.services.mfa import generate_secret, totp_now
from _authutil import login_with_mfa


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _applicant(client, profession="doctor"):
    response = client.post("/auth/register", json={
        "email": f"application-{uuid4().hex}@example.com", "password": "strong-pass",
        "full_name": "Synthetic Applicant", "sector_focus": "health", "role": profession,
        "practice_country": "AO", "licence_country": "AO", "issuing_authority": "Test Authority",
        "licence_number": f"TEST-{uuid4().hex}", "diploma_country": "AO",
        "diploma_institution": "Test University", "degree_title": "Test Degree",
    })
    assert response.status_code == 201, response.text
    assert response.json()["user"]["role"] == "patient"
    return response.json()


def _upload(client, auth, kind):
    response = client.post(f"/api/v1/credentials/me/evidence/{kind}", headers=_headers(auth),
                           files={"file": (f"{kind}.pdf", b"%PDF-1.4\nsynthetic", "application/pdf")})
    assert response.status_code == 200, response.text
    return response.json()


def _submit(client, auth):
    _upload(client, auth, "professional_card")
    _upload(client, auth, "diploma")
    response = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "pending_review"
    return response.json()


def _admin(client):
    return login_with_mfa(client, "teste@admin.com", "123456")


def _decision(client, case, admin, action="approve"):
    return client.post(f"/api/v1/credentials/admin/{case['id']}/decision", headers=_headers(admin),
                       json={"action": action, "notes": "Synthetic human review"})


def _profile_payload(case):
    return {key: case.get(key) for key in (
        "profession", "legal_name", "practice_country", "licence_country", "issuing_authority",
        "licence_number", "diploma_country", "diploma_institution", "degree_title",
    )}


@pytest.fixture
def temporary_licence_dates():
    # The suite shares committed records across tests. Keep dates introduced by
    # these scenarios from becoming unrelated input to later expiry scans.
    credential_ids = []
    yield credential_ids
    with database.SessionLocal() as cleanup:
        cleanup.query(ClinicianCredential).filter(ClinicianCredential.id.in_(credential_ids)).update(
            {ClinicianCredential.licence_expiry_date: None}, synchronize_session=False,
        )
        cleanup.commit()


@pytest.mark.parametrize("profession", ["doctor", "nurse"])
def test_public_application_review_mfa_and_clinical_access(client, db_session, profession):
    applicant = _applicant(client, profession)
    dashboard = f"/api/v1/{profession}/dashboard"
    headers = _headers(applicant)
    case = client.get("/api/v1/credentials/me", headers=headers)
    assert case.status_code == 200, case.text
    body = _profile_payload(case.json())
    body["legal_name"] = "Updated Synthetic Applicant"
    edited = client.put("/api/v1/credentials/me", headers=headers, json=body)
    assert edited.status_code == 200, edited.text
    assert edited.json()["legal_name"] == body["legal_name"]
    body["profession"] = "nurse" if profession == "doctor" else "doctor"
    assert client.put("/api/v1/credentials/me", headers=headers, json=body).status_code == 403
    case = _submit(client, applicant)
    assert client.get(dashboard, headers=headers).status_code == 403
    assert db_session.get(User, applicant["user"]["id"]).role == "patient"
    approved = _decision(client, case, _admin(client))
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "verified"
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == profession
    audit = db_session.query(VerificationTransition).filter_by(entity_id=case["id"], new_status="verified").one()
    assert audit.actor_kind == "user"
    assert audit.reason_code == "reviewer_approve"
    old_token = client.get(dashboard, headers={**headers, "Origin": "http://localhost:5173"})
    assert "x-kaya-error-code" in old_token.headers["Access-Control-Expose-Headers"].lower()
    assert old_token.status_code == 403, old_token.text
    assert old_token.headers["X-Kaya-Error-Code"] == "mfa_enrollment_required"
    professional = login_with_mfa(client, applicant["user"]["email"], "strong-pass")
    assert professional["mfa_enrolled"] is True
    assert client.get(dashboard, headers=_headers(professional)).status_code == 200
    assert client.post("/api/v1/credentials/me/submit", headers=_headers(professional)).status_code == 409


def test_applicant_cannot_read_another_applicants_evidence_or_approve(client):
    first, second = _applicant(client), _applicant(client)
    case = _upload(client, first, "professional_card")
    evidence_id = case["evidence"][0]["id"]
    assert client.get(f"/api/v1/credentials/evidence/{evidence_id}/download", headers=_headers(first)).status_code == 200
    assert client.get(f"/api/v1/credentials/evidence/{evidence_id}/download", headers=_headers(second)).status_code == 403
    assert _decision(client, case, first).status_code == 403


def test_review_requires_submission_evidence_and_never_accepts_support(client, db_session):
    applicant = _applicant(client)
    case = client.get("/api/v1/credentials/me", headers=_headers(applicant)).json()
    admin = _admin(client)
    assert _decision(client, case, admin).status_code == 409
    _upload(client, applicant, "professional_card")
    assert client.post("/api/v1/credentials/me/submit", headers=_headers(applicant)).status_code == 422
    assert _decision(client, case, admin).status_code == 409
    case = _submit(client, applicant)
    support = User(email=f"support-{uuid4().hex}@example.com", role="support", is_active=True)
    db_session.add(support)
    db_session.commit()
    token = create_access_token({"sub": support.email, "uid": support.id})
    assert _decision(client, case, {"access_token": token}).status_code == 403
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "patient"


def test_failed_audit_rolls_back_role_and_verification(client, db_session):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)

    def fail_audit(mapper, connection, target):
        raise RuntimeError("synthetic application audit failure")

    event.listen(VerificationTransition, "before_insert", fail_audit)
    try:
        with pytest.raises(RuntimeError, match="synthetic application audit failure"):
            _decision(client, case, admin)
    finally:
        event.remove(VerificationTransition, "before_insert", fail_audit)
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "patient"
    assert db_session.get(ClinicianCredential, case["id"]).status == "pending_review"
    assert db_session.query(Doctor).filter_by(user_id=applicant["user"]["id"]).one().verification_status == "draft"


def test_stale_review_cannot_approve_changed_application(client, db_session, monkeypatch):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    from app.services import credential_review
    original_checks = credential_review.application_checks

    def concurrent_revision(credential):
        result = original_checks(credential)
        with database.SessionLocal() as another:
            latest = another.get(ClinicianCredential, credential.id)
            latest.updated_at = latest.updated_at + timedelta(seconds=1)
            latest.legal_name = "Changed after review opened"
            another.commit()
        return result

    monkeypatch.setattr(credential_review, "application_checks", concurrent_revision)
    response = _decision(client, case, admin)
    assert response.status_code == 409, response.text
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "patient"
    assert db_session.get(ClinicianCredential, case["id"]).status == "pending_review"


@pytest.mark.parametrize("status,expiry", [
    ("revoked", None), ("suspended", None), ("expired", None),
    ("verified", "2000-01-01"), ("verified", date.today().isoformat()), ("verified", "invalid"),
])
def test_stale_verified_doctor_profile_cannot_bypass_current_credential(client, db_session, status, expiry, temporary_licence_dates):
    # Provision a synthetic established clinician so each check uses a real MFA
    # session and tests the live dossier independently of the cached Doctor flag.
    user = User(email=f"withdrawn-{uuid4().hex}@example.com", role="doctor", is_active=True)
    db_session.add(user)
    db_session.flush()
    db_session.add_all([
        Doctor(user_id=user.id, license_number="TEST", specialization="clinica_geral", verification_status="verified"),
        ClinicianCredential(user_id=user.id, profession="doctor", legal_name="Test", practice_country="AO",
                            licence_country="AO", issuing_authority="Test", licence_number="TEST",
                            diploma_country="AO", diploma_institution="Test", degree_title="Test",
                            status=status, licence_expiry_date=expiry),
        MfaCredential(user_id=user.id, secret=generate_secret(), enabled=True),
    ])
    db_session.commit()
    temporary_licence_dates.append(db_session.query(ClinicianCredential).filter_by(user_id=user.id).one().id)
    headers = {"Authorization": "Bearer " + create_access_token({"uid": user.id, "sub": user.email, "role": "doctor", "mfa_verified": True})}
    for route in ("/api/v1/doctor/queue", "/api/v1/doctor/dashboard", "/api/v1/doctors/me/availability",
                  "/api/v1/clinical-operations/integrations/pem/status",
                  "/api/v1/doctor/prescription-requests"):
        response = client.get(route, headers=headers)
        assert response.status_code == 403, (route, response.text)
    # Unknown ids are not a useful authorization probe; test the shared video
    # guard directly without needing unrelated consultation setup.
    from app.routers.teleconsultation import _clinician_verified
    assert _clinician_verified(user, db_session) is False
    # Patient-directed booking must apply the same live credential check.
    patient, doctor = _assert_booking_rejected(client, db_session, user)
    renewal = PrescriptionRequest(patient_id=patient.id, doctor_id=doctor.id,
                                  medication_name="Synthetic test medication", status="pending")
    db_session.add(renewal)
    db_session.commit()
    decision = client.post(f"/api/v1/doctor/prescription-requests/{renewal.id}/decide",
                           headers=headers, json={"action": "approve", "expected_revision": 0})
    assert decision.status_code == 403, decision.text
    db_session.refresh(renewal)
    assert renewal.status == "pending"
    assert db_session.query(StandalonePrescription).filter_by(prescription_request_id=renewal.id).count() == 0


def test_revocation_cannot_be_cleared_by_resubmitting_application(client, db_session):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    assert _decision(client, case, admin).status_code == 200
    professional = login_with_mfa(client, applicant["user"]["email"], "strong-pass")
    assert _decision(client, case, admin, "revoke").status_code == 200
    headers = _headers(professional)
    assert client.post("/api/v1/credentials/me/submit", headers=headers).status_code == 409
    assert client.put("/api/v1/credentials/me", headers=headers, json=_profile_payload(case)).status_code == 409
    assert client.get("/api/v1/doctor/queue", headers=headers).status_code == 403
    assert _decision(client, case, admin).status_code == 409



def test_optional_mfa_applicant_session_cannot_gain_new_role_without_login(client):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    setup = client.post("/auth/mfa/setup", headers=_headers(applicant))
    assert setup.status_code == 200, setup.text
    verified = client.post("/auth/mfa/verify", headers=_headers(applicant),
                           json={"code": totp_now(setup.json()["secret"])})
    assert verified.status_code == 200, verified.text
    old_session = login_with_mfa(client, applicant["user"]["email"], "strong-pass")
    assert old_session["user"]["role"] == "patient"
    assert old_session["mfa_enrolled"] is True
    assert _decision(client, case, _admin(client)).status_code == 200
    for route in ("/auth/me", "/api/v1/doctor/dashboard"):
        rejected = client.get(route, headers=_headers(old_session))
        assert rejected.status_code == 401, rejected.text
        assert rejected.headers["X-Kaya-Error-Code"] == "session_role_changed"
    current_session = login_with_mfa(client, applicant["user"]["email"], "strong-pass")
    assert current_session["user"]["role"] == "doctor"
    assert client.get("/api/v1/doctor/dashboard", headers=_headers(current_session)).status_code == 200


def test_provider_completion_never_grants_professional_role(client, db_session, monkeypatch):
    applicant = _applicant(client)
    _upload(client, applicant, "professional_card")

    def complete_synthetic_check(check, credential):
        check.status = "completed"
        check.result_json = '{"synthetic": true}'

    monkeypatch.setattr(credentials, "start_persona", complete_synthetic_check)
    response = client.post("/api/v1/credentials/me/providers/start", headers=_headers(applicant),
                           json={"consent": True, "providers": ["persona"]})
    assert response.status_code == 200, response.text
    assert response.json()["provider_checks"][0]["status"] == "completed"
    assert response.json()["status"] == "draft"
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "patient"
    assert client.get("/api/v1/doctor/dashboard", headers=_headers(applicant)).status_code == 403


def test_compliance_reviewer_can_read_evidence_and_approve(client, db_session):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    reviewer = User(email=f"reviewer-{uuid4().hex}@example.com", role="compliance_reviewer", is_active=True)
    db_session.add(reviewer)
    db_session.flush()
    db_session.add(MfaCredential(user_id=reviewer.id, secret=generate_secret(), enabled=True))
    db_session.commit()
    auth = {"access_token": create_access_token({"uid": reviewer.id, "sub": reviewer.email,
                                                "role": "compliance_reviewer", "mfa_verified": True})}
    assert client.get(f"/api/v1/credentials/admin/{case['id']}", headers=_headers(auth)).status_code == 200
    evidence_id = case["evidence"][0]["id"]
    assert client.get(f"/api/v1/credentials/evidence/{evidence_id}/download", headers=_headers(auth)).status_code == 200
    response = _decision(client, case, auth)
    assert response.status_code == 200, response.text
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "doctor"



def _assert_booking_rejected(client, db_session, doctor_user):
    patient_user = User(email=f"booking-{uuid4().hex}@example.com", role="patient", is_active=True)
    db_session.add(patient_user)
    db_session.flush()
    patient = Patient(user_id=patient_user.id)
    db_session.add(patient)
    db_session.flush()
    from consent_fixtures import grant_all
    grant_all(db_session, patient)
    db_session.commit()
    doctor = db_session.query(Doctor).filter_by(user_id=doctor_user.id).one()
    token = create_access_token({"uid": patient_user.id, "sub": patient_user.email, "role": "patient"})
    response = client.post("/api/v1/consultations/book", headers={"Authorization": f"Bearer {token}"}, json={
        "doctor_id": doctor.id, "specialty": "clinica_geral", "country": "AO",
        "scheduled_at": (date.today() + timedelta(days=2)).isoformat() + "T10:00:00Z",
    })
    assert response.status_code == 400, response.text
    return patient, doctor


def test_disabled_doctor_cannot_receive_directed_booking(client, db_session):
    user = User(email=f"inactive-{uuid4().hex}@example.com", role="doctor", is_active=False)
    db_session.add(user)
    db_session.flush()
    db_session.add_all([
        Doctor(user_id=user.id, license_number="TEST", specialization="clinica_geral", verification_status="verified"),
        ClinicianCredential(user_id=user.id, profession="doctor", legal_name="Test", practice_country="AO",
                            licence_country="AO", issuing_authority="Test", licence_number="TEST",
                            diploma_country="AO", diploma_institution="Test", degree_title="Test", status="verified"),
    ])
    db_session.commit()
    _assert_booking_rejected(client, db_session, user)



def test_manual_registry_completion_still_needs_final_human_role_grant(client, db_session):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    completed = client.post(f"/api/v1/compliance/cases/{case['id']}/manual-review-complete",
                            headers=_headers(admin), json={"outcome": "verified"})
    assert completed.status_code == 200, completed.text
    assert completed.json()["new_status"] == "completed"
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "patient"
    assert client.get("/api/v1/doctor/dashboard", headers=_headers(applicant)).status_code == 403
    approved = _decision(client, case, admin)
    assert approved.status_code == 200, approved.text
    db_session.expire_all()
    assert db_session.get(User, applicant["user"]["id"]).role == "doctor"


def test_expired_application_requires_reviewed_reopening_and_renewal(client, db_session, temporary_licence_dates):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    temporary_licence_dates.append(case["id"])
    admin = _admin(client)
    assert _decision(client, case, admin).status_code == 200
    professional = login_with_mfa(client, applicant["user"]["email"], "strong-pass")
    credential = db_session.get(ClinicianCredential, case["id"])
    credential.status = "expired"
    credential.licence_expiry_date = "2000-01-01"
    db_session.commit()
    headers = _headers(professional)
    assert client.get("/api/v1/doctor/dashboard", headers=headers).status_code == 403
    assert client.put("/api/v1/credentials/me", headers=headers, json=_profile_payload(case)).status_code == 409
    assert client.post("/api/v1/credentials/me/submit", headers=headers).status_code == 409
    blocked_upload = client.post("/api/v1/credentials/me/evidence/professional_card", headers=headers,
                                files={"file": ("renewal.pdf", b"%PDF-1.4\nsynthetic", "application/pdf")})
    assert blocked_upload.status_code == 409

    reopened = client.post(f"/api/v1/compliance/cases/{case['id']}/request-information",
                           headers=_headers(admin), json={"reason_text": "Envie a nova cédula profissional."})
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["new_status"] == "action_required"
    renewal = {**_profile_payload(case), "licence_expiry_date": (date.today() + timedelta(days=365)).isoformat()}
    edited = client.put("/api/v1/credentials/me", headers=headers, json=renewal)
    assert edited.status_code == 200, edited.text
    case = _submit(client, professional)
    assert client.get("/api/v1/doctor/dashboard", headers=headers).status_code == 403
    approved = _decision(client, case, admin)
    assert approved.status_code == 200, approved.text
    assert client.get("/api/v1/doctor/dashboard", headers=headers).status_code == 200



def _review_in_another_session(case, admin, revoke=False):
    from app.credential_schemas import CredentialDecision
    with database.SessionLocal() as reviewer_session:
        reviewer = reviewer_session.get(User, admin["user"]["id"])
        credentials.decide_credential(case["id"], CredentialDecision(action="approve"),
                                      reviewer=reviewer, db=reviewer_session)
        if revoke:
            credentials.decide_credential(case["id"], CredentialDecision(action="revoke", notes="Synthetic revocation"),
                                          reviewer=reviewer, db=reviewer_session)


@pytest.mark.parametrize("writer", ["edit", "submit"])
@pytest.mark.parametrize("revoke", [False, True])
def test_stale_applicant_writes_cannot_overwrite_review(client, db_session, writer, revoke):
    from app.credential_schemas import CredentialUpsert
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    with database.SessionLocal() as stale_session:
        applicant_user = stale_session.get(User, applicant["user"]["id"])
        stale = credentials._owned_application(stale_session, applicant_user)
        assert stale.status == "pending_review"
        _review_in_another_session(case, admin, revoke)
        with pytest.raises(HTTPException) as conflict:
            if writer == "edit":
                body = _profile_payload(case)
                body["legal_name"] = "Stale edit must not persist"
                credentials.upsert_my_credential(CredentialUpsert(**body), user=applicant_user, db=stale_session)
            else:
                credentials.submit_my_credential(user=applicant_user, db=stale_session)
        assert conflict.value.status_code == 409
    db_session.expire_all()
    current = db_session.get(ClinicianCredential, case["id"])
    assert current.status == ("revoked" if revoke else "verified")
    assert current.legal_name != "Stale edit must not persist"


@pytest.mark.parametrize("revoke", [False, True])
def test_upload_keeps_original_revision_across_read_and_cleans_conflicting_blob(client, db_session, monkeypatch, revoke):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    original_evidence = {item["id"] for item in case["evidence"]}
    deleted_keys = []

    class ConcurrentUpload:
        filename = "replacement.pdf"
        content_type = "application/pdf"

        async def read(self, size):
            _review_in_another_session(case, admin, revoke)
            return b"%PDF-1.4\nstale-replacement"

    class SyntheticStorage:
        def upload_bytes(self, *args):
            return "new-conflicting-blob", None

        def delete(self, key):
            deleted_keys.append(key)

    monkeypatch.setattr(credentials, "get_health_storage", lambda: SyntheticStorage())
    with database.SessionLocal() as stale_session:
        applicant_user = stale_session.get(User, applicant["user"]["id"])
        with pytest.raises(HTTPException) as conflict:
            asyncio.run(credentials.upload_evidence("professional_card", file=ConcurrentUpload(),
                                                     user=applicant_user, db=stale_session))
        assert conflict.value.status_code == 409
    assert deleted_keys == ["new-conflicting-blob"]
    db_session.expire_all()
    current = db_session.get(ClinicianCredential, case["id"])
    assert current.status == ("revoked" if revoke else "verified")
    assert {item.id for item in current.evidence} == original_evidence


def test_stale_compliance_reviewer_cannot_overwrite_other_review(client, db_session):
    from app.routers.compliance_review import _apply_transition
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    assert _decision(client, case, admin).status_code == 200
    with database.SessionLocal() as first, database.SessionLocal() as second:
        first_case = first.get(ClinicianCredential, case["id"])
        stale_case = second.get(ClinicianCredential, case["id"])
        first_reviewer = first.get(User, admin["user"]["id"])
        second_reviewer = second.get(User, admin["user"]["id"])
        _apply_transition(first, first_case, "suspended", first_reviewer, "test_suspend", "Test", None)
        with pytest.raises(HTTPException) as conflict:
            _apply_transition(second, stale_case, "revoked", second_reviewer, "test_stale_revoke", "Test", None)
        assert conflict.value.status_code == 409
    db_session.expire_all()
    assert db_session.get(ClinicianCredential, case["id"]).status == "suspended"
    assert not db_session.query(VerificationTransition).filter_by(entity_id=case["id"], reason_code="test_stale_revoke").first()


def test_legacy_doctor_decision_denies_support_and_preserves_revocation(client, db_session):
    applicant = _applicant(client)
    case = _submit(client, applicant)
    admin = _admin(client)
    doctor = db_session.query(Doctor).filter_by(user_id=applicant["user"]["id"]).one()
    support = User(email=f"legacy-support-{uuid4().hex}@example.com", role="support", is_active=True)
    db_session.add(support)
    db_session.commit()
    auth = {"access_token": create_access_token({"uid": support.id, "sub": support.email, "role": "support"})}
    url = f"/api/v1/doctors/{doctor.id}/verify"
    denied = client.post(url, headers=_headers(auth), json={"action": "approve"})
    assert denied.status_code == 403, denied.text
    assert _decision(client, case, admin).status_code == 200
    assert _decision(client, case, admin, "revoke").status_code == 200
    for action in ("approve", "reject", "suspend"):
        denied = client.post(url, headers=_headers(admin), json={"action": action, "reason": "Cannot reopen terminal case"})
        assert denied.status_code == 409, denied.text
    db_session.expire_all()
    assert db_session.get(ClinicianCredential, case["id"]).status == "revoked"
    db_session.refresh(doctor)
    assert doctor.verification_status == "revoked"


@pytest.fixture
def isolated_credential_case(tmp_path):
    """Two real SQLite connections without unrelated suite records or providers."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    isolated_engine = create_engine(f"sqlite:///{tmp_path / 'credential-races.db'}")
    database.Base.metadata.create_all(isolated_engine)
    sessions = sessionmaker(bind=isolated_engine)
    with sessions() as db:
        applicant = User(email="isolated-doctor@example.com", role="doctor", is_active=True)
        reviewer = User(email="isolated-reviewer@example.com", role="admin", is_active=True)
        db.add_all([applicant, reviewer])
        db.flush()
        credential = ClinicianCredential(
            user_id=applicant.id, profession="doctor", legal_name="Synthetic Doctor",
            practice_country="AO", licence_country="AO", issuing_authority="Test Authority",
            licence_number="TEST", diploma_country="AO", diploma_institution="Test University",
            degree_title="Test Degree", status="verified", licence_expiry_date="2000-01-01",
        )
        db.add_all([credential, Doctor(user_id=applicant.id, license_number="TEST", verification_status="verified")])
        db.flush()
        db.add(VerificationTransition(entity_type="clinician_credential", entity_id=credential.id,
                                      previous_status="pending_review", new_status="verified",
                                      actor_user_id=reviewer.id, evidence_ref="synthetic-provider-reference"))
        db.commit()
        ids = credential.id, reviewer.id
    yield sessions, *ids
    isolated_engine.dispose()


def _isolated_revoke(sessions, credential_id, reviewer_id):
    from app.routers.compliance_review import _apply_transition
    with sessions() as db:
        _apply_transition(db, db.get(ClinicianCredential, credential_id), "revoked",
                          db.get(User, reviewer_id), "concurrent_revocation", "Synthetic revocation", None)


def test_expiry_scan_cannot_overwrite_concurrent_revocation(isolated_credential_case, monkeypatch):
    from app.services import document_expiry
    sessions, credential_id, reviewer_id = isolated_credential_case
    original_mutation = document_expiry.mutate_credential

    def revoke_before_expiry_update(db, credential, **kwargs):
        _isolated_revoke(sessions, credential_id, reviewer_id)
        return original_mutation(db, credential, **kwargs)

    monkeypatch.setattr(document_expiry, "mutate_credential", revoke_before_expiry_update)
    with sessions() as scan, pytest.raises(HTTPException) as conflict:
        # No reminders are needed to exercise the competing status writers.
        document_expiry.scan_credentials(scan, thresholds=())
    assert conflict.value.status_code == 409
    with sessions() as check:
        assert check.get(ClinicianCredential, credential_id).status == "revoked"
        assert not check.query(VerificationTransition).filter_by(entity_id=credential_id, new_status="expired").first()


def test_stale_webhook_cannot_overwrite_reviewers_revocation(isolated_credential_case):
    from app.health_models import VerificationWebhookEvent
    from app.routers.verification_webhooks import _process
    from app.services.verification.base import VerificationResult, VerificationStatus
    sessions, credential_id, reviewer_id = isolated_credential_case
    with sessions() as webhook:
        stale_case = webhook.get(ClinicianCredential, credential_id)
        assert stale_case.status == "verified"
        _isolated_revoke(sessions, credential_id, reviewer_id)
        result = VerificationResult(status=VerificationStatus.COMPLETED, provider="sumsub",
                                    provider_reference="synthetic-provider-reference")
        with pytest.raises(HTTPException) as conflict:
            _process("sumsub", True, {"id": "synthetic-race-event"}, result, {}, webhook)
        assert conflict.value.status_code == 409
    with sessions() as check:
        assert check.get(ClinicianCredential, credential_id).status == "revoked"
        assert not check.query(VerificationTransition).filter_by(entity_id=credential_id, actor_kind="webhook").first()
        # A conflicting delivery can retry; it is not incorrectly marked applied.
        assert not check.query(VerificationWebhookEvent).filter_by(event_id="synthetic-race-event").first()
