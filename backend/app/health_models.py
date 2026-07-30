from __future__ import annotations
# app/health_models.py
"""
KAYA Domain Models — Digital Triage & Teleconsultation

These models extend the existing User/Account tables with health-specific
domain entities: Patient, Doctor, TriageSession, Consultation, Prescription,
Referral, CorporateAccount, and supporting tables.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    Integer,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid():
    return str(uuid.uuid4())


# ── Patient Profile (extends User) ──

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    blood_type: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    allergies_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="[]")
    chronic_conditions_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="[]")
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", backref="patient_profile")
    triage_sessions = relationship("TriageSession", back_populates="patient", cascade="all, delete-orphan")
    consultations = relationship("Consultation", back_populates="patient", foreign_keys="Consultation.patient_id")
    consents = relationship("PatientConsent", back_populates="patient", cascade="all, delete-orphan")


# ── Doctor Invite (token-based onboarding) ──

class DoctorInvite(Base):
    __tablename__ = "doctor_invites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    invited_email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)  # hint only
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # admin note
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="doctor")  # doctor | nurse
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    used_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


# ── Doctor Profile (extends User) ──

class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    # Core credentials
    license_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    specialization: Mapped[str] = mapped_column(String(100), nullable=False, default="clinica_geral")
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
    )  # pending, verified, rejected, suspended
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    document_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Public profile fields
    display_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, default="Dr.")  # Dr., Prof., Dra.
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    slug: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location_province: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    years_experience: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    accepts_new_patients: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # JSON arrays stored as text
    consultation_types_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default='["teleconsulta"]')
    # e.g. ["presencial","teleconsulta"]
    languages_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default='["PT"]')
    education_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default='[]')
    # e.g. [{"institution":"FMUAN","degree":"Medicina","year":2015}]

    # Pricing (optional, informational)
    price_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Kz
    price_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", backref="doctor_profile")
    availability_slots = relationship("DoctorAvailability", back_populates="doctor", cascade="all, delete-orphan")
    consultations = relationship("Consultation", back_populates="doctor", foreign_keys="Consultation.doctor_id")

    __table_args__ = (
        Index("ix_doctors_verification_status", "verification_status"),
    )


# ── Clinician credentialing (doctor + nurse) ──

class ClinicianCredential(Base):
    """Private credential dossier used to gate all clinical access.

    Registry checks are intentionally advisory: only an authorised reviewer
    can grant ``verified`` status.
    """
    __tablename__ = "clinician_credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    profession: Mapped[str] = mapped_column(String(20), nullable=False)  # doctor | nurse
    legal_name: Mapped[str] = mapped_column(String(200), nullable=False)
    nationality_country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    practice_country: Mapped[str] = mapped_column(String(2), nullable=False, default="AO")
    licence_country: Mapped[str] = mapped_column(String(2), nullable=False)
    issuing_authority: Mapped[str] = mapped_column(String(200), nullable=False)
    licence_number: Mapped[str] = mapped_column(String(100), nullable=False)
    licence_expiry_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    diploma_country: Mapped[str] = mapped_column(String(2), nullable=False)
    diploma_institution: Mapped[str] = mapped_column(String(250), nullable=False)
    degree_title: Mapped[str] = mapped_column(String(200), nullable=False)
    graduation_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    specialization: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    registry_profile_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    automated_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    automated_checks_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id], backref="clinician_credential")
    evidence = relationship("CredentialEvidence", back_populates="credential", cascade="all, delete-orphan")


class CredentialEvidence(Base):
    __tablename__ = "credential_evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    credential_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinician_credentials.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    credential = relationship("ClinicianCredential", back_populates="evidence")

    __table_args__ = (
        Index("ix_credential_evidence_credential_kind", "credential_id", "kind"),
    )


# ── Doctor Availability ──

class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon, 6=Sun
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    doctor = relationship("Doctor", back_populates="availability_slots")


# ── Triage ──

class TriageSession(Base):
    __tablename__ = "triage_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="in_progress",
    )  # in_progress, completed, expired
    chief_complaint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="triage_sessions")
    answers = relationship("TriageAnswer", back_populates="triage_session", cascade="all, delete-orphan")
    photos = relationship("TriagePhoto", back_populates="triage_session", cascade="all, delete-orphan")
    photo_requests = relationship("TriagePhotoRequest", back_populates="triage_session", cascade="all, delete-orphan")
    result = relationship("TriageResult", back_populates="triage_session", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_triage_sessions_patient_created", "patient_id", "created_at"),
    )


class TriageAnswer(Base):
    __tablename__ = "triage_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    triage_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("triage_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    question_key: Mapped[str] = mapped_column(String(100), nullable=False)
    answer_value: Mapped[str] = mapped_column(Text, nullable=False)  # JSON-encoded

    triage_session = relationship("TriageSession", back_populates="answers")


class TriagePhoto(Base):
    """Private, clinician-review photograph attached to a triage session."""
    __tablename__ = "triage_photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    triage_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("triage_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    view_type: Mapped[str] = mapped_column(String(20), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    technical_check_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    triage_session = relationship("TriageSession", back_populates="photos")

    __table_args__ = (
        Index("ix_triage_photos_session_created", "triage_session_id", "created_at"),
    )


class TriagePhotoRequest(Base):
    """A linked clinician asks the patient for one specific photographic view."""
    __tablename__ = "triage_photo_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    triage_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("triage_sessions.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    view_type: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    fulfilled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    triage_session = relationship("TriageSession", back_populates="photo_requests")
    consultation = relationship("Consultation")
    doctor = relationship("Doctor")

    __table_args__ = (
        Index("ix_triage_photo_requests_session_status", "triage_session_id", "status"),
    )


class TriageResult(Base):
    __tablename__ = "triage_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    triage_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("triage_sessions.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    risk_level: Mapped[str] = mapped_column(String(10), nullable=False)  # LOW, MEDIUM, URGENT
    recommended_action: Mapped[str] = mapped_column(String(20), nullable=False)  # SELF_CARE, DOCTOR_24H, DOCTOR_NOW, ER_NOW
    reasoning_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="{}")
    score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    triage_session = relationship("TriageSession", back_populates="result")


# ── Consultation ──

class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    triage_session_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("triage_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    specialty: Mapped[str] = mapped_column(String(100), nullable=False, default="clinica_geral")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="requested",
    )  # requested, scheduled, in_progress, completed, cancelled, no_show
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, paid, waived
    payment_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    patient = relationship("Patient", back_populates="consultations", foreign_keys=[patient_id])
    doctor = relationship("Doctor", back_populates="consultations", foreign_keys=[doctor_id])
    notes = relationship("ConsultationNotes", back_populates="consultation", uselist=False, cascade="all, delete-orphan")
    prescriptions = relationship("Prescription", back_populates="consultation", cascade="all, delete-orphan")
    referrals = relationship("Referral", back_populates="consultation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_consultations_patient_scheduled", "patient_id", "scheduled_at"),
        Index("ix_consultations_doctor_scheduled", "doctor_id", "scheduled_at"),
    )


class ConsultationNotes(Base):
    __tablename__ = "consultation_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False, unique=True,
    )
    doctor_id: Mapped[str] = mapped_column(String(36), nullable=False)
    subjective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    objective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    outcome: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # resolved, follow_up, referral, er
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    consultation = relationship("Consultation", back_populates="notes")


# ── Prescription & Referral ──

class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    medications_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_storage_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    consultation = relationship("Consultation", back_populates="prescriptions")


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    destination: Mapped[str] = mapped_column(String(200), nullable=False)
    specialty: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    urgency: Mapped[str] = mapped_column(String(20), nullable=False, default="routine")  # routine, urgent, emergency
    file_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_storage_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    consultation = relationship("Consultation", back_populates="referrals")


# ── Corporate ──

class CorporateAccount(Base):
    __tablename__ = "corporate_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    contact_email: Mapped[str] = mapped_column(String, nullable=False)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    plan: Mapped[str] = mapped_column(String(30), nullable=False, default="corporate")  # corporate
    max_employees: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    admin_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    members = relationship("CorporateMember", back_populates="corporate_account", cascade="all, delete-orphan")


class CorporateMember(Base):
    __tablename__ = "corporate_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    corporate_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("corporate_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    employee_code_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    corporate_account = relationship("CorporateAccount", back_populates="members")
    patient = relationship("Patient")


# ── Patient Consent ──

class PatientConsent(Base):
    __tablename__ = "patient_consents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    consent_type: Mapped[str] = mapped_column(String(50), nullable=False)  # privacy_policy, telemedicine_consent, terms_of_service
    accepted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    patient = relationship("Patient", back_populates="consents")


# ── Health Payment (extends existing Payment concept) ──

class HealthPayment(Base):
    __tablename__ = "health_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    corporate_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    consultation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    payment_type: Mapped[str] = mapped_column(String(30), nullable=False, default="consultation")  # consultation, subscription
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # in smallest currency unit
    currency: Mapped[str] = mapped_column(String(5), nullable=False, default="AOA")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, paid, failed, refunded
    provider: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    provider_reference: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ── Health Audit Log (specific to health actions) ──

class HealthAuditLog(Base):
    __tablename__ = "health_audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    actor_user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_health_audit_logs_created_at", "created_at"),
    )


# ── Prescription Renewal Request (patient → doctor) ──────────────────────────

class PrescriptionRequest(Base):
    """A patient asks a doctor to renew/prescribe a medication without a consultation."""
    __tablename__ = "prescription_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id: Mapped[str] = mapped_column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    medication_name: Mapped[str] = mapped_column(String(300), nullable=False)
    dose: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    frequency: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # pending | approved | adjusted | consult_requested | exams_requested | rejected
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    risk_level: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)   # low | medium | high
    risk_alert: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    doctor_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    adjusted_dose: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    adjusted_frequency: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    patient = relationship("Patient", backref="prescription_requests")
    doctor = relationship("Doctor", backref="prescription_requests")


# ── Standalone Prescription (issued from a prescription request, no consultation) ──

class StandalonePrescription(Base):
    """Formal prescription document created when a doctor approves/adjusts a prescription request.

    Unlike ``Prescription``, which is always tied to a consultation, this record
    is created from a ``PrescriptionRequest`` so patients have a real pharmacy-ready
    document even when no live consultation took place.
    """
    __tablename__ = "standalone_prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    prescription_request_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescription_requests.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id: Mapped[str] = mapped_column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    medication_name: Mapped[str] = mapped_column(String(300), nullable=False)
    dosage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    frequency: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    duration: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    issue_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # pending_pharmacy | available | dispensed
    pharmacy_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending_pharmacy")
    file_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    prescription_request = relationship("PrescriptionRequest", backref="standalone_prescription", uselist=False)
    patient = relationship("Patient", backref="standalone_prescriptions")
    doctor = relationship("Doctor", backref="standalone_prescriptions")


# ── Device Reading (patient home monitoring) ──────────────────────────────────

READING_TYPES = (
    "blood_pressure",
    "glucose",
    "temperature",
    "oxygen_saturation",
    "weight",
    "heart_rate",
    "body_fat",
    "bmi",
    "lean_body_mass",
    "body_water_mass",
    "bone_mass",
    "height",
    "waist_circumference",
    "basal_metabolic_rate",
)


class DeviceReading(Base):
    """Manual health measurement entered by a patient from a home device."""
    __tablename__ = "device_readings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # one of READING_TYPES
    reading_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    # Generic value + unit (glucose, temperature, oxygen_saturation, weight, heart_rate)
    value: Mapped[Optional[float]] = mapped_column(Numeric(10, 4), nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Blood-pressure specific
    systolic: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    diastolic: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    pulse: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # When and how
    measured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, default="manual")
    external_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    device_brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    device_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    patient = relationship("Patient", backref="device_readings")

    __table_args__ = (
        Index("ix_device_readings_patient_measured", "patient_id", "measured_at"),
        Index(
            "uq_device_readings_patient_source_external",
            "patient_id", "source", "external_id",
            unique=True,
        ),
    )


# ── Patient Medication (patient-reported current medications) ─────────────────

class PatientMedication(Base):
    """Self-reported medication entry by a patient."""
    __tablename__ = "patient_medications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    medication_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    frequency: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    start_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)   # ISO date string
    end_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    prescribed_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    patient = relationship("Patient", backref="medications_list")


# ── Family Member (patient-linked profiles for dependents/relatives) ──────────

class FamilyMember(Base):
    """A family member or dependent linked to a patient's account."""
    __tablename__ = "family_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)   # filho, filha, pai, mãe, cônjuge, outro
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)   # ISO date YYYY-MM-DD
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    emergency_contact: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False,
    )

    owner = relationship("Patient", backref="family_members")


# ── In-App Notification ───────────────────────────────────────────────────────

class Notification(Base):
    """In-app notification stored per user. Supports future push/email expansion."""
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # info | success | warning | error
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Optional: link back to the entity that triggered this (e.g. consultation, prescription_request)
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="notifications")

    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )


# ── Doctor / Clinic Application (public "become a partner" form) ──────────────

class DoctorApplication(Base):
    """A prospective clinician or clinic applies to join KAYA (admin reviews,
    then sends a doctor invite). No account is created at this stage."""
    __tablename__ = "doctor_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    applicant_type: Mapped[str] = mapped_column(String(20), nullable=False, default="medico")  # medico | especialista | clinica
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    specialty: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    org_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    license_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # new | reviewing | invited | rejected
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_doctor_applications_status_created", "status", "created_at"),
    )


# ── Consultation Message (patient ↔ doctor teleconsult chat) ─────────────────

class ConsultationMessage(Base):
    """A text message exchanged between a patient and the assigned doctor within
    a consultation thread — the pilot's text-based teleconsult channel."""
    __tablename__ = "consultation_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    sender_role: Mapped[str] = mapped_column(String(10), nullable=False)   # patient | doctor
    sender_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_consultation_messages_consult_created", "consultation_id", "created_at"),
    )


# ── Doctor Review (patient rates doctor after a completed consultation) ───────

class DoctorReview(Base):
    __tablename__ = "doctor_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    doctor_id: Mapped[str] = mapped_column(String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    consultation_id: Mapped[str] = mapped_column(String(36), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False, unique=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)   # 1..5
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
