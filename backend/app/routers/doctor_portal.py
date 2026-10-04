from __future__ import annotations
"""
Doctor Portal Router
Dedicated endpoints for the doctor-facing portal.

Endpoints:
  GET /api/v1/doctor/dashboard              — KPI summary + stats
  GET /api/v1/doctor/agenda/today           — today's scheduled consultations
  GET /api/v1/doctor/patients               — list of unique patients seen by this doctor
  GET /api/v1/doctor/patients/{id}/summary  — brief patient card
  GET /api/v1/doctor/patients/{id}/clinical-summary — full clinical snapshot
"""
import json
import logging
from datetime import datetime, date, timedelta, timezone as utc_timezone
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserProfile
from app.health_models import (
    Doctor, Patient, PatientDocument, Consultation, ConsultationNotes,
    PrescriptionRequest, DeviceReading, PatientMedication, HealthPayment, HealthAuditLog,
)
from app.rbac import log_health_audit, assert_doctor_can_access_patient
from app.services.clinician_access import require_current_clinician
from app.services.patient_documents import doctor_has_document_relationship
from app.services.appointments import valid_zone

logger = logging.getLogger(__name__)
router = APIRouter(tags=["doctor-portal"])


# ── Helpers ─────────────────────────────────────────────────────────────────

def _require_doctor(user: User, db: Session) -> Doctor:
    """Return the Doctor record for the current user or raise 403/404."""
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Acesso reservado a médicos.")
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")
    require_current_clinician(user, db)
    return doctor


def _parse_json_list(value: Optional[str]) -> List[Any]:
    if not value:
        return []
    try:
        return json.loads(value)
    except Exception:
        return []


def _patient_age(dob_str: Optional[str]) -> Optional[int]:
    if not dob_str:
        return None
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        return (datetime.utcnow() - dob).days // 365
    except Exception:
        return None


def _get_patient_name(patient: Patient, db: Session) -> str:
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient.user_id).first()
    if profile:
        name = getattr(profile, "full_name", None) or getattr(profile, "display_name", None)
        if name:
            return name
    u = db.query(User).filter(User.id == patient.user_id).first()
    if u:
        return u.email.split("@")[0]
    return "Paciente"


def _consultation_type_label(c: Consultation) -> str:
    """Infer consultation type label from specialty / notes."""
    sp = (c.specialty or "").lower()
    if "tele" in sp or "online" in sp:
        return "teleconsulta"
    return "presencial"


def _status_label(status: str) -> str:
    mapping = {
        "scheduled": "confirmed",
        "requested": "pending",
        "in_progress": "in_progress",
        "completed": "completed",
        "cancelled": "cancelled",
        "no_show": "no_show",
    }
    return mapping.get(status, status)


# ── GET /api/v1/doctor/dashboard ─────────────────────────────────────────────

@router.get("/api/v1/doctor/dashboard")
def doctor_dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """KPI summary and high-level stats for the doctor dashboard."""
    doctor = _require_doctor(user, db)

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = today_start + timedelta(days=1)
    week_start = today_start - timedelta(days=today_start.weekday())

    all_consultations = (
        db.query(Consultation)
        .filter(Consultation.doctor_id == doctor.id)
        .all()
    )
    today_consultations = [
        c for c in all_consultations
        if c.scheduled_at and today_start <= c.scheduled_at < today_end
    ]
    week_completed = [
        c for c in all_consultations
        if c.status == "completed"
        and c.ended_at and c.ended_at >= week_start
    ]
    pending_rx = (
        db.query(PrescriptionRequest)
        .filter(
            PrescriptionRequest.doctor_id == doctor.id,
            PrescriptionRequest.status == "pending",
        )
        .count()
    )
    waiting_queue = [c for c in all_consultations if c.status == "waiting"]
    in_progress = [c for c in all_consultations if c.status == "in_progress"]

    # Unique patient count
    unique_patients = len({c.patient_id for c in all_consultations})

    return {
        "today": {
            "total": len(today_consultations),
            "confirmed": sum(1 for c in today_consultations if c.status in ("scheduled", "confirmed")),
            "waiting": len(waiting_queue),
            "in_progress": len(in_progress),
        },
        "week": {
            "completed": len(week_completed),
        },
        "pending_prescription_requests": pending_rx,
        "unique_patients": unique_patients,
        "doctor": {
            "display_name": doctor.display_name,
            "title": doctor.title,
            "specialization": doctor.specialization,
            "verification_status": doctor.verification_status,
            "accepts_new_patients": doctor.accepts_new_patients,
            "price_min": doctor.price_min,
            "price_max": doctor.price_max,
            "years_experience": doctor.years_experience,
            "slug": doctor.slug,
        },
    }


# ── GET /api/v1/doctor/agenda/today ─────────────────────────────────────────

@router.get("/api/v1/doctor/agenda/today")
def doctor_agenda_today(
    response: Response,
    day: Optional[date] = Query(None, alias="date"),
    country: Literal["AO", "PT"] = "AO",
    timezone: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return one clinic-local day; the historical path also accepts a date."""
    doctor = _require_doctor(user, db)

    zone_name = timezone or ("Africa/Luanda" if country == "AO" else None)
    zone = valid_zone(country, zone_name or "")
    selected_day = day or datetime.now(utc_timezone.utc).astimezone(zone).date()
    local_start = datetime.combine(selected_day, datetime.min.time(), tzinfo=zone)
    today_start = local_start.astimezone(utc_timezone.utc).replace(tzinfo=None)
    today_end = (local_start + timedelta(days=1)).astimezone(utc_timezone.utc).replace(tzinfo=None)

    consultations = (
        db.query(Consultation)
        .filter(
            Consultation.doctor_id == doctor.id,
            or_(Consultation.country == country, Consultation.country.is_(None)),
            Consultation.scheduled_at >= today_start,
            Consultation.scheduled_at < today_end,
        )
        .order_by(Consultation.scheduled_at.asc())
        .all()
    )

    result = []
    for c in consultations:
        patient_name = "Paciente"
        if c.patient:
            patient_name = _get_patient_name(c.patient, db)
        initials = "".join(p[0].upper() for p in patient_name.split()[:2]) or "P"
        instant = c.scheduled_at.replace(tzinfo=utc_timezone.utc)
        end_instant = c.scheduled_end_at.replace(tzinfo=utc_timezone.utc) if c.scheduled_end_at else None
        duration = int((end_instant - instant).total_seconds() / 60) if end_instant and end_instant > instant else None
        result.append({
            "id": c.id,
            "time": instant.astimezone(zone).strftime("%H:%M"),
            "scheduled_at": instant.isoformat(),
            "scheduled_end_at": end_instant.isoformat() if end_instant else None,
            "duration": duration,
            "country": c.country,
            "timezone": zone_name,
            "slot_timezone": c.timezone,
            "patient": patient_name,
            "patient_id": c.patient_id,
            "type": _consultation_type_label(c),
            "specialty": c.specialty,
            "reason": c.notes.subjective if c.notes else None,
            "status": _status_label(c.status),
            "avatar": initials,
        })

    db.add(HealthAuditLog(
        actor_user_id=user.id, action="doctor_agenda_read", resource_type="doctor",
        resource_id=doctor.id,
        metadata_json=json.dumps({"date": selected_day.isoformat(), "country": country, "timezone": zone_name}),
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível carregar a agenda. Tente novamente.") from None
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return result


# ── GET /api/v1/doctor/patients ──────────────────────────────────────────────

@router.get("/api/v1/doctor/patients")
def doctor_patients_list(
    search: Optional[str] = Query(None, description="Filter by patient name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return unique patients who have had a consultation with this doctor."""
    doctor = _require_doctor(user, db)

    consultations = (
        db.query(Consultation)
        .filter(
            Consultation.doctor_id == doctor.id,
            Consultation.status.in_(("scheduled", "in_progress", "completed")),
        )
        .all()
    )

    seen: dict[str, dict] = {}  # patient_id → summary dict
    for c in consultations:
        if c.patient_id in seen:
            # Track last visit
            if c.scheduled_at and (seen[c.patient_id]["last_consultation_at"] is None or
                                    c.scheduled_at > seen[c.patient_id]["last_consultation_at"]):
                seen[c.patient_id]["last_consultation_at"] = c.scheduled_at
            seen[c.patient_id]["consultation_count"] += 1
        else:
            patient = c.patient
            if not patient:
                continue
            name = _get_patient_name(patient, db)
            seen[c.patient_id] = {
                "id": patient.id,
                "name": name,
                "age": _patient_age(patient.date_of_birth),
                "gender": patient.gender,
                "blood_type": patient.blood_type,
                "chronic_conditions": _parse_json_list(patient.chronic_conditions_json),
                "allergies": _parse_json_list(patient.allergies_json),
                "last_consultation_at": c.scheduled_at,
                "consultation_count": 1,
                "status": "stable",  # derived below
            }

    rows = list(seen.values())

    # Apply search filter
    if search:
        q = search.lower()
        rows = [r for r in rows if q in r["name"].lower()]

    # Derive status from chronic conditions
    for r in rows:
        conds = r.get("chronic_conditions", [])
        if any(k in " ".join(conds).lower() for k in ["insuficiência", "insufic", "falência", "falencia", "urgente"]):
            r["status"] = "urgent"
        elif conds:
            r["status"] = "chronic"
        else:
            r["status"] = "stable"

    # Sort: urgent → chronic → stable, then by last_consultation desc
    order = {"urgent": 0, "chronic": 1, "stable": 2}
    rows.sort(key=lambda r: (order.get(r["status"], 3), -(r["last_consultation_at"].timestamp() if r["last_consultation_at"] else 0)))

    total = len(rows)
    rows = rows[offset: offset + limit]

    # Format last_consultation_at for frontend
    for r in rows:
        if r["last_consultation_at"]:
            r["last_consultation_at"] = r["last_consultation_at"].isoformat()

    return {"total": total, "patients": rows}


# ── GET /api/v1/doctor/patients/{patient_id}/summary ─────────────────────────

@router.get("/api/v1/doctor/patients/{patient_id}/summary")
def doctor_patient_summary(
    patient_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Brief patient card: demographics + last vitals."""
    doctor = _require_doctor(user, db)

    # Confirm this doctor has treated this patient
    consultation = (
        db.query(Consultation)
        .filter(
            Consultation.doctor_id == doctor.id,
            Consultation.patient_id == patient_id,
            Consultation.status.in_(("scheduled", "in_progress", "completed")),
        )
        .first()
    )
    if not consultation:
        raise HTTPException(status_code=404, detail="Paciente não encontrado ou sem histórico com este médico.")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    name = _get_patient_name(patient, db)
    last_vitals = (
        db.query(DeviceReading)
        .filter(DeviceReading.patient_id == patient_id)
        .order_by(DeviceReading.measured_at.desc())
        .limit(5)
        .all()
    )

    return {
        "id": patient.id,
        "name": name,
        "age": _patient_age(patient.date_of_birth),
        "gender": patient.gender,
        "blood_type": patient.blood_type,
        "chronic_conditions": _parse_json_list(patient.chronic_conditions_json),
        "allergies": _parse_json_list(patient.allergies_json),
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
        "last_vitals": [
            {
                "id": v.id,
                "type": v.reading_type,
                "value": v.value,
                "systolic": v.systolic,
                "diastolic": v.diastolic,
                "pulse": v.pulse,
                "unit": v.unit,
                "recorded_at": v.measured_at.isoformat() if v.measured_at else None,
            }
            for v in last_vitals
        ],
    }


# ── GET /api/v1/doctor/patients/{patient_id}/clinical-summary ────────────────

@router.get("/api/v1/doctor/patients/{patient_id}/clinical-summary")
def doctor_patient_clinical_summary(
    patient_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Full clinical snapshot of a patient for the doctor portal.

    Returns:
    - Identity (name, age, gender, city)
    - Chronic conditions & allergies
    - Current medications (self-reported)
    - Last consultations (with notes)
    - Last vitals (device readings)
    - Previous prescription requests
    - Risk flags
    """
    doctor = _require_doctor(user, db)

    # Confirm relationship — allow access via consultation OR prescription request
    assert_doctor_can_access_patient(doctor, patient_id, db)

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    # Audit log: doctor viewed clinical summary
    try:
        log_health_audit(
            db,
            action="clinical_summary_viewed",
            actor_user_id=user.id,
            resource_type="patient",
            resource_id=patient_id,
            metadata={"doctor_id": doctor.id},
        )
    except Exception:
        pass

    # Identity
    name = _get_patient_name(patient, db)
    age = _patient_age(patient.date_of_birth)

    # City (from user profile)
    city: Optional[str] = None
    profile = db.query(UserProfile).filter(UserProfile.user_id == patient.user_id).first()
    if profile:
        city = getattr(profile, "city", None) or getattr(profile, "location_city", None)

    # Chronic conditions & allergies
    chronic_conditions = _parse_json_list(patient.chronic_conditions_json)
    allergies = _parse_json_list(patient.allergies_json)

    # Current medications
    medications = (
        db.query(PatientMedication)
        .filter(
            PatientMedication.patient_id == patient_id,
            PatientMedication.is_current == True,
        )
        .order_by(PatientMedication.created_at.desc())
        .limit(20)
        .all()
    )

    # Last consultations (most recent 5)
    last_consultations = (
        db.query(Consultation)
        .filter(Consultation.patient_id == patient_id)
        .order_by(Consultation.scheduled_at.desc())
        .limit(5)
        .all()
    )

    # Last vitals (most recent per type)
    last_vitals = (
        db.query(DeviceReading)
        .filter(DeviceReading.patient_id == patient_id)
        .order_by(DeviceReading.measured_at.desc())
        .limit(10)
        .all()
    )

    # Previous prescription requests (most recent 10)
    prev_rx = (
        db.query(PrescriptionRequest)
        .filter(PrescriptionRequest.patient_id == patient_id)
        .order_by(PrescriptionRequest.created_at.desc())
        .limit(10)
        .all()
    )

    # Risk flags
    risk_flags: List[str] = []
    HIGH_RISK_CONDITIONS = [
        "insuficiência cardíaca", "insuficiência renal", "insuficiencia cardiaca",
        "insuficiencia renal", "drc", "fibrilhação auricular", "fibrilacao auricular",
        "neoplasia", "cancro", "cancer", "diabetes", "diabetes tipo 2", "diabetes tipo 1",
    ]
    cond_str = " ".join(chronic_conditions).lower()
    for hrc in HIGH_RISK_CONDITIONS:
        if hrc in cond_str:
            risk_flags.append(f"Condição de alto risco: {hrc.title()}")

    if allergies:
        risk_flags.append(f"Alergias documentadas: {', '.join(allergies)}")

    high_risk_rx = [r for r in prev_rx if r.risk_level == "high"]
    if high_risk_rx:
        risk_flags.append(f"{len(high_risk_rx)} prescrição(ões) de alto risco anteriores")

    if age and age >= 65:
        risk_flags.append("Paciente idoso (≥ 65 anos) — atenção a polifarmácia e quedas")

    return {
        "identity": {
            "id": patient.id,
            "name": name,
            "age": age,
            "gender": patient.gender,
            "blood_type": patient.blood_type,
            "date_of_birth": patient.date_of_birth,
            "city": city,
            "emergency_contact_name": patient.emergency_contact_name,
            "emergency_contact_phone": patient.emergency_contact_phone,
        },
        "chronic_conditions": chronic_conditions,
        "allergies": allergies,
        "current_medications": [
            {
                "id": m.id,
                "name": m.medication_name,
                "dosage": m.dosage,
                "frequency": m.frequency,
                "start_date": m.start_date,
                "reason": m.reason,
                "prescribed_by": m.prescribed_by,
            }
            for m in medications
        ],
        "last_consultations": [
            {
                "id": c.id,
                "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
                "status": c.status,
                "specialty": c.specialty,
                "notes": {
                    "subjective": c.notes.subjective if c.notes else None,
                    "objective": c.notes.objective if c.notes else None,
                    "assessment": c.notes.assessment if c.notes else None,
                    "plan": c.notes.plan if c.notes else None,
                    "outcome": c.notes.outcome if c.notes else None,
                } if c.notes else None,
            }
            for c in last_consultations
        ],
        "last_vitals": [
            {
                "id": v.id,
                "type": v.reading_type,
                "value": v.value,
                "systolic": v.systolic,
                "diastolic": v.diastolic,
                "pulse": v.pulse,
                "unit": v.unit,
                "recorded_at": v.measured_at.isoformat() if v.measured_at else None,
            }
            for v in last_vitals
        ],
        "previous_prescriptions": [
            {
                "id": r.id,
                "medication_name": r.medication_name,
                "dose": r.dose,
                "frequency": r.frequency,
                "status": r.status,
                "risk_level": r.risk_level,
                "risk_alert": r.risk_alert,
                "doctor_note": r.doctor_note,
                "created_at": r.created_at.isoformat(),
                "decided_at": r.decided_at.isoformat() if r.decided_at else None,
            }
            for r in prev_rx
        ],
        "risk_flags": risk_flags,
        "uploaded_files": [
            {
                "id": document.id, "original_filename": document.original_filename,
                "content_type": document.content_type, "size_bytes": document.size_bytes,
                "status": document.status, "scan_status": document.scan_status,
                "created_at": document.created_at.isoformat(),
            }
            for document in db.query(PatientDocument).filter(
                PatientDocument.patient_id == patient_id,
                PatientDocument.scan_status == "clean",
            ).order_by(PatientDocument.created_at.desc()).limit(100).all()
        ] if doctor_has_document_relationship(doctor.id, patient_id, db) else [],
    }


# ── GET /api/v1/doctor/finance ───────────────────────────────────────────────

_PLATFORM_RATE = 0.10  # KAYA commission on paid consultations


def _fmt_kz(centavos: int) -> str:
    """Format centavos as '50.000 Kz' (pt-AO grouping)."""
    value = (centavos or 0) / 100
    s = f"{value:,.0f}".replace(",", ".")
    return f"{s} Kz"


@router.get("/api/v1/doctor/finance")
def doctor_finance(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Earnings summary for the doctor, computed from consultation payments."""
    doctor = _require_doctor(user, db)

    # All payments tied to this doctor's consultations.
    rows = (
        db.query(HealthPayment, Consultation)
        .join(Consultation, HealthPayment.consultation_id == Consultation.id)
        .filter(Consultation.doctor_id == doctor.id)
        .order_by(HealthPayment.created_at.desc())
        .all()
    )

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = datetime.combine(date.today(), datetime.min.time())

    paid_total = paid_month = paid_today = pending_total = 0
    today_count = month_count = 0
    transactions = []

    for pay, c in rows:
        if pay.status == "paid":
            paid_total += pay.amount
            if pay.created_at >= month_start:
                paid_month += pay.amount
                month_count += 1
            if pay.created_at >= today_start:
                paid_today += pay.amount
                today_count += 1
        elif pay.status == "pending":
            pending_total += pay.amount

        if len(transactions) < 30:
            patient = db.get(Patient, c.patient_id) if c.patient_id else None
            transactions.append({
                "id": pay.id,
                "patient": _get_patient_name(patient, db) if patient else "Paciente",
                "type": _consultation_type_label(c),
                "amount": _fmt_kz(pay.amount),
                "date": pay.created_at.strftime("%d/%m/%Y"),
                "status": "Pago" if pay.status == "paid" else ("Pendente" if pay.status == "pending" else pay.status),
            })

    platform_fee = int(paid_total * _PLATFORM_RATE)
    net_total = paid_total - platform_fee

    return {
        "kpis": {
            "today": {"amount": _fmt_kz(paid_today), "count": today_count},
            "month": {"amount": _fmt_kz(paid_month), "count": month_count},
            "pending": {"amount": _fmt_kz(pending_total)},
            "platform_fee": {"amount": _fmt_kz(platform_fee), "rate": "10% do total"},
            "net_total": {"amount": _fmt_kz(net_total)},
        },
        "transactions": transactions,
    }


# ── GET /api/v1/doctor/reviews ───────────────────────────────────────────────
from app.health_models import DoctorReview as _DoctorReview  # noqa: E402


@router.get("/api/v1/doctor/reviews")
def doctor_reviews(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """The doctor's patient reviews with average rating."""
    doctor = _require_doctor(user, db)
    rows = (
        db.query(_DoctorReview)
        .filter(_DoctorReview.doctor_id == doctor.id)
        .order_by(_DoctorReview.created_at.desc())
        .limit(100)
        .all()
    )
    reviews = []
    for r in rows:
        patient = db.get(Patient, r.patient_id)
        full = _get_patient_name(patient, db) if patient else "Paciente"
        # Show first name + last initial for privacy: "Maria F."
        parts = full.split()
        short = parts[0] + (f" {parts[-1][0]}." if len(parts) > 1 else "")
        reviews.append({
            "id": r.id,
            "patient": short,
            "rating": r.rating,
            "comment": r.comment,
            "date": r.created_at.strftime("%d/%m/%Y"),
        })
    count = len(rows)
    average = round(sum(r.rating for r in rows) / count, 1) if count else 0.0
    return {"average": average, "count": count, "reviews": reviews}
