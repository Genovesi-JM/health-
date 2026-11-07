from __future__ import annotations
"""Retained, idempotent consultation documents and authorized private downloads."""
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, Doctor, Consultation, Prescription, Referral
from app.health_schemas import PrescriptionOut, ReferralOut, FileDownloadResponse, RoleEnum
from app.rbac import require_verified_doctor
from app.services.clinician_access import require_current_clinician
from app.services.pdf_generator import generate_prescription_pdf, generate_referral_pdf
from app.services.health_storage import get_health_storage
from app.services import clinical_documents
from app.clinical_document_models import ClinicalDocumentRequest

router = APIRouter(tags=['prescriptions'])


class DocumentFields(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class BoundedMedication(DocumentFields):
    name: str = Field(min_length=1, max_length=300)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    duration: str | None = Field(None, max_length=100)
    notes: str | None = Field(None, max_length=1000)


class PrescriptionBody(DocumentFields):
    medications: list[BoundedMedication] = Field(min_length=1, max_length=25)
    instructions: str | None = Field(None, max_length=4000)


class ReferralBody(DocumentFields):
    destination: str = Field(min_length=1, max_length=200)
    specialty: str | None = Field(None, max_length=100)
    reason: str | None = Field(None, max_length=4000)
    urgency: Literal['routine','urgent','emergency'] = 'routine'


class RetainedPrescriptionOut(PrescriptionOut):
    request_key: str
    artifact_status: Literal['pending','ready']
    pdf_sha256: str


class RetainedReferralOut(ReferralOut):
    request_key: str
    artifact_status: Literal['pending','ready']
    pdf_sha256: str


class DocumentReceipt(BaseModel):
    kind: Literal['prescription','referral']
    request_key: str
    document: RetainedPrescriptionOut | RetainedReferralOut


def _private(response):
    response.headers['Cache-Control'] = 'private, no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'


@router.post('/api/v1/consultations/{consultation_id}/prescription', response_model=RetainedPrescriptionOut)
def create_prescription(consultation_id: str, body: PrescriptionBody, response: Response,
        idempotency_key: str = Header(..., alias='Idempotency-Key', max_length=36),
        user: User = Depends(require_verified_doctor), db: Session = Depends(get_db)):
    _private(response)
    return clinical_documents.generate(db,user,consultation_id,'prescription',body.model_dump(),idempotency_key,
        storage_factory=get_health_storage, render=generate_prescription_pdf)


@router.post('/api/v1/consultations/{consultation_id}/referral', response_model=RetainedReferralOut)
def create_referral(consultation_id: str, body: ReferralBody, response: Response,
        idempotency_key: str = Header(..., alias='Idempotency-Key', max_length=36),
        user: User = Depends(require_verified_doctor), db: Session = Depends(get_db)):
    _private(response)
    return clinical_documents.generate(db,user,consultation_id,'referral',body.model_dump(),idempotency_key,
        storage_factory=get_health_storage, render=generate_referral_pdf)


@router.get('/api/v1/consultation-document-requests/{request_key}', response_model=DocumentReceipt)
def document_request(request_key: str, response: Response,
        user: User = Depends(require_verified_doctor), db: Session = Depends(get_db)):
    _private(response)
    return clinical_documents.lookup(db,user,request_key)


# ═══════════════════════════════════════════════════════════════
# File download endpoint
# ═══════════════════════════════════════════════════════════════

@router.get("/api/v1/files/{file_id}", response_model=FileDownloadResponse)
def download_file(
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    response: Response = None,
):
    """Get a signed download URL for a prescription or referral."""
    if response is not None: _private(response)
    # Check prescriptions
    prescription = db.query(Prescription).filter(Prescription.id == file_id).first()
    if prescription:
        # Verify access
        consultation = db.query(Consultation).filter(
            Consultation.id == prescription.consultation_id,
        ).first()
        if not _has_document_access(user, consultation, db):
            raise HTTPException(status_code=403, detail="Sem permissão.")

        retained = db.query(ClinicalDocumentRequest).filter_by(prescription_id=prescription.id).first()
        if retained:
            clinical_documents.verify_request(db, retained)
            if not prescription.file_storage_key:
                raise HTTPException(503, {'code': 'clinical_document_delivery_pending', 'message': 'O ficheiro ainda está a ser preparado.'})
        if not prescription.file_storage_key:
            raise HTTPException(status_code=404, detail="Ficheiro não disponível.")

        storage = get_health_storage()
        if retained: clinical_documents.confirm_stored_pdf(storage, retained)
        url = storage.get_signed_url(prescription.file_storage_key)
        return FileDownloadResponse(
            file_id=file_id,
            download_url=url,
            filename=f"receita_{prescription.id}.pdf",
            expires_in_seconds=storage.get_signed_url_expiry_seconds(),
        )

    # Check referrals
    referral = db.query(Referral).filter(Referral.id == file_id).first()
    if referral:
        consultation = db.query(Consultation).filter(
            Consultation.id == referral.consultation_id,
        ).first()
        if not _has_document_access(user, consultation, db):
            raise HTTPException(status_code=403, detail="Sem permissão.")

        retained = db.query(ClinicalDocumentRequest).filter_by(referral_id=referral.id).first()
        if retained:
            clinical_documents.verify_request(db, retained)
            if not referral.file_storage_key:
                raise HTTPException(503, {'code': 'clinical_document_delivery_pending', 'message': 'O ficheiro ainda está a ser preparado.'})
        if not referral.file_storage_key:
            raise HTTPException(status_code=404, detail="Ficheiro não disponível.")

        storage = get_health_storage()
        if retained: clinical_documents.confirm_stored_pdf(storage, retained)
        url = storage.get_signed_url(referral.file_storage_key)
        return FileDownloadResponse(
            file_id=file_id,
            download_url=url,
            filename=f"referencia_{referral.id}.pdf",
            expires_in_seconds=storage.get_signed_url_expiry_seconds(),
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
        require_current_clinician(user, db)
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        return doctor and consultation.doctor_id == doctor.id
    return False
