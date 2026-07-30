from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CredentialUpsert(BaseModel):
    profession: str
    legal_name: str = Field(min_length=2, max_length=200)
    nationality_country: Optional[str] = None
    practice_country: str = "AO"
    licence_country: str
    licence_jurisdiction: Optional[str] = Field(default=None, max_length=120)
    issuing_authority: str = Field(min_length=2, max_length=200)
    licence_number: str = Field(min_length=2, max_length=100)
    licence_expiry_date: Optional[str] = None
    diploma_country: str
    diploma_institution: str = Field(min_length=2, max_length=250)
    degree_title: str = Field(min_length=2, max_length=200)
    graduation_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    specialization: Optional[str] = None
    registry_profile_url: Optional[str] = None


class CredentialDecision(BaseModel):
    action: str
    notes: Optional[str] = None


class ProviderStartRequest(BaseModel):
    consent: bool
    providers: list[str] = Field(default_factory=lambda: ["azure", "persona", "dataflow"])


class EvidenceOut(BaseModel):
    id: str
    kind: str
    original_filename: str
    content_type: str
    size_bytes: int
    sha256: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CredentialOut(BaseModel):
    id: str
    user_id: str
    profession: str
    legal_name: str
    nationality_country: Optional[str] = None
    practice_country: str
    licence_country: str
    licence_jurisdiction: Optional[str] = None
    issuing_authority: str
    licence_number: str
    licence_expiry_date: Optional[str] = None
    diploma_country: str
    diploma_institution: str
    degree_title: str
    graduation_year: Optional[int] = None
    specialization: Optional[str] = None
    registry_profile_url: Optional[str] = None
    status: str
    automated_score: int
    automated_checks: list[dict] = Field(default_factory=list)
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verification_consent_at: Optional[datetime] = None
    provider_checks: list[dict] = Field(default_factory=list)
    evidence: list[EvidenceOut] = Field(default_factory=list)
    registry: Optional[dict] = None
    missing_evidence: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}
