"""
Health Platform — Integration Tests

Covers:
 - Patient profile CRUD
 - Triage flow (start → answers → complete)
 - Consent management
 - Consultation booking (requires consents)
 - Doctor queue & accept
 - Consultation complete
 - RBAC: patient cannot access doctor endpoints, doctor cannot complete unassigned consult
 - Admin doctor verification
 - Dashboard endpoints
"""
import json
import pytest
from fastapi.testclient import TestClient

from app.database import get_db, SessionLocal
from app.models import User
from app.health_models import Patient, Doctor, PatientConsent
from app.oauth2 import create_access_token
from app.utils import hash_password


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def _make_user(db, email: str, role: str = "patient") -> User:
    """Create or return an existing user."""
    u = db.query(User).filter(User.email == email).first()
    if u:
        return u
    u = User(email=email, password_hash=hash_password("Test@1234"), role=role, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _token(user: User) -> dict:
    """Return Authorization header dict for a user."""
    t = create_access_token({"sub": user.email, "uid": user.id})
    return {"Authorization": f"Bearer {t}"}


def _make_patient(db, user: User) -> Patient:
    """Create a patient profile for the user."""
    p = db.query(Patient).filter(Patient.user_id == user.id).first()
    if p:
        return p
    p = Patient(
        user_id=user.id,
        date_of_birth="1990-01-15",
        gender="male",
        blood_type="A+",
        allergies_json="[]",
        chronic_conditions_json="[]",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_doctor(db, user: User, verified: bool = False) -> Doctor:
    """Create a doctor profile."""
    d = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if d:
        return d
    d = Doctor(
        user_id=user.id,
        license_number="MED-AO-12345",
        specialization="clinica_geral",
        verification_status="verified" if verified else "pending",
    )
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


def _accept_consents(db, patient: Patient):
    """Accept all required consents for a patient."""
    for ct in ["privacy_policy", "telemedicine_consent", "terms_of_service"]:
        existing = db.query(PatientConsent).filter(
            PatientConsent.patient_id == patient.id,
            PatientConsent.consent_type == ct,
        ).first()
        if not existing:
            db.add(PatientConsent(patient_id=patient.id, consent_type=ct))
    db.commit()


# ═══════════════════════════════════════════════════════════════
# Patient Profile Tests
# ═══════════════════════════════════════════════════════════════

class TestPatientProfile:
    def test_create_patient_profile(self, client: TestClient, db_session):
        user = _make_user(db_session, "patient_new@test.com", "patient")
        r = client.post(
            "/api/v1/patients/profile",
            json={
                "date_of_birth": "1990-05-20",
                "gender": "female",
                "blood_type": "O+",
            },
            headers=_token(user),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["date_of_birth"] == "1990-05-20"
        assert data["gender"] == "female"

    def test_duplicate_profile_returns_409(self, client: TestClient, db_session):
        user = _make_user(db_session, "patient_dup@test.com", "patient")
        _make_patient(db_session, user)
        r = client.post(
            "/api/v1/patients/profile",
            json={"date_of_birth": "2000-01-01", "gender": "male"},
            headers=_token(user),
        )
        assert r.status_code == 409

    def test_get_my_profile(self, client: TestClient, db_session):
        user = _make_user(db_session, "patient_get@test.com", "patient")
        _make_patient(db_session, user)
        r = client.get("/api/v1/patients/me", headers=_token(user))
        assert r.status_code == 200
        assert r.json()["blood_type"] == "A+"


# ═══════════════════════════════════════════════════════════════
# Triage Flow Tests
# ═══════════════════════════════════════════════════════════════

class TestTriageFlow:
    def test_start_triage(self, client: TestClient, db_session):
        user = _make_user(db_session, "triage_user@test.com", "patient")
        _make_patient(db_session, user)
        r = client.post(
            "/api/v1/triage/start",
            json={"chief_complaint": "Dor de cabeça intensa"},
            headers=_token(user),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data
        assert len(data["questions"]) > 0

    def test_full_triage_flow(self, client: TestClient, db_session):
        user = _make_user(db_session, "triage_full@test.com", "patient")
        _make_patient(db_session, user)
        headers = _token(user)

        # Start
        r = client.post(
            "/api/v1/triage/start",
            json={"chief_complaint": "Febre alta"},
            headers=headers,
        )
        assert r.status_code == 200
        session_id = r.json()["session_id"]
        questions = r.json()["questions"]

        # Submit answers
        answers = {q["key"]: "no" for q in questions}
        answers["fever"] = "yes"
        answers["pain_level"] = "5"
        r = client.post(
            f"/api/v1/triage/{session_id}/answers",
            json={"answers": answers},
            headers=headers,
        )
        assert r.status_code == 200

        # Complete triage
        r = client.post(
            f"/api/v1/triage/{session_id}/complete",
            headers=headers,
        )
        assert r.status_code == 200, r.text
        result = r.json()
        assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH", "URGENT")
        assert result["recommended_action"] in (
            "SELF_CARE", "DOCTOR_24H", "DOCTOR_NOW", "ER_NOW",
        )
        assert "score" in result

    def test_triage_history(self, client: TestClient, db_session):
        user = _make_user(db_session, "triage_hist@test.com", "patient")
        _make_patient(db_session, user)
        headers = _token(user)

        # Complete one triage first
        r = client.post(
            "/api/v1/triage/start",
            json={"chief_complaint": "Tosse persistente"},
            headers=headers,
        )
        sid = r.json()["session_id"]
        questions = r.json()["questions"]
        answers = {q["key"]: "no" for q in questions}
        client.post(f"/api/v1/triage/{sid}/answers", json={"answers": answers}, headers=headers)
        client.post(f"/api/v1/triage/{sid}/complete", headers=headers)

        r = client.get("/api/v1/triage/history", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ═══════════════════════════════════════════════════════════════
# Consent Management Tests
# ═══════════════════════════════════════════════════════════════

class TestConsents:
    def test_accept_and_list_consents(self, client: TestClient, db_session):
        user = _make_user(db_session, "consent_user@test.com", "patient")
        _make_patient(db_session, user)
        headers = _token(user)

        for ct in ["privacy_policy", "telemedicine_consent", "terms_of_service"]:
            r = client.post(
                "/api/v1/compliance/consent",
                json={"consent_type": ct},
                headers=headers,
            )
            assert r.status_code == 200

        r = client.get("/api/v1/compliance/consents", headers=headers)
        assert r.status_code == 200
        types = {c["consent_type"] for c in r.json()}
        assert "privacy_policy" in types
        assert "telemedicine_consent" in types

    def test_duplicate_consent_is_idempotent(self, client: TestClient, db_session):
        user = _make_user(db_session, "consent_idem@test.com", "patient")
        _make_patient(db_session, user)
        headers = _token(user)

        r1 = client.post(
            "/api/v1/compliance/consent",
            json={"consent_type": "privacy_policy"},
            headers=headers,
        )
        r2 = client.post(
            "/api/v1/compliance/consent",
            json={"consent_type": "privacy_policy"},
            headers=headers,
        )
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]


# ═══════════════════════════════════════════════════════════════
# Consultation Booking Tests
# ═══════════════════════════════════════════════════════════════

class TestConsultations:
    def test_booking_without_consents_returns_403(self, client: TestClient, db_session):
        user = _make_user(db_session, "nocons_user@test.com", "patient")
        _make_patient(db_session, user)
        r = client.post(
            "/api/v1/consultations/book",
            json={"specialty": "clinica_geral"},
            headers=_token(user),
        )
        assert r.status_code == 403
        assert "Consentimentos" in r.json()["detail"]

    def test_booking_with_consents_succeeds(self, client: TestClient, db_session):
        user = _make_user(db_session, "cons_ok@test.com", "patient")
        patient = _make_patient(db_session, user)
        _accept_consents(db_session, patient)

        r = client.post(
            "/api/v1/consultations/book",
            json={"specialty": "clinica_geral"},
            headers=_token(user),
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "requested"
        assert data["specialty"] == "clinica_geral"

    def test_patient_list_consultations(self, client: TestClient, db_session):
        user = _make_user(db_session, "cons_list@test.com", "patient")
        patient = _make_patient(db_session, user)
        _accept_consents(db_session, patient)
        headers = _token(user)

        # Book one
        client.post(
            "/api/v1/consultations/book",
            json={"specialty": "clinica_geral"},
            headers=headers,
        )

        r = client.get("/api/v1/consultations/me", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ═══════════════════════════════════════════════════════════════
# Doctor Flow Tests
# ═══════════════════════════════════════════════════════════════

class TestDoctorFlow:
    def test_doctor_create_profile(self, client: TestClient, db_session):
        user = _make_user(db_session, "doc_create@test.com", "doctor")
        r = client.post(
            "/api/v1/doctors/profile",
            json={
                "license_number": "MED-AO-99999",
                "specialization": "pediatria",
            },
            headers=_token(user),
        )
        assert r.status_code == 200, r.text
        assert r.json()["verification_status"] == "pending"

    def test_verified_doctor_can_view_queue(self, client: TestClient, db_session):
        user = _make_user(db_session, "doc_queue@test.com", "doctor")
        _make_doctor(db_session, user, verified=True)

        r = client.get("/api/v1/doctor/queue", headers=_token(user))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unverified_doctor_cannot_view_queue(self, client: TestClient, db_session):
        user = _make_user(db_session, "doc_unv@test.com", "doctor")
        _make_doctor(db_session, user, verified=False)

        r = client.get("/api/v1/doctor/queue", headers=_token(user))
        assert r.status_code == 403

    def test_doctor_accept_consultation(self, client: TestClient, db_session):
        # Setup patient with booking
        p_user = _make_user(db_session, "dacpt_patient@test.com", "patient")
        patient = _make_patient(db_session, p_user)
        _accept_consents(db_session, patient)

        book_r = client.post(
            "/api/v1/consultations/book",
            json={"specialty": "clinica_geral"},
            headers=_token(p_user),
        )
        assert book_r.status_code == 200
        consult_id = book_r.json()["id"]

        # Doctor accepts
        d_user = _make_user(db_session, "dacpt_doctor@test.com", "doctor")
        _make_doctor(db_session, d_user, verified=True)

        r = client.post(
            f"/api/v1/doctor/queue/{consult_id}/accept",
            headers=_token(d_user),
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "in_progress"

    def test_doctor_complete_consultation(self, client: TestClient, db_session):
        # Patient books
        p_user = _make_user(db_session, "dcmpl_patient@test.com", "patient")
        patient = _make_patient(db_session, p_user)
        _accept_consents(db_session, patient)

        book_r = client.post(
            "/api/v1/consultations/book",
            json={"specialty": "clinica_geral"},
            headers=_token(p_user),
        )
        consult_id = book_r.json()["id"]

        # Doctor accepts
        d_user = _make_user(db_session, "dcmpl_doctor@test.com", "doctor")
        _make_doctor(db_session, d_user, verified=True)
        client.post(f"/api/v1/doctor/queue/{consult_id}/accept", headers=_token(d_user))

        # Doctor completes with SOAP notes
        r = client.post(
            f"/api/v1/consultations/{consult_id}/complete",
            json={
                "subjective": "Paciente refere dor abdominal há 2 dias.",
                "objective": "Abdómen sensível à palpação.",
                "assessment": "Possível gastrite.",
                "plan": "Prescrever IBP, dieta leve, reavaliação em 7 dias.",
                "outcome": "follow_up",
            },
            headers=_token(d_user),
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "completed"


# ═══════════════════════════════════════════════════════════════
# RBAC Tests
# ═══════════════════════════════════════════════════════════════

class TestRBAC:
    def test_patient_cannot_access_doctor_queue(self, client: TestClient, db_session):
        user = _make_user(db_session, "rbac_pat@test.com", "patient")
        _make_patient(db_session, user)
        r = client.get("/api/v1/doctor/queue", headers=_token(user))
        # Should fail — not a doctor at all
        assert r.status_code in (403, 404)

    def test_doctor_cannot_complete_unassigned_consultation(self, client: TestClient, db_session):
        # Patient books
        p_user = _make_user(db_session, "rbac_p@test.com", "patient")
        patient = _make_patient(db_session, p_user)
        _accept_consents(db_session, patient)
        book_r = client.post(
            "/api/v1/consultations/book",
            json={"specialty": "clinica_geral"},
            headers=_token(p_user),
        )
        consult_id = book_r.json()["id"]

        # Different doctor (not the one who accepted) tries to complete
        d_user = _make_user(db_session, "rbac_d@test.com", "doctor")
        _make_doctor(db_session, d_user, verified=True)

        r = client.post(
            f"/api/v1/consultations/{consult_id}/complete",
            json={
                "subjective": "Test",
                "objective": "Test",
                "assessment": "Test",
                "plan": "Test",
                "outcome": "resolved",
            },
            headers=_token(d_user),
        )
        # Should fail because not assigned / not in_progress
        assert r.status_code in (403, 404)

    def test_unauthenticated_cannot_access_patients(self, client: TestClient):
        r = client.get("/api/v1/patients/me")
        assert r.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════
# Admin Doctor Verification Tests
# ═══════════════════════════════════════════════════════════════

class TestAdminVerification:
    def test_admin_can_verify_doctor(self, client: TestClient, db_session):
        admin = _make_user(db_session, "admin_ver@test.com", "admin")
        d_user = _make_user(db_session, "doc_toverify@test.com", "doctor")
        doc = _make_doctor(db_session, d_user, verified=False)

        r = client.post(
            f"/api/v1/doctors/{doc.id}/verify",
            json={"action": "approve"},
            headers=_token(admin),
        )
        assert r.status_code == 200, r.text
        assert r.json()["verification_status"] == "verified"

    def test_non_admin_cannot_verify_doctor(self, client: TestClient, db_session):
        user = _make_user(db_session, "nonadmin@test.com", "patient")
        d_user = _make_user(db_session, "doc_toverify2@test.com", "doctor")
        doc = _make_doctor(db_session, d_user, verified=False)

        r = client.post(
            f"/api/v1/doctors/{doc.id}/verify",
            json={"action": "approve"},
            headers=_token(user),
        )
        assert r.status_code == 403

    def test_admin_can_list_pending_doctors(self, client: TestClient, db_session):
        admin = _make_user(db_session, "admin_pend@test.com", "admin")
        r = client.get("/api/v1/doctors/pending", headers=_token(admin))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ═══════════════════════════════════════════════════════════════
# Dashboard Tests
# ═══════════════════════════════════════════════════════════════

class TestDashboard:
    def test_health_endpoint(self, client: TestClient):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_admin_dashboard(self, client: TestClient, db_session):
        admin = _make_user(db_session, "dash_admin@test.com", "admin")
        r = client.get("/api/v1/dashboard/admin", headers=_token(admin))
        assert r.status_code == 200
        data = r.json()
        assert "total_patients" in data
        assert "total_doctors" in data

    def test_health_kpis(self, client: TestClient, db_session):
        admin = _make_user(db_session, "dash_kpi@test.com", "admin")
        r = client.get("/api/v1/dashboard/health", headers=_token(admin))
        assert r.status_code == 200
        data = r.json()
        assert "total_triage_sessions" in data


# ═══════════════════════════════════════════════════════════════
# Triage Engine Unit Tests
# ═══════════════════════════════════════════════════════════════

class TestTriageEngine:
    def test_red_flag_triggers_urgent(self):
        from app.services.triage_engine import evaluate_triage
        result = evaluate_triage({"chest_pain": "yes"})
        assert result.risk_level == "URGENT"
        assert result.recommended_action == "ER_NOW"

    def test_no_symptoms_is_low(self):
        from app.services.triage_engine import evaluate_triage
        result = evaluate_triage({"chest_pain": "no", "fever": "no", "pain_level": "1"})
        assert result.risk_level == "LOW"
        assert result.recommended_action == "SELF_CARE"

    def test_moderate_symptoms_is_medium(self):
        from app.services.triage_engine import evaluate_triage
        result = evaluate_triage({
            "chest_pain": "no",
            "fever": "yes",
            "pain_level": "7",
            "symptom_duration": "3_to_7_days",
        })
        assert result.risk_level in ("MEDIUM", "HIGH", "URGENT")

    def test_get_questions_returns_list(self):
        from app.services.triage_engine import get_triage_questions
        questions = get_triage_questions()
        assert len(questions) > 0
        assert all("key" in q and "label" in q for q in questions)
