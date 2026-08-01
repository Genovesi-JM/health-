from __future__ import annotations
"""Organisation onboarding — clinic / laboratory / pharmacy / health org (§8).

Kaya owns the organisational profile, multi-location model, document store,
and verification workflow. External providers (Azure DI for document
extraction, business-verification vendors) plug in through the same
provider interfaces used for clinicians; this router is the profile +
workflow surface.

    POST /api/v1/organisations                 create / upsert own profile
    GET  /api/v1/organisations/me              read own profile (+ locations, docs)
    PUT  /api/v1/organisations/me              update own profile
    POST /api/v1/organisations/me/locations    add a location
    DELETE /api/v1/organisations/me/locations/{id}
    POST /api/v1/organisations/me/documents/{kind}   upload a document
    POST /api/v1/organisations/me/submit       submit for compliance review
"""
import hashlib
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_current_user
from app.health_models import (
    OrganisationDocument,
    OrganisationLocation,
    OrganisationProfile,
)
from app.models import User
from app.services.health_storage import get_health_storage
from app.services.verification.state_machine import (
    InvalidTransitionError,
    record_transition,
)

router = APIRouter(prefix="/api/v1/organisations", tags=["organisations"])

ENTITY_TYPE = "organisation_profile"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MIME_SIGNATURES = {
    "application/pdf": (b"%PDF-",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}
ORG_TYPES = {"clinic", "laboratory", "pharmacy_org", "health_org"}
DOC_KINDS = {
    "business_registration", "tax_certificate", "operating_licence",
    "healthcare_licence", "pharmacy_licence", "lab_accreditation",
    "insurance", "ownership", "responsible_professional",
}


# ── Request bodies ──────────────────────────────────────────────────────────

class OrgUpsert(BaseModel):
    org_type: str
    legal_name: str = Field(..., min_length=2)
    trading_name: Optional[str] = None
    registration_number: str = Field(..., min_length=2)
    tax_number: Optional[str] = None
    country: str = "AO"
    registered_address: Optional[str] = None
    operating_address: Optional[str] = None
    website: Optional[str] = None
    general_email: Optional[str] = None
    general_phone: Optional[str] = None
    representative_name: Optional[str] = None
    responsible_professional: Optional[str] = None
    bank_holder_name: Optional[str] = None
    iban: Optional[str] = None
    subscription_plan: Optional[str] = None
    integration: dict = Field(default_factory=dict)


class LocationBody(BaseModel):
    name: str = Field(..., min_length=1)
    address: Optional[str] = None
    city: Optional[str] = None
    opening_hours: Optional[str] = None
    services: Optional[str] = None
    emergency_available: bool = False
    home_delivery: bool = False
    home_sample_collection: bool = False
    contact_phone: Optional[str] = None
    manager_name: Optional[str] = None


# ── Serialisers ─────────────────────────────────────────────────────────────

def _serialize(org: OrganisationProfile) -> dict:
    import json
    return {
        "id": org.id,
        "org_type": org.org_type,
        "legal_name": org.legal_name,
        "trading_name": org.trading_name,
        "registration_number": org.registration_number,
        "tax_number": org.tax_number,
        "country": org.country,
        "registered_address": org.registered_address,
        "operating_address": org.operating_address,
        "website": org.website,
        "general_email": org.general_email,
        "general_phone": org.general_phone,
        "representative_name": org.representative_name,
        "responsible_professional": org.responsible_professional,
        "bank_holder_name": org.bank_holder_name,
        # Never return the full IBAN — only the last 4 saved.
        "iban_last4": org.iban_last4,
        "subscription_plan": org.subscription_plan,
        "integration": json.loads(org.integration_json or "{}"),
        "status": org.status,
        "submitted_at": org.submitted_at,
        "verified_at": org.verified_at,
        "locations": [
            {
                "id": loc.id, "name": loc.name, "address": loc.address, "city": loc.city,
                "opening_hours": loc.opening_hours, "services": loc.services,
                "emergency_available": loc.emergency_available,
                "home_delivery": loc.home_delivery,
                "home_sample_collection": loc.home_sample_collection,
                "contact_phone": loc.contact_phone, "manager_name": loc.manager_name,
            }
            for loc in (org.locations or [])
        ],
        "documents": [
            {"id": d.id, "kind": d.kind, "filename": d.original_filename, "uploaded_at": d.created_at}
            for d in (org.documents or [])
        ],
    }


def _get_own(db: Session, user_id: str) -> Optional[OrganisationProfile]:
    return (
        db.query(OrganisationProfile)
        .options(joinedload(OrganisationProfile.locations), joinedload(OrganisationProfile.documents))
        .filter(OrganisationProfile.owner_user_id == user_id)
        .first()
    )


def _require_own(db: Session, user_id: str) -> OrganisationProfile:
    org = _get_own(db, user_id)
    if not org:
        raise HTTPException(404, "Nenhum perfil de organização encontrado.")
    return org


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("")
def create_or_update(
    body: OrgUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import json
    if body.org_type not in ORG_TYPES:
        raise HTTPException(422, f"org_type deve ser um de: {', '.join(sorted(ORG_TYPES))}")

    org = _get_own(db, user.id)
    iban_last4 = (body.iban or "")[-4:] if body.iban else (org.iban_last4 if org else None)

    if org:
        if org.status in ("verified", "suspended"):
            raise HTTPException(409, "O perfil já está fechado para alterações.")
        for f in ("org_type", "legal_name", "trading_name", "registration_number",
                  "tax_number", "country", "registered_address", "operating_address",
                  "website", "general_email", "general_phone", "representative_name",
                  "responsible_professional", "bank_holder_name", "subscription_plan"):
            setattr(org, f, getattr(body, f))
        org.iban_last4 = iban_last4
        org.integration_json = json.dumps(body.integration or {})
        org.status = "draft"
    else:
        org = OrganisationProfile(
            owner_user_id=user.id,
            org_type=body.org_type,
            legal_name=body.legal_name,
            trading_name=body.trading_name,
            registration_number=body.registration_number,
            tax_number=body.tax_number,
            country=body.country,
            registered_address=body.registered_address,
            operating_address=body.operating_address,
            website=body.website,
            general_email=body.general_email,
            general_phone=body.general_phone,
            representative_name=body.representative_name,
            responsible_professional=body.responsible_professional,
            bank_holder_name=body.bank_holder_name,
            iban_last4=iban_last4,
            subscription_plan=body.subscription_plan,
            integration_json=json.dumps(body.integration or {}),
            status="draft",
        )
        db.add(org)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe uma organização com este número de registo neste país.")
    return _serialize(_require_own(db, user.id))


@router.get("/me")
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _serialize(_require_own(db, user.id))


@router.post("/me/locations")
def add_location(
    body: LocationBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _require_own(db, user.id)
    if org.status in ("verified", "suspended"):
        raise HTTPException(409, "O perfil já está fechado para alterações.")
    loc = OrganisationLocation(
        organisation_id=org.id, name=body.name, address=body.address, city=body.city,
        opening_hours=body.opening_hours, services=body.services,
        emergency_available=body.emergency_available, home_delivery=body.home_delivery,
        home_sample_collection=body.home_sample_collection,
        contact_phone=body.contact_phone, manager_name=body.manager_name,
    )
    db.add(loc)
    db.commit()
    return _serialize(_require_own(db, user.id))


@router.delete("/me/locations/{location_id}")
def delete_location(
    location_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _require_own(db, user.id)
    loc = (
        db.query(OrganisationLocation)
        .filter(OrganisationLocation.id == location_id, OrganisationLocation.organisation_id == org.id)
        .first()
    )
    if not loc:
        raise HTTPException(404, "Localização não encontrada.")
    db.delete(loc)
    db.commit()
    return _serialize(_require_own(db, user.id))


@router.post("/me/documents/{kind}")
async def upload_document(
    kind: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if kind not in DOC_KINDS:
        raise HTTPException(422, "Tipo de documento inválido.")
    org = _require_own(db, user.id)
    if org.status in ("verified", "suspended"):
        raise HTTPException(409, "O perfil já está fechado para alterações.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Documento vazio ou superior a 10 MB.")
    content_type = (file.content_type or "").lower()
    signatures = MIME_SIGNATURES.get(content_type)
    if not signatures or not any(data.startswith(sig) for sig in signatures):
        raise HTTPException(415, "Apenas PDF, JPEG ou PNG válidos são aceites.")

    storage = get_health_storage()
    key, _ = storage.upload_bytes(
        data, f"organisations/{org.id}", file.filename or f"{kind}.bin", content_type,
    )
    # Replace any existing document of this kind.
    for prev in [d for d in org.documents if d.kind == kind]:
        db.delete(prev)
    db.add(OrganisationDocument(
        organisation_id=org.id, kind=kind,
        original_filename=(file.filename or f"{kind}.bin")[:250],
        storage_key=key, content_type=content_type,
        sha256=hashlib.sha256(data).hexdigest(),
    ))
    org.status = "draft"
    db.commit()
    return _serialize(_require_own(db, user.id))


@router.post("/me/submit")
def submit_for_review(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = _require_own(db, user.id)
    if org.status == "pending_review":
        return _serialize(org)

    # Minimum bar to submit: a legal name, registration number, and at least
    # one uploaded document + one location.
    missing = []
    if not org.documents:
        missing.append("documents")
    if not org.locations:
        missing.append("locations")
    if missing:
        raise HTTPException(400, {"error": "incomplete", "missing": missing})

    previous = org.status
    org.status = "pending_review"
    org.submitted_at = datetime.utcnow()
    try:
        record_transition(
            db, entity_type=ENTITY_TYPE, entity_id=org.id,
            previous_status=previous, new_status="submitted",
            actor_user_id=user.id, actor_kind="user",
            reason_code="organisation_submitted",
        )
    except InvalidTransitionError:
        pass
    db.commit()
    return _serialize(_require_own(db, user.id))
