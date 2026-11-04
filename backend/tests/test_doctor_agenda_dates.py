"""Clinic-local appointment days across Angola and Portugal time zones."""
from datetime import datetime, timedelta, timezone
import json
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import event

from app.health_models import Consultation, HealthAuditLog
from app.phase1_policy import public_pilot_scope
from app.services.appointments import MARKET_ZONES
from tests.test_consultation_lifecycle import api, people, seed_consultation  # noqa: F401


def test_scheduling_zones_match_the_shared_market_catalog():
    expected = {market["country_code"]: tuple(market["timezones"])
                for market in public_pilot_scope()["planning"]["target_markets"]}
    assert MARKET_ZONES == expected


@pytest.mark.parametrize("country,zone,day", [
    ("AO", "Africa/Luanda", "2027-03-28"),
    ("PT", "Europe/Lisbon", "2027-03-28"),
    ("PT", "Europe/Lisbon", "2027-10-31"),
    ("PT", "Atlantic/Madeira", "2027-10-31"),
    ("PT", "Atlantic/Azores", "2027-10-31"),
])
def test_agenda_uses_local_day_boundaries_and_preserves_instants(api, people, db_session, country, zone, day):
    local = datetime.fromisoformat(day).replace(tzinfo=ZoneInfo(zone))
    start = local.astimezone(timezone.utc).replace(tzinfo=None)
    end = (local + timedelta(days=1)).astimezone(timezone.utc).replace(tzinfo=None)
    rows = []
    for instant in (start - timedelta(minutes=1), start, end - timedelta(minutes=30), end):
        rows.append(seed_consultation(db_session, people, status="scheduled", scheduled_at=instant,
                                     scheduled_end_at=instant + timedelta(minutes=30), country=country, timezone=zone))
    # Another country, another doctor and unscheduled requests cannot leak into this day.
    seed_consultation(db_session, people, status="scheduled", scheduled_at=start,
                      country="PT" if country == "AO" else "AO")
    other = Consultation(patient_id=people["other_patient"]["profile"].id,
                         doctor_id=people["other_doctor"]["profile"].id, scheduled_at=start,
                         status="scheduled", country=country)
    db_session.add(other)
    db_session.commit()
    seed_consultation(db_session, people)
    response = api.get("/api/v1/doctor/agenda/today", params={"date": day, "country": country, "timezone": zone},
                       headers=people["doctor"]["headers"])
    assert response.status_code == 200, response.text
    result = response.json()
    assert [row["id"] for row in result] == [rows[1].id, rows[2].id]
    assert response.headers["cache-control"] == "private, no-store"
    assert result[0]["time"] == start.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zone)).strftime("%H:%M")
    assert datetime.fromisoformat(result[0]["scheduled_at"]) == start.replace(tzinfo=timezone.utc)
    assert result[0]["duration"] == 30
    assert result[0]["country"] == country and result[0]["timezone"] == zone
    audit = db_session.query(HealthAuditLog).filter_by(action="doctor_agenda_read", resource_id=people["doctor"]["profile"].id).one()
    assert json.loads(audit.metadata_json) == {"date": day, "country": country, "timezone": zone}


def test_repeated_portuguese_hour_retains_two_distinct_utc_instants(api, people, db_session):
    first = seed_consultation(db_session, people, status="scheduled", country="PT",
                              scheduled_at=datetime(2027, 10, 31, 0, 30))
    second = seed_consultation(db_session, people, status="scheduled", country="PT",
                               scheduled_at=datetime(2027, 10, 31, 1, 30))
    response = api.get("/api/v1/doctor/agenda/today", params={"date": "2027-10-31", "country": "PT", "timezone": "Europe/Lisbon"},
                       headers=people["doctor"]["headers"])
    assert response.status_code == 200
    result = response.json()
    assert [row["id"] for row in result] == [first.id, second.id]
    assert [row["time"] for row in result] == ["01:30", "01:30"]
    assert result[0]["scheduled_at"] != result[1]["scheduled_at"]
    assert result[0]["duration"] is None  # No invented duration for a legacy record.


def test_legacy_appointment_remains_visible_without_inventing_a_country(api, people, db_session):
    item = seed_consultation(db_session, people, status="scheduled", country=None,
                             scheduled_at=datetime(2027, 1, 1, 12))
    # Unknown legacy country is retained even when viewed in an explicit clinic zone.
    result = api.get("/api/v1/doctor/agenda/today", params={"date": "2027-01-01", "country": "PT", "timezone": "Atlantic/Azores"},
                     headers=people["doctor"]["headers"])
    assert result.status_code == 200, result.text
    row = next(row for row in result.json() if row["id"] == item.id)
    assert row["country"] is None and row["slot_timezone"] is None
    assert row["timezone"] == "Atlantic/Azores" and row["time"] == "11:00"


@pytest.mark.parametrize("params", [
    {"country": "PT"}, {"country": "AO", "timezone": "Europe/Lisbon"},
    {"country": "PT", "timezone": "UTC"}, {"country": "ES"}, {"date": "2027-02-30"},
])
def test_agenda_rejects_invalid_or_implicit_portugal_zone(api, people, params):
    assert api.get("/api/v1/doctor/agenda/today", params=params, headers=people["doctor"]["headers"]).status_code == 422


@pytest.mark.parametrize("who", ["patient", "unverified"])
def test_agenda_remains_restricted_to_current_doctor(api, people, who):
    assert api.get("/api/v1/doctor/agenda/today", headers=people[who]["headers"]).status_code == 403


def test_failed_read_audit_does_not_disclose_agenda(api, people, db_session):
    seed_consultation(db_session, people, scheduled_at=datetime(2027, 1, 1, 12))
    def reject(mapper, connection, target):
        if target.action == "doctor_agenda_read":
            raise RuntimeError("Synthetic audit refusal")
    event.listen(HealthAuditLog, "before_insert", reject)
    try:
        response = api.get("/api/v1/doctor/agenda/today", params={"date": "2027-01-01"}, headers=people["doctor"]["headers"])
        assert response.status_code == 503
        assert people["patient"]["profile"].id not in response.text
    finally:
        event.remove(HealthAuditLog, "before_insert", reject)
