"""Immutable clinical document decisions and exact bytes for safe delivery retries."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClinicalDocumentRequest(Base):
    __tablename__ = 'clinical_document_requests'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    actor_user_id: Mapped[str] = mapped_column(String(36), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False)
    doctor_id: Mapped[str] = mapped_column(String(36), ForeignKey('doctors.id', ondelete='RESTRICT'), nullable=False)
    patient_id: Mapped[str] = mapped_column(String(36), ForeignKey('patients.id', ondelete='RESTRICT'), nullable=False)
    consultation_id: Mapped[str] = mapped_column(String(36), ForeignKey('consultations.id', ondelete='RESTRICT'), nullable=False)
    episode_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey('consultation_consent_snapshots.id', ondelete='RESTRICT'), nullable=False)
    prescription_id: Mapped[str | None] = mapped_column(String(36), ForeignKey('prescriptions.id', ondelete='RESTRICT'), nullable=True)
    referral_id: Mapped[str | None] = mapped_column(String(36), ForeignKey('referrals.id', ondelete='RESTRICT'), nullable=True)
    kind: Mapped[str] = mapped_column(String(12), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    consent_language: Mapped[str] = mapped_column(String(10), nullable=False)
    request_key: Mapped[str] = mapped_column(String(36), nullable=False)
    request_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    request_json: Mapped[str] = mapped_column(Text, nullable=False)
    grant_ids_json: Mapped[str] = mapped_column(Text, nullable=False)
    clinician_evidence_json: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(200), nullable=False)
    pdf_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    pdf_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index('uq_clinical_document_actor_key', 'actor_user_id', 'request_key', unique=True),
        Index('uq_clinical_document_prescription', 'prescription_id', unique=True),
        Index('uq_clinical_document_referral', 'referral_id', unique=True),
        CheckConstraint("(kind='prescription' AND prescription_id IS NOT NULL AND referral_id IS NULL) OR (kind='referral' AND referral_id IS NOT NULL AND prescription_id IS NULL)", name='ck_clinical_document_kind'),
    )


from app.services.clinical_document_retention import register_document_guards
register_document_guards(Base.metadata)
