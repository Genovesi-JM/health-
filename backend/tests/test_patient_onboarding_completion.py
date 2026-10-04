"""Patient wizard completion against isolated synthetic accounts and storage."""
import json
from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.health_models import HealthAuditLog, OnboardingDraft, Patient, PatientConsentEvent, ConsentCatalogDocument
from app.models import User, UserProfile
from app.oauth2 import create_access_token
from app.services.patient_onboarding import CONSENT_FIELDS, CONSENT_VERSION


def patient_payload(email, country="AO", *, db):
    from consent_fixtures import references
    accepted = references(db, country)
    return {
        "1": {"language": "pt", "channel": "email"},
        "2": {"email": email, "phone": "+244 900 000 111"},
        "3": {"full_name": " Ana Teste ", "dob": "1990-05-20", "sex": "female", "preferred_name": "Ana"},
        "4": {"country": country, "city": "Luanda" if country == "AO" else "Porto"},
        "5": {"blood_type": "O+", "allergies": "penicilina, marisco", "chronic": "hipertensão",
              "medications": "Reported medication text", "surgeries": "Reported surgery text"},
        "6": {"ec_name": "Pessoa de Teste", "ec_phone": "+244900000222", "ec_consent": True},
        "7": {"catalog_country": country, "catalog_language": "pt", "consent_expected_revision": 0, "consent_acceptances": accepted},
        "8": {},
    }


@pytest.fixture
def account(db_session):
    user = User(email=f"onboarding-{uuid4().hex}@example.com", role="patient", password_hash="unused", is_active=True)
    db_session.add(user)
    db_session.commit()
    return {
        "id": user.id, "email": user.email,
        "headers": {"Authorization": f"Bearer {create_access_token({'sub': user.email, 'uid': user.id})}"},
    }


def seed_draft(db, account, payload=None, *, role="patient", status="draft"):
    total_steps = 8 if role == "patient" else 17
    draft = OnboardingDraft(
        user_id=account["id"], role=role, total_steps=total_steps, current_step=total_steps,
        status=status, submitted_at=datetime.utcnow() if status == "submitted" else None,
        data_json=json.dumps(payload if payload is not None else patient_payload(account["email"], db=db)),
        completed_steps_json=json.dumps(list(range(1, total_steps + 1))),
    )
    db.add(draft)
    db.commit()
    return draft


def completion_audits(db, draft):
    return db.query(HealthAuditLog).filter_by(
        action="patient_onboarding_completed", resource_type="onboarding_draft", resource_id=draft.id,
    ).all()


@pytest.mark.parametrize("country", ["AO", "PT"])
def test_submit_materializes_patient_profile_and_five_versioned_consents(client, account, db_session, country):
    draft = seed_draft(db_session, account, patient_payload(account["email"], country, db=db_session))
    assert client.get("/auth/me", headers=account["headers"]).json()["patient_onboarding_complete"] is False
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 200, response.text
    assert response.json()["completion_status"] == "complete"
    db_session.expire_all()
    patient = db_session.query(Patient).filter_by(user_id=account["id"]).one()
    profile = db_session.get(UserProfile, account["id"])
    assert profile.full_name == "Ana Teste"
    assert profile.country == country
    assert profile.phone == "+244900000111"
    assert patient.date_of_birth == "1990-05-20"
    assert patient.gender == "female"
    assert patient.blood_type == "O+"
    assert json.loads(patient.allergies_json) == ["penicilina", "marisco"]
    assert json.loads(patient.chronic_conditions_json) == ["hipertensão"]
    assert patient.emergency_contact_phone == "+244900000222"
    grants = db_session.query(PatientConsentEvent).filter_by(patient_id=patient.id).all()
    assert {db_session.get(ConsentCatalogDocument, item.document_id).purpose for item in grants} == set(CONSENT_FIELDS.values())
    assert len(grants) == 5
    audit, = completion_audits(db_session, draft)
    evidence = json.loads(audit.metadata_json)
    assert evidence["consent_version"] == CONSENT_VERSION
    assert evidence["service_country"] == country
    assert evidence["language"] == "pt"
    assert evidence["consent_grants"] == {db_session.get(ConsentCatalogDocument, grant.document_id).purpose: grant.id for grant in grants}
    assert evidence["consent_choices"]["c_marketing"] is False
    assert evidence["contact_verification"] == "not_performed"
    assert "Reported medication" not in audit.metadata_json
    assert client.get("/auth/me", headers=account["headers"]).json()["patient_onboarding_complete"] is True
    assert client.get("/api/v1/patients/me", headers=account["headers"]).json()["date_of_birth"] == "1990-05-20"
    assert len(client.get("/api/v1/compliance/consent-history/page", headers=account["headers"]).json()["items"]) == 5


def test_retry_preserves_ids_and_does_not_reapply_old_profile_answers(client, account, db_session):
    draft = seed_draft(db_session, account)
    first = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert first.status_code == 200
    db_session.expire_all()
    profile = db_session.get(UserProfile, account["id"])
    profile.full_name = "New name from settings"
    db_session.commit()
    second = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert second.status_code == 200
    assert second.json() == first.json()
    db_session.expire_all()
    assert profile.full_name == "New name from settings"
    patient = db_session.query(Patient).filter_by(user_id=account["id"]).one()
    assert db_session.query(PatientConsentEvent).filter_by(patient_id=patient.id).count() == 5
    assert len(completion_audits(db_session, draft)) == 1
    assert client.post("/api/v1/onboarding/start", headers=account["headers"], json={"role": "patient"}).json()["completion_status"] == "complete"
    assert client.post("/api/v1/onboarding/start", headers=account["headers"], json={"role": "patient", "reset": True}).status_code == 409


@pytest.mark.parametrize("field", list(CONSENT_FIELDS))
def test_each_required_consent_is_required_even_when_all_steps_are_complete(client, account, db_session, field):
    payload = patient_payload(account["email"], db=db_session)
    index = list(CONSENT_FIELDS).index(field)
    del payload["7"]["consent_acceptances"][index]
    draft = seed_draft(db_session, account, payload)
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 422, response.text
    assert "7.consent_acceptances" in response.json()["detail"]["fields"]
    db_session.expire_all()
    assert draft.status == "draft"
    assert db_session.query(Patient).filter_by(user_id=account["id"]).count() == 0
    assert completion_audits(db_session, draft) == []


@pytest.mark.parametrize("step,field,value", [
    ("7", "consent_acceptances", False), ("7", "consent_acceptances", 1), ("7", "consent_acceptances", "true"),
    ("7", "consent_acceptances", []), ("7", "consent_acceptances", None), ("7", "consent_acceptances", {"accepted": True}),
    ("7", "consent_expected_revision", None), ("7", "consent_expected_revision", "old-version"),
    ("7", "consent_expected_revision", True), ("6", "ec_consent", "true"),
    ("3", "full_name", "  "), ("3", "full_name", {"name": "Ana"}),
    ("3", "dob", "1990-02-30"), ("3", "dob", "19900520"),
    ("3", "dob", (date.today() + timedelta(days=2)).isoformat()),
    ("4", "country", "ES"), ("4", "country", "ao"), ("4", "country", "Angola"),
    ("2", "email", "different@example.com"), ("2", "phone", "900000111"),
    ("5", "allergies", ["penicilina"]), ("6", "ec_phone", "not-a-phone"),
])
def test_invalid_patient_values_never_create_domain_records(client, account, db_session, step, field, value):
    payload = patient_payload(account["email"], db=db_session)
    payload[step][field] = value
    draft = seed_draft(db_session, account, payload)
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 422, response.text
    assert f"{step}.{field}" in response.json()["detail"]["fields"]
    db_session.expire_all()
    assert draft.status == "draft"
    assert db_session.query(Patient).filter_by(user_id=account["id"]).count() == 0
    assert db_session.get(UserProfile, account["id"]) is None


def test_missing_or_malformed_step_cannot_freeze_patient_draft(client, account, db_session):
    payload = patient_payload(account["email"], db=db_session)
    payload["3"] = ["not-an-object"]
    draft = seed_draft(db_session, account, payload)
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 422
    assert "3" in response.json()["detail"]["fields"]
    db_session.refresh(draft)
    assert draft.status == "draft"


def test_existing_phone_requires_security_flow_but_blank_preserves_it(client, account, db_session):
    profile = UserProfile(user_id=account["id"], full_name="Original", phone="+351910000001")
    db_session.add(profile)
    draft = seed_draft(db_session, account)
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 422
    assert "2.phone" in response.json()["detail"]["fields"]
    db_session.refresh(profile)
    assert profile.full_name == "Original"
    assert profile.phone == "+351910000001"
    payload = patient_payload(account["email"], db=db_session)
    payload["2"]["phone"] = ""
    payload["2"]["email"] = account["email"].upper()
    draft.data_json = json.dumps(payload)
    db_session.commit()
    assert client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"]).status_code == 200
    db_session.refresh(profile)
    assert profile.phone == "+351910000001"
    assert db_session.get(User, account["id"]).email == account["email"]


def test_empty_optional_health_step_preserves_existing_domain_values(client, account, db_session):
    patient = Patient(user_id=account["id"], blood_type="A+", allergies_json='["existing"]')
    db_session.add(patient)
    payload = patient_payload(account["email"], db=db_session)
    payload["5"] = {}
    seed_draft(db_session, account, payload)
    assert client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"]).status_code == 200
    db_session.refresh(patient)
    assert patient.blood_type == "A+"
    assert json.loads(patient.allergies_json) == ["existing"]


def test_audit_write_failure_rolls_back_profile_consents_and_submission(client, account, db_session):
    profile = UserProfile(user_id=account["id"], full_name="Original")
    db_session.add(profile)
    draft = seed_draft(db_session, account)

    def fail_audit(mapper, connection, target):
        if target.action == "patient_onboarding_completed":
            raise RuntimeError("synthetic audit persistence failure")

    event.listen(HealthAuditLog, "before_insert", fail_audit)
    try:
        with TestClient(client.app, raise_server_exceptions=False) as no_raise:
            response = no_raise.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
        assert response.status_code == 500
    finally:
        event.remove(HealthAuditLog, "before_insert", fail_audit)
    db_session.expire_all()
    assert draft.status == "draft"
    assert draft.submitted_at is None
    assert profile.full_name == "Original"
    assert profile.phone is None
    assert db_session.query(Patient).filter_by(user_id=account["id"]).count() == 0
    assert completion_audits(db_session, draft) == []
    assert client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"]).status_code == 200


def test_explicit_role_prevents_stale_tabs_from_mutating_latest_other_draft(client, account, db_session):
    patient = seed_draft(db_session, account)
    professional = seed_draft(db_session, account, {}, role="doctor")
    for method, endpoint, body in [
        ("put", "/steps/1", {"data": {"language": "en"}}),
        ("post", "/save", {"step": 1, "data": {"language": "en"}}),
        ("post", "/submit", None),
    ]:
        kwargs = {"headers": account["headers"]}
        if body is not None:
            kwargs["json"] = body
        assert getattr(client, method)("/api/v1/onboarding" + endpoint, **kwargs).status_code == 409
    response = client.post("/api/v1/onboarding/save?role=patient", headers=account["headers"],
                           json={"step": 1, "data": {"language": "en"}})
    assert response.status_code == 200
    db_session.expire_all()
    assert json.loads(patient.data_json)["1"]["language"] == "en"
    assert json.loads(professional.data_json) == {}
    assert professional.status == "draft"
    assert client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"]).status_code == 200
    db_session.refresh(professional)
    assert professional.status == "draft"
    audit, = completion_audits(db_session, patient)
    evidence = json.loads(audit.metadata_json)
    assert evidence["language"] == "pt"
    assert evidence["preferred_language"] == "en"


def test_non_patient_roles_keep_generic_draft_submission(client, account, db_session):
    draft = seed_draft(db_session, account, {}, role="doctor")
    response = client.post("/api/v1/onboarding/submit?role=doctor", headers=account["headers"])
    assert response.status_code == 200
    assert response.json()["status"] == "submitted"
    assert "completion_status" not in response.json()
    assert db_session.query(Patient).filter_by(user_id=account["id"]).count() == 0
    assert completion_audits(db_session, draft) == []


@pytest.mark.parametrize("valid", [False, True])
def test_legacy_submitted_draft_resumes_without_claiming_completion_or_losing_answers(client, account, db_session, valid):
    payload = patient_payload(account["email"], db=db_session) if valid else {"3": {"full_name": "Original answer"}}
    draft = seed_draft(db_session, account, payload, status="submitted")
    status = client.get("/api/v1/onboarding/status?role=patient", headers=account["headers"]).json()["draft"]
    assert status["completion_status"] == "incomplete"
    assert client.get("/auth/me", headers=account["headers"]).json()["patient_onboarding_complete"] is False
    if valid:
        assert client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"]).json()["completion_status"] == "complete"
    else:
        response = client.post("/api/v1/onboarding/start", headers=account["headers"], json={"role": "patient"})
        assert response.status_code == 200
        assert response.json()["status"] == "draft"
        assert response.json()["data"] == payload
        assert response.json()["submitted_at"] is None
        assert client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"]).status_code == 422
        db_session.refresh(draft)
        assert draft.status == "draft"


def test_draft_role_cannot_promote_a_non_patient_account(client, account, db_session):
    user = db_session.get(User, account["id"])
    user.role = "client"
    draft = seed_draft(db_session, account)
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 403
    db_session.expire_all()
    assert user.role == "client"
    assert draft.status == "draft"
    assert completion_audits(db_session, draft) == []


def test_legacy_patient_alias_can_complete_without_changing_account_role(client, account, db_session):
    user = db_session.get(User, account["id"])
    user.role = "cliente"
    draft = seed_draft(db_session, account)
    response = client.post("/api/v1/onboarding/submit?role=patient", headers=account["headers"])
    assert response.status_code == 200, response.text
    assert response.json()["completion_status"] == "complete"
    db_session.refresh(user)
    assert user.role == "cliente"
    assert len(completion_audits(db_session, draft)) == 1
    me = client.get("/auth/me", headers=account["headers"]).json()
    assert me["role"] == "cliente"
    assert me["patient_onboarding_complete"] is True
    assert client.get("/api/v1/patients/me", headers=account["headers"]).status_code == 200
    assert len(client.get("/api/v1/compliance/consent-history/page", headers=account["headers"]).json()["items"]) == 5


def test_completed_onboarding_retry_never_regrants_after_withdrawal(client, account, db_session):
    from consent_fixtures import withdraw
    draft = seed_draft(db_session, account)
    first = client.post('/api/v1/onboarding/submit?role=patient', headers=account['headers'])
    assert first.status_code == 200
    patient = db_session.query(Patient).filter_by(user_id=account['id']).one()
    withdraw(db_session, patient, 'telemedicine_consent'); db_session.commit()
    replay = client.post('/api/v1/onboarding/submit?role=patient', headers=account['headers'])
    assert replay.status_code == 200 and replay.json() == first.json()
    assert db_session.query(PatientConsentEvent).filter_by(patient_id=patient.id).count() == 6
    state = client.get('/api/v1/compliance/consent-state', params={'country': 'AO'}, headers=account['headers']).json()
    assert next(row for row in state['states'] if row['purpose'] == 'telemedicine_consent')['status'] == 'withdrawn'
