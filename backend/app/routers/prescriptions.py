"""
Prescriptions & Referrals Router — Generate and download documents.

Endpoints:
- POST /api/v1/consultations/{id}/prescription — Generate prescription
- POST /api/v1/consultations/{id}/referral — Generate referral
- GET  /api/v1/files/{file_id} — Download document via signed URL
"""
import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserProfile
from app.health_models import (
    Patient, Doctor, Consultation, Prescription, Referral,
)
from app.health_schemas import (
    PrescriptionCreate, PrescriptionOut, ReferralCreate, ReferralOut,
    FileDownloadResponse, RoleEnum,
)
from app.rbac import require_verified_doctor, log_health_audit
from app.services.pdf_generator import generate_prescription_pdf, generate_referral_pdf
from app.services.health_storage import get_health_storage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["prescriptions"])


@router.post("/api/v1/consultations/{consultation_id}/prescription", response_model=PrescriptionOut)
def create_prescription(
    consultation_id: str,
    body: PrescriptionCreate,
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Generate a prescription for a completed consultation (doctor only)."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        Consultation.doctor_id == doctor.id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada ou não atribuída a si.")
    if consultation.status != "completed":
        raise HTTPException(status_code=400, detail="Consulta deve estar completada para gerar receita.")

    # Get patient and doctor names
    patient = db.query(Patient).filter(Patient.id == consultation.patient_id).first()
    patient_profile = db.query(UserProfile).filter(UserProfile.user_id == patient.user_id).first() if patient else None
    doctor_profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

    patient_name = patient_profile.full_name if patient_profile else "Paciente"
    patient_dob = patient.date_of_birth if patient else None
    doctor_name = doctor_profile.full_name if doctor_profile else "Médico"

    medications_list = [m.model_dump() for m in body.medications]

    # Generate PDF
    pdf_bytes = generate_prescription_pdf(
        patient_name=patient_name,
        patient_dob=patient_dob,
        doctor_name=doctor_name,
        doctor_license=doctor.license_number,
        medications=medications_list,
        instructions=body.instructions,
    )

    # Upload to storage
    storage = get_health_storage()
    storage_key, file_url = storage.upload_bytes(
        pdf_bytes,
        category="prescriptions",
        filename=f"rx_{consultation_id}.pdf",
    )

    prescription = Prescription(
        consultation_id=consultation_id,
        medications_json=json.dumps(medications_list),
        instructions=body.instructions,
        file_url=file_url,
        file_storage_key=storage_key,
    )
    db.add(prescription)
    db.commit()
    db.refresh(prescription)

    log_health_audit(
        db,
        action="prescription_generated",
        actor_user_id=user.id,
        resource_type="prescription",
        resource_id=prescription.id,
    )

    return PrescriptionOut(
        id=prescription.id,
        consultation_id=prescription.consultation_id,
        medications=medications_list,
        instructions=prescription.instructions,
        file_url=file_url,
        created_at=prescription.created_at,
    )


@router.post("/api/v1/consultations/{consultation_id}/referral", response_model=ReferralOut)
def create_referral(
    consultation_id: str,
    body: ReferralCreate,
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Generate a referral for a completed consultation (doctor only)."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Perfil de médico não encontrado.")

    consultation = db.query(Consultation).filter(
        Consultation.id == consultation_id,
        Consultation.doctor_id == doctor.id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    if consultation.status != "completed":
        raise HTTPException(status_code=400, detail="Consulta deve estar completada.")

    # Get names
    patient = db.query(Patient).filter(Patient.id == consultation.patient_id).first()
    patient_profile = db.query(UserProfile).filter(UserProfile.user_id == patient.user_id).first() if patient else None
    doctor_profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

    patient_name = patient_profile.full_name if patient_profile else "Paciente"
    patient_dob = patient.date_of_birth if patient else None
    doctor_name = doctor_profile.full_name if doctor_profile else "Médico"

    # Generate PDF
    pdf_bytes = generate_referral_pdf(
        patient_name=patient_name,
        patient_dob=patient_dob,
        doctor_name=doctor_name,
        doctor_license=doctor.license_number,
        destination=body.destination,
        specialty=body.specialty,
        reason=body.reason,
        urgency=body.urgency,
    )

    storage = get_health_storage()
    storage_key, file_url = storage.upload_bytes(
        pdf_bytes,
        category="referrals",
        filename=f"ref_{consultation_id}.pdf",
    )

    referral = Referral(
        consultation_id=consultation_id,
        destination=body.destination,
        specialty=body.specialty,
        reason=body.reason,
        urgency=body.urgency,
        file_url=file_url,
        file_storage_key=storage_key,
    )
    db.add(referral)
    db.commit()
    db.refresh(referral)

    log_health_audit(
        db,
        action="referral_generated",
        actor_user_id=user.id,
        resource_type="referral",
        resource_id=referral.id,
    )

    return referral


# ═══════════════════════════════════════════════════════════════
# File download endpoint
# ═══════════════════════════════════════════════════════════════

@router.get("/api/v1/files/{file_id}", response_model=FileDownloadResponse)
def download_file(
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a signed download URL for a prescription or referral."""
    # Check prescriptions
    prescription = db.query(Prescription).filter(Prescription.id == file_id).first()
    if prescription:
        # Verify access
        consultation = db.query(Consultation).filter(
            Consultation.id == prescription.consultation_id,
        ).first()
        if not _has_document_access(user, consultation, db):
            raise HTTPException(status_code=403, detail="Sem permissão.")

        if not prescription.file_storage_key:
            raise HTTPException(status_code=404, detail="Ficheiro não disponível.")

        storage = get_health_storage()
        url = storage.get_signed_url(prescription.file_storage_key)
        return FileDownloadResponse(
            file_id=file_id,
            download_url=url,
            filename=f"receita_{prescription.id}.pdf",
        )

    # Check referrals
    referral = db.query(Referral).filter(Referral.id == file_id).first()
    if referral:
        consultation = db.query(Consultation).filter(
            Consultation.id == referral.consultation_id,
        ).first()
        if not _has_document_access(user, consultation, db):
            raise HTTPException(status_code=403, detail="Sem permissão.")

        if not referral.file_storage_key:
            raise HTTPException(status_code=404, detail="Ficheiro não disponível.")

        storage = get_health_storage()
        url = storage.get_signed_url(referral.file_storage_key)
        return FileDownloadResponse(
            file_id=file_id,
            download_url=url,
            filename=f"referencia_{referral.id}.pdf",
        )

    raise HTTPException(status_code=404, detail="Documento não encontrado.")


def _has_document_access(user: User, consultation, db: Session) -> bool:
    """Check if user has access to a consultation's documents."""
    if not consultation:
        return False
    if user.role in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        return True
    if user.role == RoleEnum.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        return patient and consultation.patient_id == patient.id
    if user.role == RoleEnum.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        return doctor and consultation.doctor_id == doctor.id
    return False
