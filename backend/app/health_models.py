from __future__ import annotations
# app/health_models.py
"""
Health Platform Domain Models — Digital Triage & Teleconsultation

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


# ── Doctor Profile (extends User) ──

class Doctor(Base):
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    license_number: Mapped[str] = mapped_column(String(100), nullable=False)
    specialization: Mapped[str] = mapped_column(String(100), nullable=False, default="clinica_geral")
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending",
    )  # pending, verified, rejected, suspended
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    document_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # license scan
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", backref="doctor_profile")
    availability_slots = relationship("DoctorAvailability", back_populates="doctor", cascade="all, delete-orphan")
    consultations = relationship("Consultation", back_populates="doctor", foreign_keys="Consultation.doctor_id")

    __table_args__ = (
        Index("ix_doctors_verification_status", "verification_status"),
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

    __table_args__ = (
        Index("ix_corporate_members_corporate_id", "corporate_id"),
    )


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
