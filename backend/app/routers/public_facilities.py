from __future__ import annotations
"""Public facility directory that powers the clinic / hospital map.

Exposes the physical locations of *verified* organisations (clinics,
hospitals, laboratories, pharmacies) that have been geocoded, so the public
website can render them on a map. Public (no auth); the global rate-limit
middleware protects it. Only non-sensitive location data is returned — never
banking, registration, or tax details.

    GET /api/v1/public/facilities        list mappable facilities (public)
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.health_models import OrganisationLocation, OrganisationProfile

router = APIRouter(prefix="/api/v1/public", tags=["public"])

_ORG_TYPE_LABELS = {
    "clinic": "Clínica / Hospital",
    "laboratory": "Laboratório",
    "pharmacy_org": "Farmácia",
    "health_org": "Organização de saúde",
}


@router.get("/facilities")
def list_facilities(
    org_type: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Verified organisations' geocoded locations for the public map."""
    q = (
        db.query(OrganisationLocation, OrganisationProfile)
        .join(OrganisationProfile, OrganisationLocation.organisation_id == OrganisationProfile.id)
        .filter(
            OrganisationProfile.status == "verified",
            OrganisationLocation.latitude.isnot(None),
            OrganisationLocation.longitude.isnot(None),
        )
    )
    if org_type:
        q = q.filter(OrganisationProfile.org_type == org_type)
    if city:
        q = q.filter(OrganisationLocation.city.ilike(f"%{city}%"))

    rows = q.order_by(OrganisationLocation.city.asc()).limit(500).all()

    out = []
    for loc, org in rows:
        services = [s.strip() for s in (loc.services or "").split(",") if s.strip()]
        out.append({
            "id": loc.id,
            "organisation_id": org.id,
            "org_type": org.org_type,
            "org_type_label": _ORG_TYPE_LABELS.get(org.org_type, org.org_type),
            "org_name": org.trading_name or org.legal_name,
            "name": loc.name,
            "address": loc.address,
            "city": loc.city,
            "latitude": float(loc.latitude) if loc.latitude is not None else None,
            "longitude": float(loc.longitude) if loc.longitude is not None else None,
            "opening_hours": loc.opening_hours,
            "services": services,
            "emergency_available": loc.emergency_available,
            "home_delivery": loc.home_delivery,
            "home_sample_collection": loc.home_sample_collection,
            "contact_phone": loc.contact_phone,
        })
    return out
