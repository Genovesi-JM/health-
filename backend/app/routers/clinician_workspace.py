from __future__ import annotations
"""Shared, audited clinician workspace endpoints.

The Patient 360 endpoint consolidates the clinical context already stored by
KAYA while enforcing a legitimate care relationship:

* doctors need an assigned consultation or prescription request;
* nurses can access patients currently in an active KAYA care episode.

Mutation capabilities remain role-specific and are returned explicitly so the
frontend never presents prescribing or consultation-completion controls to a
nurse.
"""

import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserProfile
from app.health_models import (
    Consultation,
    ConsultationMessage,
    DeviceReading,
    Doctor,
    FamilyMember,
    Patient,
    PatientConsent,
    PatientMedication,
    Prescription,
    PrescriptionRequest,
    Referral,
    TriageSession,
)
from app.rbac import (
    assert_doctor_can_access_patient,
    log_health_audit,
    require_verified_clinician,
)


router = APIRouter(prefix="/api/v1/clinician", tags=["clinician-workspace"])


def _json(value: Optional[str], fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _age(date_of_birth: Optional[str]) -> Optional[int]:
    if not date_of_birth:
        return None
    try:
        born = datetime.strptime(date_of_birth, "%Y-%m-%d")
        today = datetime.utcnow()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except ValueError:
        return None


def _patient_name(patient: Patient, db: Session) -> str:
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient.user_id).first()
    if profile:
        name = getattr(profile, "full_name", None) or getattr(profile, "display_name", None)
        if name:
            return name
    account = db.query(User).filter(User.id == patient.user_id).first()
    return account.email.split("@")[0] if account and account.email else "Paciente"


def _assert_care_relationship(user: User, patient_id: str, db: Session) -> str:
    if user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Perfil médico não encontrado.")
        assert_doctor_can_access_patient(doctor, patient_id, db)
        return "assigned_doctor"

    active_episode = (
        db.query(Consultation.id)
        .filter(
            Consultation.patient_id == patient_id,
            Consultation.status.in_(("requested", "scheduled", "in_progress")),
        )
        .first()
    )
    if not active_episode:
        raise HTTPException(
            status_code=403,
            detail="Acesso de enfermagem limitado a pacientes com episódio de cuidados ativo.",
        )
    return "active_episode"


@router.get("/patients/{patient_id}/360")
def clinician_patient_360(
    patient_id: str,
    request: Request,
    user: User = Depends(require_verified_clinician),
    db: Session = Depends(get_db),
):
    """Return the longitudinal patient context needed at the point of care."""
    scope = _assert_care_relationship(user, patient_id, db)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    consultations = (
        db.query(Consultation)
        .filter(Consultation.patient_id == patient_id)
        .order_by(Consultation.created_at.desc())
        .limit(20)
        .all()
    )
    triages = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient_id)
        .order_by(TriageSession.created_at.desc())
        .limit(20)
        .all()
    )
    readings = (
        db.query(DeviceReading)
        .filter(DeviceReading.patient_id == patient_id)
        .order_by(DeviceReading.measured_at.desc())
        .limit(50)
        .all()
    )
    medications = (
        db.query(PatientMedication)
        .filter(PatientMedication.patient_id == patient_id)
        .order_by(PatientMedication.is_current.desc(), PatientMedication.created_at.desc())
        .limit(50)
        .all()
    )
    prescription_requests = (
        db.query(PrescriptionRequest)
        .filter(PrescriptionRequest.patient_id == patient_id)
        .order_by(PrescriptionRequest.created_at.desc())
        .limit(20)
        .all()
    )
    consents = (
        db.query(PatientConsent)
        .filter(PatientConsent.patient_id == patient_id)
        .order_by(PatientConsent.accepted_at.desc())
        .all()
    )
    emergency_family = (
        db.query(FamilyMember)
        .filter(
            FamilyMember.owner_patient_id == patient_id,
            FamilyMember.emergency_contact == True,
        )
        .limit(5)
        .all()
    )

    consultation_rows = []
    prescriptions = []
    referrals = []
    for consultation in consultations:
        messages_count = (
            db.query(ConsultationMessage.id)
            .filter(ConsultationMessage.consultation_id == consultation.id)
            .count()
        )
        consultation_rows.append({
            "id": consultation.id,
            "specialty": consultation.specialty,
            "status": consultation.status,
            "scheduled_at": _iso(consultation.scheduled_at),
            "started_at": _iso(consultation.started_at),
            "ended_at": _iso(consultation.ended_at),
            "created_at": _iso(consultation.created_at),
            "triage_session_id": consultation.triage_session_id,
            "doctor_id": consultation.doctor_id,
            "payment_status": consultation.payment_status,
            "messages_count": messages_count,
            "notes": {
                "subjective": consultation.notes.subjective,
                "objective": consultation.notes.objective,
                "assessment": consultation.notes.assessment,
                "plan": consultation.notes.plan,
                "outcome": consultation.notes.outcome,
            } if consultation.notes else None,
        })
        for prescription in (
            db.query(Prescription)
            .filter(Prescription.consultation_id == consultation.id)
            .all()
        ):
            prescriptions.append({
                "id": prescription.id,
                "consultation_id": consultation.id,
                "medications": _json(prescription.medications_json, []),
                "instructions": prescription.instructions,
                "created_at": _iso(prescription.created_at),
            })
        for referral in (
            db.query(Referral)
            .filter(Referral.consultation_id == consultation.id)
            .all()
        ):
            referrals.append({
                "id": referral.id,
                "consultation_id": consultation.id,
                "destination": referral.destination,
                "specialty": referral.specialty,
                "reason": referral.reason,
                "urgency": referral.urgency,
                "created_at": _iso(referral.created_at),
            })

    triage_rows = []
    for triage in triages:
        result = triage.result
        triage_rows.append({
            "id": triage.id,
            "status": triage.status,
            "chief_complaint": triage.chief_complaint,
            "risk_level": result.risk_level if result else None,
            "recommended_action": result.recommended_action if result else None,
            "score": float(result.score) if result else None,
            "reasoning": _json(result.reasoning_json, {}) if result else {},
            "answers": [
                {"question_key": answer.question_key, "value": _json(answer.answer_value, answer.answer_value)}
                for answer in triage.answers
            ],
            "photos_count": len(triage.photos),
            "created_at": _iso(triage.created_at),
            "completed_at": _iso(triage.completed_at),
        })

    allergies = _json(patient.allergies_json, [])
    conditions = _json(patient.chronic_conditions_json, [])
    risk_flags = []
    if allergies:
        risk_flags.append({"severity": "high", "type": "allergy", "label": f"Alergias: {', '.join(allergies)}"})
    if conditions:
        risk_flags.append({"severity": "medium", "type": "chronic_condition", "label": f"Condições crónicas: {', '.join(conditions)}"})
    latest_triage = triage_rows[0] if triage_rows else None
    if latest_triage and latest_triage["risk_level"] in ("URGENT", "HIGH"):
        risk_flags.append({"severity": "high", "type": "triage", "label": "Triagem recente de alto risco"})
    if len([medication for medication in medications if medication.is_current]) >= 5:
        risk_flags.append({"severity": "medium", "type": "polypharmacy", "label": "Possível polifarmácia (5+ medicamentos atuais)"})

    capabilities = {
        "view_longitudinal_record": True,
        "review_triage": True,
        "request_triage_photos": user.role == "doctor",
        "message_patient": user.role == "doctor",
        "join_teleconsultation": True,
        "record_nursing_observations": user.role == "nurse",
        "create_handoff": True,
        "prescribe": user.role == "doctor",
        "refer": user.role == "doctor",
        "complete_consultation": user.role == "doctor",
    }

    log_health_audit(
        db,
        action="patient_360_viewed",
        actor_user_id=user.id,
        resource_type="patient",
        resource_id=patient_id,
        metadata={"role": user.role, "access_scope": scope},
        request=request,
    )

    return {
        "access": {"role": user.role, "scope": scope, "capabilities": capabilities},
        "identity": {
            "id": patient.id,
            "name": _patient_name(patient, db),
            "date_of_birth": patient.date_of_birth,
            "age": _age(patient.date_of_birth),
            "gender": patient.gender,
            "blood_type": patient.blood_type,
            "emergency_contact_name": patient.emergency_contact_name,
            "emergency_contact_phone": patient.emergency_contact_phone,
        },
        "safety": {
            "allergies": allergies,
            "chronic_conditions": conditions,
            "risk_flags": risk_flags,
        },
        "active_episode": next(
            (row for row in consultation_rows if row["status"] in ("requested", "scheduled", "in_progress")),
            None,
        ),
        "latest_triage": latest_triage,
        "triages": triage_rows,
        "consultations": consultation_rows,
        "readings": [
            {
                "id": reading.id,
                "type": reading.reading_type,
                "value": float(reading.value) if reading.value is not None else None,
                "systolic": reading.systolic,
                "diastolic": reading.diastolic,
                "pulse": reading.pulse,
                "unit": reading.unit,
                "source": reading.source,
                "device_brand": reading.device_brand,
                "device_model": reading.device_model,
                "measured_at": _iso(reading.measured_at),
                "notes": reading.notes,
            }
            for reading in readings
        ],
        "medications": [
            {
                "id": medication.id,
                "name": medication.medication_name,
                "dosage": medication.dosage,
                "frequency": medication.frequency,
                "reason": medication.reason,
                "prescribed_by": medication.prescribed_by,
                "is_current": medication.is_current,
                "start_date": medication.start_date,
                "end_date": medication.end_date,
                "notes": medication.notes,
            }
            for medication in medications
        ],
        "prescriptions": prescriptions,
        "prescription_requests": [
            {
                "id": item.id,
                "medication_name": item.medication_name,
                "dose": item.dose,
                "frequency": item.frequency,
                "reason": item.reason,
                "status": item.status,
                "risk_level": item.risk_level,
                "risk_alert": item.risk_alert,
                "doctor_note": item.doctor_note,
                "created_at": _iso(item.created_at),
                "decided_at": _iso(item.decided_at),
            }
            for item in prescription_requests
        ],
        "referrals": referrals,
        "consents": [
            {"type": consent.consent_type, "accepted_at": _iso(consent.accepted_at)}
            for consent in consents
        ],
        "emergency_family": [
            {
                "id": member.id,
                "name": member.full_name,
                "relationship": member.relationship_type,
                "phone": member.phone,
            }
            for member in emergency_family
        ],
    }
