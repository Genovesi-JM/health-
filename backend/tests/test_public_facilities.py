"""Public facility-directory (clinic/hospital map) endpoint tests."""
from __future__ import annotations

from app.health_models import OrganisationLocation, OrganisationProfile
from app.models import User


def _make_org(db_session, *, status: str, org_type: str = "clinic",
              name: str = "Clínica Central", lat=-8.839, lon=13.289, city="Luanda"):
    owner = User(email=f"owner-{name}@example.com", role="clinic", password_hash="x")
    db_session.add(owner)
    db_session.flush()
    org = OrganisationProfile(
        owner_user_id=owner.id, org_type=org_type, legal_name=name,
        registration_number=f"REG-{name}", country="AO", status=status,
    )
    db_session.add(org)
    db_session.flush()
    loc = OrganisationLocation(
        organisation_id=org.id, name=name, address="Rua 1", city=city,
        latitude=lat, longitude=lon, emergency_available=True,
    )
    db_session.add(loc)
    db_session.commit()
    return org, loc


def test_lists_verified_geocoded_facilities(client, db_session):
    _make_org(db_session, status="verified", name="Hospital Verificado")
    r = client.get("/api/v1/public/facilities")
    assert r.status_code == 200, r.text
    names = [f["org_name"] for f in r.json()]
    assert "Hospital Verificado" in names
    row = next(f for f in r.json() if f["org_name"] == "Hospital Verificado")
    assert row["latitude"] is not None and row["longitude"] is not None
    assert row["org_type_label"]  # human label present


def test_hides_unverified_organisations(client, db_session):
    _make_org(db_session, status="draft", name="Clínica Rascunho")
    r = client.get("/api/v1/public/facilities")
    assert r.status_code == 200
    assert all(f["org_name"] != "Clínica Rascunho" for f in r.json())


def test_hides_facilities_without_coordinates(client, db_session):
    owner = User(email="nogeo@example.com", role="clinic", password_hash="x")
    db_session.add(owner)
    db_session.flush()
    org = OrganisationProfile(
        owner_user_id=owner.id, org_type="clinic", legal_name="Sem Coordenadas",
        registration_number="REG-NOGEO", country="AO", status="verified",
    )
    db_session.add(org)
    db_session.flush()
    db_session.add(OrganisationLocation(organisation_id=org.id, name="Sem Coordenadas", city="Luanda"))
    db_session.commit()

    r = client.get("/api/v1/public/facilities")
    assert r.status_code == 200
    assert all(f["org_name"] != "Sem Coordenadas" for f in r.json())


def test_filters_by_org_type(client, db_session):
    _make_org(db_session, status="verified", org_type="laboratory", name="Lab Alfa", lat=-8.8, lon=13.2)
    _make_org(db_session, status="verified", org_type="clinic", name="Clínica Beta", lat=-8.9, lon=13.3)
    r = client.get("/api/v1/public/facilities", params={"org_type": "laboratory"})
    assert r.status_code == 200
    types = {f["org_type"] for f in r.json()}
    assert types == {"laboratory"} or ("clinic" not in types)
    assert any(f["org_name"] == "Lab Alfa" for f in r.json())
