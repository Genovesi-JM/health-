import uuid
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs, urlparse

from app.config import settings
from app.services.credential_providers import extract_azure_fields
from app.health_models import CareEscalation, Consultation, Doctor, Patient, Prescription


def _register(client, role="doctor", diploma_country="PT"):
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post("/auth/register", headers={
        "X-Forwarded-For": f"198.51.100.{int(uuid.uuid4().hex[:2], 16)}",
    }, json={
        "email": email,
        "password": "strong-pass",
        "full_name": "Profissional Teste",
        "sector_focus": "health",
        "role": role,
        "practice_country": "AO",
        "licence_country": "AO",
        "issuing_authority": "Ordem Profissional",
        "licence_number": "AO-12345",
        "diploma_country": diploma_country,
        "diploma_institution": "Universidade de Teste",
        "degree_title": "Medicina" if role == "doctor" else "Enfermagem",
        "graduation_year": 2020,
    })
    assert response.status_code == 201, response.text
    return response.json()


def _headers(auth):
    return {"Authorization": f"Bearer {auth['access_token']}"}


def _upload(client, auth, kind):
    return client.post(
        f"/api/v1/credentials/me/evidence/{kind}",
        headers=_headers(auth),
        files={"file": (f"{kind}.pdf", b"%PDF-1.4\ncredential-test", "application/pdf")},
    )


def _verify_clinician(client, auth):
    assert _upload(client, auth, "professional_card").status_code == 200
    assert _upload(client, auth, "diploma").status_code == 200
    submitted = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert submitted.status_code == 200
    admin = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    approved = client.post(
        f"/api/v1/credentials/admin/{submitted.json()['id']}/decision",
        headers=_headers(admin.json()),
        json={"action": "approve"},
    )
    assert approved.status_code == 200
    return approved.json()


def test_patient_registration_cannot_create_clinician_dossier(client):
    email = f"patient-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post("/auth/register", json={
        "email": email, "password": "strong-pass", "full_name": "Patient Test",
        "sector_focus": "health", "role": "patient",
    })
    assert response.status_code == 201
    dossier = client.get("/api/v1/credentials/me", headers=_headers(response.json()))
    assert dossier.status_code == 403


def test_foreign_diploma_requires_recognition_and_human_approval(client):
    auth = _register(client, role="doctor", diploma_country="PT")
    dossier = client.get("/api/v1/credentials/me", headers=_headers(auth))
    assert dossier.status_code == 200
    assert set(dossier.json()["missing_evidence"]) == {"professional_card", "diploma", "recognition"}

    assert _upload(client, auth, "professional_card").status_code == 200
    assert _upload(client, auth, "diploma").status_code == 200
    incomplete = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert incomplete.status_code == 422
    assert "recognition" in incomplete.json()["detail"]["missing_evidence"]

    assert _upload(client, auth, "recognition").status_code == 200
    submitted = client.post("/api/v1/credentials/me/submit", headers=_headers(auth))
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "pending_review"

    # Automated checks never grant clinical access.
    blocked = client.get("/api/v1/doctor/dashboard", headers=_headers(auth))
    assert blocked.status_code == 403

    admin_login = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    assert admin_login.status_code == 200
    approved = client.post(
        f"/api/v1/credentials/admin/{submitted.json()['id']}/decision",
        headers=_headers(admin_login.json()),
        json={"action": "approve"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "verified"

    allowed = client.get("/api/v1/doctor/dashboard", headers=_headers(auth))
    assert allowed.status_code == 200


def test_nurse_queue_is_gated_until_review(client):
    auth = _register(client, role="nurse", diploma_country="AO")
    blocked = client.get("/api/v1/nurse/dashboard", headers=_headers(auth))
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "credential_verification_required"


def test_verified_nurse_dashboard_exposes_operational_kpis(client):
    auth = _register(client, role="nurse", diploma_country="AO")
    _verify_clinician(client, auth)
    dashboard = client.get("/api/v1/nurse/dashboard", headers=_headers(auth))
    assert dashboard.status_code == 200
    assert {
        "queue_count", "urgent_count", "triages_today", "average_wait_minutes",
        "longest_wait_minutes", "waiting_over_30_count", "unclassified_count", "recent",
    }.issubset(dashboard.json())


def test_nurse_patient_360_requires_active_episode_and_exposes_role_capabilities(client, db_session):
    nurse = _register(client, role="nurse", diploma_country="AO")
    _verify_clinician(client, nurse)

    patient_auth = client.post("/auth/register", json={
        "email": f"patient-360-{uuid.uuid4().hex[:8]}@example.com",
        "password": "strong-pass",
        "full_name": "Paciente 360",
        "sector_focus": "health",
        "role": "patient",
    })
    assert patient_auth.status_code == 201
    patient = db_session.query(Patient).filter(
        Patient.user_id == patient_auth.json()["user"]["id"],
    ).first()
    assert patient is not None

    denied = client.get(
        f"/api/v1/clinician/patients/{patient.id}/360",
        headers=_headers(nurse),
    )
    assert denied.status_code == 403

    db_session.add(Consultation(
        patient_id=patient.id,
        specialty="clinica_geral",
        status="requested",
    ))
    db_session.commit()

    allowed = client.get(
        f"/api/v1/clinician/patients/{patient.id}/360",
        headers=_headers(nurse),
    )
    assert allowed.status_code == 200, allowed.text
    body = allowed.json()
    assert body["identity"]["name"] == "Paciente 360"
    assert body["access"]["role"] == "nurse"
    assert body["access"]["capabilities"]["record_nursing_observations"] is True
    assert body["access"]["capabilities"]["prescribe"] is False
    assert {
        "safety", "active_episode", "latest_triage", "consultations", "readings",
        "medications", "prescriptions", "referrals", "consents", "emergency_family",
    }.issubset(body)


def test_nurse_escalation_assigns_doctor_and_opens_patient_360(client, db_session):
    nurse = _register(client, role="nurse", diploma_country="AO")
    doctor_auth = _register(client, role="doctor", diploma_country="AO")
    _verify_clinician(client, nurse)
    _verify_clinician(client, doctor_auth)

    patient_auth = client.post("/auth/register", json={
        "email": f"patient-escalation-{uuid.uuid4().hex[:8]}@example.com",
        "password": "strong-pass",
        "full_name": "Paciente Encaminhado",
        "sector_focus": "health",
        "role": "patient",
    }).json()
    patient = db_session.query(Patient).filter(
        Patient.user_id == patient_auth["user"]["id"],
    ).first()
    consultation = Consultation(
        patient_id=patient.id,
        specialty="clinica_geral",
        status="requested",
    )
    db_session.add(consultation)
    db_session.commit()

    created = client.post(
        "/api/v1/clinical-operations/escalations",
        headers=_headers(nurse),
        json={
            "patient_id": patient.id,
            "consultation_id": consultation.id,
            "urgency": "urgent",
            "reason": "Dispneia e febre persistente",
            "clinical_summary": "SBAR: SpO2 93%, T 38.7 C, tosse há quatro dias.",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "pending"

    accepted = client.post(
        f"/api/v1/clinical-operations/escalations/{created.json()['id']}/accept",
        headers=_headers(doctor_auth),
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"

    db_session.expire_all()
    doctor = db_session.query(Doctor).filter(
        Doctor.user_id == doctor_auth["user"]["id"],
    ).first()
    assigned_consultation = db_session.query(Consultation).filter(
        Consultation.id == consultation.id,
    ).first()
    assert assigned_consultation.doctor_id == doctor.id

    workspace = client.get(
        f"/api/v1/clinician/patients/{patient.id}/360",
        headers=_headers(doctor_auth),
    )
    assert workspace.status_code == 200, workspace.text
    assert workspace.json()["access"]["role"] == "doctor"


def test_pem_gateway_is_explicitly_preparation_only_without_credentials(client, db_session, monkeypatch):
    doctor_auth = _register(client, role="doctor", diploma_country="AO")
    _verify_clinician(client, doctor_auth)
    for name in ("PEM_API_BASE_URL", "PEM_CLIENT_ID", "PEM_ORGANISATION_ID", "PEM_CLIENT_CERT_PATH"):
        monkeypatch.delenv(name, raising=False)

    status = client.get(
        "/api/v1/clinical-operations/integrations/pem/status",
        headers=_headers(doctor_auth),
    )
    assert status.status_code == 200
    assert status.json()["configured"] is False
    assert status.json()["mode"] == "preparation_only"


def test_nursing_documentation_and_care_tasks_are_shared_in_patient_360(client, db_session):
    nurse = _register(client, role="nurse", diploma_country="AO")
    doctor_auth = _register(client, role="doctor", diploma_country="AO")
    _verify_clinician(client, nurse)
    _verify_clinician(client, doctor_auth)
    doctor = db_session.query(Doctor).filter(Doctor.user_id == doctor_auth["user"]["id"]).first()

    patient_auth = client.post("/auth/register", json={
        "email": f"patient-care-{uuid.uuid4().hex[:8]}@example.com",
        "password": "strong-pass",
        "full_name": "Paciente Cuidados",
        "sector_focus": "health",
        "role": "patient",
    }).json()
    patient = db_session.query(Patient).filter(Patient.user_id == patient_auth["user"]["id"]).first()
    consultation = Consultation(
        patient_id=patient.id,
        doctor_id=doctor.id,
        specialty="clinica_geral",
        status="in_progress",
    )
    db_session.add(consultation)
    db_session.commit()

    observation = client.post(
        "/api/v1/clinical-operations/nursing/observations",
        headers=_headers(nurse),
        json={
            "patient_id": patient.id,
            "consultation_id": consultation.id,
            "observation_type": "intervention",
            "situation": "Paciente ansioso antes da teleconsulta.",
            "assessment": "Sinais vitais registados e identidade confirmada.",
            "recommendation": "Reavaliar pressão arterial em 30 minutos.",
            "patient_response": "Compreendeu as orientações.",
        },
    )
    assert observation.status_code == 201, observation.text

    task = client.post(
        "/api/v1/clinical-operations/care-tasks",
        headers=_headers(doctor_auth),
        json={
            "patient_id": patient.id,
            "consultation_id": consultation.id,
            "assigned_role": "nurse",
            "task_type": "reassessment",
            "title": "Reavaliar pressão arterial",
            "priority": "priority",
        },
    )
    assert task.status_code == 201, task.text
    completed = client.post(
        f"/api/v1/clinical-operations/care-tasks/{task.json()['id']}/complete",
        headers=_headers(nurse),
        json={"completion_note": "Pressão arterial repetida e comunicada ao médico."},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "completed"

    workspace = client.get(
        f"/api/v1/clinician/patients/{patient.id}/360",
        headers=_headers(doctor_auth),
    )
    assert workspace.status_code == 200, workspace.text
    assert workspace.json()["nursing_observations"][0]["observation_type"] == "intervention"
    assert workspace.json()["care_tasks"][0]["status"] == "completed"


def test_registration_rejects_incomplete_clinician_profile(client):
    response = client.post("/auth/register", json={
        "email": f"incomplete-{uuid.uuid4().hex[:8]}@example.com",
        "password": "strong-pass",
        "full_name": "Incomplete Doctor",
        "sector_focus": "health",
        "role": "doctor",
    })
    assert response.status_code == 422
    assert "licence_number" in response.json()["detail"]["missing_fields"]


def test_nurse_invite_creates_nurse_dossier(client):
    admin_login = client.post("/auth/login", json={"email": "teste@admin.com", "password": "123456"})
    invite = client.post(
        "/admin/doctor-invites",
        headers=_headers(admin_login.json()),
        json={"role": "nurse", "expires_days": 7},
    )
    assert invite.status_code == 201, invite.text
    token = parse_qs(urlparse(invite.json()["invite_url"]).query)["token"][0]
    email = f"invited-nurse-{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post("/auth/register/doctor", json={
        "token": token,
        "email": email,
        "password": "strong-pass",
        "display_name": "Enfermeira Convidada",
        "specialization": "enfermagem_geral",
        "license_number": "ORDENFA-123",
        "practice_country": "AO",
        "licence_country": "AO",
        "issuing_authority": "ORDENFA",
        "diploma_country": "CU",
        "diploma_institution": "Universidad de Ciencias Médicas",
        "degree_title": "Licenciatura em Enfermagem",
    })
    assert registered.status_code == 201, registered.text
    assert registered.json()["user"]["role"] == "nurse"
    dossier = client.get("/api/v1/credentials/me", headers=_headers(registered.json()))
    assert dossier.status_code == 200
    assert dossier.json()["profession"] == "nurse"
    assert "recognition" in dossier.json()["missing_evidence"]


def test_country_requirements_include_us_uk_and_all_eu_members(client):
    response = client.get(
        "/api/v1/credentials/requirements",
        params={"profession": "doctor", "practice_country": "DE", "licence_country": "DE", "diploma_country": "FR"},
    )
    assert response.status_code == 200
    body = response.json()
    codes = {item["code"] for item in body["countries"]}
    assert {"US", "GB", "DE", "FR", "PT", "ES", "SE", "MT"}.issubset(codes)
    assert body["eu_coordinated_recognition"] is True
    assert body["registry"]["mode"] == "eu_competent_authority"
    assert "recognition" in body["required_evidence"]


def test_us_licence_requires_state_jurisdiction(client):
    auth = _register(client)
    dossier = client.get("/api/v1/credentials/me", headers=_headers(auth)).json()
    update = {
        key: dossier.get(key) for key in (
            "profession", "legal_name", "nationality_country", "practice_country",
            "issuing_authority", "licence_number", "licence_expiry_date",
            "diploma_country", "diploma_institution", "degree_title", "graduation_year",
            "specialization", "registry_profile_url",
        )
    }
    update["licence_country"] = "US"
    update["licence_jurisdiction"] = None
    rejected = client.put("/api/v1/credentials/me", headers=_headers(auth), json=update)
    assert rejected.status_code == 422
    update["licence_jurisdiction"] = "California"
    accepted = client.put("/api/v1/credentials/me", headers=_headers(auth), json=update)
    assert accepted.status_code == 200
    assert accepted.json()["licence_jurisdiction"] == "California"


def test_provider_start_requires_consent_and_is_idempotent_without_keys(client):
    auth = _register(client, diploma_country="AO")
    assert _upload(client, auth, "professional_card").status_code == 200
    denied = client.post(
        "/api/v1/credentials/me/providers/start",
        headers=_headers(auth),
        json={"consent": False, "providers": ["azure", "persona", "dataflow"]},
    )
    assert denied.status_code == 422

    started = client.post(
        "/api/v1/credentials/me/providers/start",
        headers=_headers(auth),
        json={"consent": True, "providers": ["azure", "persona", "dataflow"]},
    )
    assert started.status_code == 200, started.text
    checks = started.json()["provider_checks"]
    assert {item["provider"] for item in checks} == {"azure", "persona", "dataflow"}
    assert all(item["status"] == "not_configured" for item in checks)

    repeated = client.post(
        "/api/v1/credentials/me/providers/start",
        headers=_headers(auth),
        json={"consent": True, "providers": ["azure", "persona", "dataflow"]},
    )
    assert repeated.status_code == 200
    assert len(repeated.json()["provider_checks"]) == len(checks)


def test_azure_field_parser_keeps_value_and_confidence():
    result = extract_azure_fields({
        "analyzeResult": {"documents": [{"fields": {
            "LicenceNumber": {"valueString": "GMC-123", "confidence": 0.98},
            "IssueDate": {"valueDate": "2026-01-01", "confidence": 0.91},
        }}]},
    })
    assert result["LicenceNumber"] == {"value": "GMC-123", "confidence": 0.98}
    assert result["IssueDate"]["value"] == "2026-01-01"


def test_persona_webhook_signature_is_required(client, db_session):
    previous = settings.persona_webhook_secret
    settings.persona_webhook_secret = "test-webhook-secret"
    try:
        raw = json.dumps({"data": {"id": "evt_test", "attributes": {
            "name": "inquiry.completed",
            "payload": {"data": {"id": "inq_missing"}},
        }}}).encode()
        invalid = client.post(
            "/api/v1/credentials/webhooks/persona",
            content=raw,
            headers={"Content-Type": "application/json", "Persona-Signature": "t=1,v1=bad"},
        )
        assert invalid.status_code == 401
        timestamp = str(int(time.time()))
        digest = hmac.new(
            settings.persona_webhook_secret.encode(),
            timestamp.encode() + b"." + raw,
            hashlib.sha256,
        ).hexdigest()
        valid = client.post(
            "/api/v1/credentials/webhooks/persona",
            content=raw,
            headers={
                "Content-Type": "application/json",
                "Persona-Signature": f"t={timestamp},v1={digest}",
            },
        )
        assert valid.status_code == 200
    finally:
        settings.persona_webhook_secret = previous
