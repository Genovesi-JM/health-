"""Nurse dashboard queue-metric tests.

Regression guard for the orphan-queue skew: stale unassigned requests (old
test data / no-shows) must drop off the live queue so wait-time metrics stay
realistic instead of showing multi-day averages.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from app.health_models import Consultation, Patient

from tests.test_clinician_credentials import _headers, _register, _verify_clinician


def _make_patient(client, db_session) -> Patient:
    reg = client.post("/auth/register", json={
        "email": f"queue-pat-{uuid.uuid4().hex[:8]}@example.com",
        "password": "strong-pass",
        "full_name": "Paciente Fila",
        "sector_focus": "health",
        "role": "patient",
    })
    assert reg.status_code == 201, reg.text
    patient = db_session.query(Patient).filter(
        Patient.user_id == reg.json()["user"]["id"],
    ).first()
    assert patient is not None
    return patient


def test_stale_requests_excluded_from_queue_metrics(client, db_session):
    nurse = _register(client, role="nurse", diploma_country="AO")
    _verify_clinician(client, nurse)
    patient = _make_patient(client, db_session)

    now = datetime.utcnow()
    # A fresh, genuinely-waiting request (~10 min).
    db_session.add(Consultation(
        patient_id=patient.id, specialty="clinica_geral", status="requested",
        created_at=now - timedelta(minutes=10),
    ))
    # An abandoned request from 9 days ago — the orphan-queue noise.
    db_session.add(Consultation(
        patient_id=patient.id, specialty="clinica_geral", status="requested",
        created_at=now - timedelta(days=9),
    ))
    db_session.commit()

    dash = client.get("/api/v1/nurse/dashboard", headers=_headers(nurse))
    assert dash.status_code == 200, dash.text
    body = dash.json()

    # Only the fresh request counts.
    assert body["queue_count"] == 1
    # Wait metrics reflect the fresh request, not the 9-day-old orphan.
    assert body["longest_wait_minutes"] < 60
    assert body["average_wait_minutes"] < 60
    assert body["waiting_over_30_count"] == 0
