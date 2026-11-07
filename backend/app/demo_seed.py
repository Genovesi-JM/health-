"""Demo-only data so the seeded accounts land on populated dashboards.

Runs only when KAYA_DEMO=true inside the synthetic runtime (the hold and
production runtimes never import this module). Everything here is fictional.
It completes patient onboarding, records the required consents against a demo
consent catalogue, and adds triages, consultations, a prescription, readings,
medications, notifications, a pending renewal request and doctor availability.
"""
from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta

from app import database as _database
from app import models
from app.health_models import (
    Consultation, ConsentCatalogDocument, DeviceReading, Doctor, DoctorAvailability,
    HealthAuditLog, Notification, OnboardingDraft, Patient, PatientConsentEvent,
    PatientMedication, Prescription, PrescriptionRequest, TriageResult, TriageSession,
)

CONSENT_DOCS = [
    ("privacy_policy", "privacy_notice", "Política de Privacidade (demo)"),
    ("telemedicine_consent", "clinical_informed_consent", "Consentimento de teleconsulta (demo)"),
    ("terms_of_service", "contract", "Termos de Serviço (demo)"),
    ("health_data_processing", "privacy_notice", "Tratamento de dados de saúde (demo)"),
    ("medical_disclaimer", "clinical_informed_consent", "Aviso médico (demo)"),
]


def _canonical(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _at(days: int = 0, hour: int = 9, minute: int = 0) -> datetime:
    base = datetime.utcnow().replace(hour=hour, minute=minute, second=0, microsecond=0)
    return base + timedelta(days=days)


def enabled() -> bool:
    return (os.environ.get("KAYA_EXECUTION_MODE") == "synthetic"
            and os.environ.get("KAYA_DEMO", "").lower() == "true")


def _complete_onboarding(db, user) -> None:
    draft = OnboardingDraft(
        user_id=user.id, role="patient", current_step=8, total_steps=8,
        completed_steps_json=json.dumps(list(range(1, 9))), data_json=json.dumps({"demo": True}),
        status="submitted", submitted_at=_at(-30),
    )
    db.add(draft)
    db.flush()
    db.add(HealthAuditLog(
        actor_user_id=user.id, action="patient_onboarding_completed",
        resource_type="onboarding_draft", resource_id=draft.id,
        metadata_json=json.dumps({"demo": True}),
    ))


def _consent_catalog(db) -> list[ConsentCatalogDocument]:
    rows = []
    for purpose, kind, title in CONSENT_DOCS:
        key = f"AO:pt:{purpose}"
        row = db.query(ConsentCatalogDocument).filter_by(document_key=key, version=1).first()
        if row is None:
            content = (f"{title}\n\nDocumento de demonstração do KAYA. Não constitui um texto legal aprovado; "
                       f"serve apenas para percorrer a aplicação com dados fictícios.")
            row = ConsentCatalogDocument(
                document_key=key, version=1, country="AO", language="pt", purpose=purpose, kind=kind,
                required=True, title=title, content=content,
                content_hash=hashlib.sha256(content.encode()).hexdigest(), status="approved",
                approved_source="demo seed", effective_from=_at(-60),
            )
            db.add(row)
            db.flush()
        rows.append(row)
    return rows


def _accept_consents(db, patient: Patient, user, docs) -> None:
    for i, doc in enumerate(docs, start=1):
        body = {"document_key": doc.document_key, "version": doc.version, "action": "accept"}
        db.add(PatientConsentEvent(
            patient_id=patient.id, actor_user_id=user.id, document_id=doc.id, sequence=i,
            action="accept", request_key=str(uuid.uuid4()), request_digest=_canonical(body),
            created_at=_at(-29, 10, i),
        ))


def _triage(db, patient: Patient, days_ago: int, complaint: str, risk: str, action: str, score: float) -> TriageSession:
    session = TriageSession(patient_id=patient.id, status="completed", chief_complaint=complaint,
                            country="AO", consent_language="pt",
                            created_at=_at(-days_ago, 8, 15), completed_at=_at(-days_ago, 8, 27))
    db.add(session)
    db.flush()
    db.add(TriageResult(triage_session_id=session.id, risk_level=risk, recommended_action=action,
                        reasoning_json=json.dumps(["Sintomas com mais de 48 h", "Sem sinais de alarme"]),
                        score=score, created_at=session.completed_at))
    return session


def _consultation(db, patient: Patient, doctor: Doctor, specialty: str, status: str,
                  when: datetime, triage: TriageSession | None = None, payment: str = "paid") -> Consultation:
    c = Consultation(
        patient_id=patient.id, doctor_id=doctor.id, specialty=specialty, status=status,
        triage_session_id=triage.id if triage else None,
        scheduled_at=when, scheduled_end_at=when + timedelta(minutes=30),
        country="AO", consent_language="pt", timezone="Africa/Luanda",
        payment_status=payment, created_at=when - timedelta(days=2),
    )
    if status == "completed":
        c.started_at = when
        c.ended_at = when + timedelta(minutes=25)
    db.add(c)
    db.flush()
    return c


def _readings(db, patient: Patient, bp: list[tuple[int, int, int]], glucose: list[float], weight: float | None) -> None:
    for i, (sys_, dia, pulse) in enumerate(bp):
        db.add(DeviceReading(patient_id=patient.id, reading_type="blood_pressure", systolic=sys_, diastolic=dia,
                             pulse=pulse, unit="mmHg", source="manual", country="AO", consent_language="pt",
                             measured_at=_at(-(len(bp) - i) * 3, 7, 30)))
    for i, g in enumerate(glucose):
        db.add(DeviceReading(patient_id=patient.id, reading_type="glucose", value=g, unit="mg/dL", source="manual",
                             country="AO", consent_language="pt", measured_at=_at(-(len(glucose) - i) * 4, 7, 0)))
    if weight is not None:
        db.add(DeviceReading(patient_id=patient.id, reading_type="weight", value=weight, unit="kg", source="manual",
                             country="AO", consent_language="pt", measured_at=_at(-1, 7, 10)))
    db.add(DeviceReading(patient_id=patient.id, reading_type="temperature", value=36.8, unit="°C", source="manual",
                         country="AO", consent_language="pt", measured_at=_at(-2, 20, 0)))


def _notify(db, user, title: str, message: str, kind: str, when: datetime) -> None:
    db.add(Notification(user_id=user.id, title=title, message=message, type=kind, is_read=False, created_at=when))


def seed_demo_data() -> dict:
    if not enabled():
        return {"skipped": "KAYA_DEMO not enabled"}
    db = _database.SessionLocal()
    try:
        users = {u.email: u for u in db.query(models.User).filter(models.User.email.in_([
            "paciente@health.com", "joao.paciente@health.com", "medico@health.com", "dra.ana@health.com",
        ])).all()}
        p1u, p2u = users.get("paciente@health.com"), users.get("joao.paciente@health.com")
        d1u, d2u = users.get("medico@health.com"), users.get("dra.ana@health.com")
        if not (p1u and p2u and d1u and d2u):
            return {"skipped": "seed users missing"}
        if db.query(OnboardingDraft).filter_by(user_id=p1u.id).first():
            return {"skipped": "already seeded"}

        p1 = db.query(Patient).filter_by(user_id=p1u.id).first()
        p2 = db.query(Patient).filter_by(user_id=p2u.id).first()
        d1 = db.query(Doctor).filter_by(user_id=d1u.id).first()
        d2 = db.query(Doctor).filter_by(user_id=d2u.id).first()
        if not (p1 and p2 and d1 and d2):
            return {"skipped": "patient/doctor profiles missing"}

        for user, name in ((p1u, "Maria Paciente"), (p2u, "João Paciente"), (d1u, "Carlos Mendonça"), (d2u, "Ana Ferreira")):
            profile = db.query(models.UserProfile).filter_by(user_id=user.id).first()
            if profile is None:
                db.add(models.UserProfile(user_id=user.id, full_name=name, country="AO", city="Luanda", entity_type="individual"))
            elif not profile.full_name:
                profile.full_name = name

        docs = _consent_catalog(db)
        for user, patient in ((p1u, p1), (p2u, p2)):
            _complete_onboarding(db, user)
            _accept_consents(db, patient, user, docs)

        # Doctors: weekday availability
        for doctor in (d1, d2):
            for dow in range(0, 5):
                db.add(DoctorAvailability(doctor_id=doctor.id, day_of_week=dow, start_time="09:00", end_time="17:00", is_active=True))

        # Patient 1 (asthma): a resolved episode, an upcoming teleconsultation, readings, a renewal
        t1 = _triage(db, p1, 12, "Dor de cabeça e febre ligeira", "MEDIUM", "book_consultation", 4.5)
        c1 = _consultation(db, p1, d1, "clinica_geral", "completed", _at(-10, 10, 0), t1)
        db.add(Prescription(consultation_id=c1.id, medications_json=json.dumps([
            {"name": "Paracetamol", "dosage": "1 g", "frequency": "8/8 h", "duration": "5 dias"},
            {"name": "Salbutamol inalador", "dosage": "100 mcg", "frequency": "2 inalações em SOS", "duration": "contínuo"},
        ]), instructions="Hidratação, repouso. Voltar se a febre persistir mais de 72 h.", created_at=c1.ended_at))
        _triage(db, p1, 3, "Falta de ar ligeira ao esforço", "LOW", "self_care", 2.0)
        _consultation(db, p1, d1, "clinica_geral", "scheduled", _at(2, 10, 0))
        db.add(PatientMedication(patient_id=p1.id, medication_name="Salbutamol inalador", dosage="100 mcg",
                                 frequency="2 inalações em SOS", start_date="2025-03-01", is_current=True,
                                 reason="Asma", prescribed_by="Dr. Carlos Mendonça"))
        _readings(db, p1, [(124, 80, 72), (128, 82, 75), (121, 79, 70), (126, 81, 74), (123, 78, 71)], [96, 101, 94], 64.5)
        db.add(PrescriptionRequest(patient_id=p1.id, doctor_id=d1.id, country="AO", consent_language="pt",
                                   request_key=str(uuid.uuid4()), revision=1, medication_name="Salbutamol inalador",
                                   dose="100 mcg", frequency="2 inalações em SOS",
                                   reason="Renovação: inalador a terminar.", status="pending", risk_level="LOW",
                                   created_at=_at(-1, 18, 30)))
        _notify(db, p1u, "Consulta confirmada", "Teleconsulta com Dr. Carlos Mendonça depois de amanhã às 10:00.",
                "consultation", _at(-1, 9, 0))
        _notify(db, p1u, "Receita disponível", "A receita da consulta de clínica geral está disponível nos documentos.",
                "prescription", _at(-10, 11, 0))
        _notify(db, p1u, "Lembrete de medição", "Registe a tensão arterial desta semana.", "reading", _at(0, 7, 0))

        # Patient 2 (diabetes + hypertension): history with the cardiologist, one in the waiting room today
        t2 = _triage(db, p2, 1, "Tonturas e tensão alta em casa", "HIGH", "book_consultation", 6.5)
        _consultation(db, p2, d2, "cardiologia", "completed", _at(-20, 15, 0))
        _consultation(db, p2, d1, "clinica_geral", "waiting", _at(0, 15, 0), t2)
        _consultation(db, p2, d1, "clinica_geral", "scheduled", _at(0, 16, 30))
        for name, dosage, freq, reason in (("Metformina", "850 mg", "2x/dia", "Diabetes tipo 2"),
                                           ("Losartan", "50 mg", "1x/dia", "Hipertensão")):
            db.add(PatientMedication(patient_id=p2.id, medication_name=name, dosage=dosage, frequency=freq,
                                     start_date="2024-09-10", is_current=True, reason=reason, prescribed_by="Dra. Ana"))
        _readings(db, p2, [(146, 92, 84), (142, 90, 80), (149, 94, 86)], [152, 168, 174], 88.0)
        _notify(db, p2u, "Está na fila de hoje", "O Dr. Carlos Mendonça vai chamá-lo em breve para a consulta.",
                "consultation", _at(0, 14, 50))

        _notify(db, d1u, "Pedido de renovação", "paciente@health.com pediu a renovação de Salbutamol.", "prescription", _at(-1, 18, 31))
        _notify(db, d1u, "Novo paciente em espera", "João Paciente aguarda consulta (triagem: risco alto).", "consultation", _at(0, 15, 1))

        db.commit()
        return {"patients": 2, "consultations": 5, "readings": 17, "renewal_requests": 1}
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
