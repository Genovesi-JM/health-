"""Phase 22 scheduling: no slot without full authority; UTC/DST correctness;
deterministic exception resolution; capacity-state distinction; schedule-change
effects on confirmed appointments.
"""
from __future__ import annotations

from datetime import datetime

from app import scheduling as S


def _ctx(**kw):
    base = dict(org_can_operate=True, clinician_active=True, credentials_current=True,
                privilege_granted=True, service_approved=True, has_coverage=True,
                jurisdiction_ok=True)
    base.update(kw)
    return S.SlotContext(**base)


def test_full_authority_exposes_slot():
    assert S.slot_exposable(_ctx())


def test_any_missing_authority_blocks_slot():
    for missing in ("org_can_operate", "clinician_active", "credentials_current",
                    "privilege_granted", "service_approved", "has_coverage", "jurisdiction_ok"):
        assert not S.slot_exposable(_ctx(**{missing: False})), missing


def test_utc_conversion_pilot_zone_luanda():
    # Africa/Luanda is UTC+1 (no DST): 09:00 local == 08:00 UTC.
    utc = S.to_utc(datetime(2026, 9, 14, 9, 0), "Africa/Luanda")
    assert utc.hour == 8
    assert S.local_offset_minutes(utc, "Africa/Luanda") == 60


def test_daylight_saving_boundary():
    # Europe/Madrid: winter UTC+1, summer UTC+2 — offset differs across DST.
    winter = S.to_utc(datetime(2026, 1, 15, 12, 0), "Europe/Madrid")
    summer = S.to_utc(datetime(2026, 7, 15, 12, 0), "Europe/Madrid")
    assert S.local_offset_minutes(winter, "Europe/Madrid") == 60
    assert S.local_offset_minutes(summer, "Europe/Madrid") == 120


def test_stale_profile_never_implies_live():
    assert not S.implies_live_availability(profile_is_stale=True, capacity_state=S.CONFIRMED)
    assert S.implies_live_availability(profile_is_stale=False, capacity_state=S.HELD)
    assert not S.implies_live_availability(profile_is_stale=False, capacity_state=S.INDICATIVE)


def test_exception_subtracts_from_recurring_deterministically():
    rec = [S.Window(datetime(2026, 9, 14, 9, 0), datetime(2026, 9, 14, 12, 0))]
    exc = [S.Window(datetime(2026, 9, 14, 10, 0), datetime(2026, 9, 14, 11, 0))]  # a break
    out = S.resolve_availability(rec, exc)
    assert len(out) == 2
    assert out[0].end == datetime(2026, 9, 14, 10, 0)
    assert out[1].start == datetime(2026, 9, 14, 11, 0)


def test_slot_generation_respects_duration_and_buffer():
    w = S.Window(datetime(2026, 9, 14, 9, 0), datetime(2026, 9, 14, 10, 0))
    slots = S.generate_slots(w, duration_min=20, buffer_min=10)   # 30-min step
    assert len(slots) == 2
    assert slots[0].start.minute == 0 and slots[1].start.minute == 30


def test_schedule_change_effect_on_confirmed():
    eff = S.schedule_change_effect(has_confirmed=True)
    assert eff["release_unconfirmed_holds"] is True
    assert eff["confirmed_requires_explicit_action"] is True   # never silently dropped
    assert eff["audit_recorded"] is True
