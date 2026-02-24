from __future__ import annotations
"""Pydantic schemas for the Health Platform domain.

Covers: Patient, Doctor, Triage, Consultation, Prescription, Referral,
Corporate, Billing, Compliance, and Dashboard KPIs.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Roles ──

class RoleEnum:
    PATIENT = "patient"
    DOCTOR = "doctor"
    CORPORATE_ADMIN = "corporate_admin"
    CORPORATE_ANALYST = "corporate_analyst"
    ADMIN = "admin"
    SUPPORT = "support"

    ALL = [PATIENT, DOCTOR, CORPORATE_ADMIN, CORPORATE_ANALYST, ADMIN, SUPPORT]


# ── Patient ──

class PatientCreate(BaseModel):
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = Field(default_factory=list)
    chronic_conditions: Optional[List[str]] = Field(default_factory=list)
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientUpdate(BaseModel):
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientOut(BaseModel):
    id: str
    user_id: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = Field(default_factory=list)
    chronic_conditions: Optional[List[str]] = Field(default_factory=list)
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Doctor ──

class DoctorCreate(BaseModel):
    license_number: str = Field(..., min_length=3)
    specialization: str = Field(default="clinica_geral")
    bio: Optional[str] = None


class DoctorUpdate(BaseModel):
    specialization: Optional[str] = None
    bio: Optional[str] = None


class DoctorOut(BaseModel):
    id: str
    user_id: str
    license_number: str
    specialization: str
    bio: Optional[str] = None
    verification_status: str
    verified_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DoctorPublic(BaseModel):
    """Minimal doctor info shown to patients."""
    id: str
    specialization: str
    verification_status: str

    model_config = {"from_attributes": True}


class DoctorVerifyRequest(BaseModel):
    action: str = Field(..., pattern="^(verify|reject|suspend)$")
    reason: Optional[str] = None


# ── Doctor Availability ──

class AvailabilitySlot(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    is_active: bool = True


class AvailabilityOut(BaseModel):
    id: str
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool

    model_config = {"from_attributes": True}


# ── Triage ──

class TriageStartRequest(BaseModel):
    chief_complaint: Optional[str] = None


class TriageStartResponse(BaseModel):
    triage_id: str
    status: str
    questions: List[dict]  # list of question objects


class TriageAnswerSubmit(BaseModel):
    answers: List[dict] = Field(
        ..., description="List of {question_key: str, answer: str|int|bool}"
    )


class TriageResultOut(BaseModel):
    triage_id: str
    risk_level: str  # LOW, MEDIUM, URGENT
    recommended_action: str  # SELF_CARE, DOCTOR_24H, DOCTOR_NOW, ER_NOW
    score: float
    reasoning: Optional[dict] = None
    disclaimer: str = (
        "Este resultado NÃO constitui diagnóstico médico. "
        "Em caso de emergência, dirija-se ao serviço de urgência mais próximo."
    )

    model_config = {"from_attributes": True}


class TriageHistoryItem(BaseModel):
    id: str
    status: str
    chief_complaint: Optional[str] = None
    risk_level: Optional[str] = None
    recommended_action: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Consultation ──

class ConsultationBookRequest(BaseModel):
    triage_session_id: Optional[str] = None
    specialty: str = Field(default="clinica_geral")
    scheduled_at: Optional[datetime] = None
    next_available: bool = False


class ConsultationOut(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    triage_session_id: Optional[str] = None
    specialty: str
    status: str
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    payment_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConsultationCompleteRequest(BaseModel):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    outcome: str = Field(default="resolved", pattern="^(resolved|follow_up|referral|er)$")


class ConsultationCancelRequest(BaseModel):
    reason: Optional[str] = None


class ConsultationQueueItem(BaseModel):
    """Item in the doctor's unassigned queue (minimal patient info)."""
    id: str
    specialty: str
    status: str
    risk_level: Optional[str] = None
    chief_complaint: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Prescription ──

class MedicationItem(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: Optional[str] = None
    notes: Optional[str] = None


class PrescriptionCreate(BaseModel):
    medications: List[MedicationItem]
    instructions: Optional[str] = None


class PrescriptionOut(BaseModel):
    id: str
    consultation_id: str
    medications: List[dict]
    instructions: Optional[str] = None
    file_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Referral ──

class ReferralCreate(BaseModel):
    destination: str
    specialty: Optional[str] = None
    reason: Optional[str] = None
    urgency: str = Field(default="routine", pattern="^(routine|urgent|emergency)$")


class ReferralOut(BaseModel):
    id: str
    consultation_id: str
    destination: str
    specialty: Optional[str] = None
    reason: Optional[str] = None
    urgency: str
    file_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Corporate ──

class CorporateAccountCreate(BaseModel):
    company_name: str = Field(..., min_length=2)
    tax_id: Optional[str] = None
    contact_email: str
    contact_phone: Optional[str] = None
    max_employees: int = Field(default=50, ge=1)


class CorporateAccountOut(BaseModel):
    id: str
    company_name: str
    tax_id: Optional[str] = None
    contact_email: str
    plan: str
    max_employees: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CorporateEnrollRequest(BaseModel):
    patient_id: str
    employee_code: Optional[str] = None


class CorporateKPIOut(BaseModel):
    employees_covered: int
    consultations_total: int
    consultations_per_100: float
    triage_distribution: dict  # {LOW: n, MEDIUM: n, URGENT: n}
    resolution_rate: float  # % completed without referral
    referral_rate: float
    top_specialties: List[dict]


# ── Billing ──

class ConsultCheckoutRequest(BaseModel):
    consultation_id: str
    payment_method: Optional[str] = None  # multicaixa_express, visa_mastercard, etc.


class ConsultCheckoutResponse(BaseModel):
    payment_id: str
    status: str
    amount: int
    currency: str
    redirect_url: Optional[str] = None


class InvoiceOut(BaseModel):
    id: str
    payment_type: str
    amount: int
    currency: str
    status: str
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Compliance / Consent ──

class ConsentRequest(BaseModel):
    consent_type: str = Field(
        ..., pattern="^(privacy_policy|telemedicine_consent|terms_of_service)$"
    )


class ConsentOut(BaseModel):
    id: str
    consent_type: str
    accepted_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard KPIs ──

class HealthKPIResponse(BaseModel):
    total_consultations: int
    triage_distribution: dict
    resolution_rate: float
    referral_rate: float
    avg_time_to_accept_minutes: Optional[float] = None
    revenue_monthly: Optional[float] = None


class AdminDashboardResponse(BaseModel):
    pending_verifications: int
    flagged_triage_sessions: int
    total_audit_events: int
    total_consultations: int
    total_patients: int
    total_doctors: int
    revenue_this_month: Optional[float] = None


class FileDownloadResponse(BaseModel):
    file_id: str
    download_url: str
    filename: str
    expires_in_seconds: int = 3600
