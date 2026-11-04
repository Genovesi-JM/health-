"""Clinician availability and schedule ownership (Phase 22). Domain-pure.

A slot represents where and when an *authorized* clinician can deliver a specific
service. No slot is exposed for an inactive, unverified, unprivileged,
unavailable, or wrong-jurisdiction clinician or facility. The server is
authoritative for timezone and slot generation; instants are stored in UTC with
the local-zone context retained for presentation.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo


# ── Slot exposure gate ───────────────────────────────────────────────────────

@dataclass
class SlotContext:
    org_can_operate: bool
    clinician_active: bool
    credentials_current: bool
    privilege_granted: bool
    service_approved: bool
    has_coverage: bool
    jurisdiction_ok: bool


def slot_exposable(ctx: SlotContext) -> bool:
    """A slot is exposable only if every authority condition holds. Fail closed."""
    return all((
        ctx.org_can_operate, ctx.clinician_active, ctx.credentials_current,
        ctx.privilege_granted, ctx.service_approved, ctx.has_coverage,
        ctx.jurisdiction_ok,
    ))


# ── Timezone: server-authoritative UTC ───────────────────────────────────────

def to_utc(local_naive: datetime, tz_name: str) -> datetime:
    """Interpret a naive local time in tz and return an aware UTC instant."""
    local = local_naive.replace(tzinfo=ZoneInfo(tz_name))
    return local.astimezone(ZoneInfo("UTC"))


def local_offset_minutes(instant_utc: datetime, tz_name: str) -> int:
    """Local UTC offset (minutes) at the given instant — DST-aware."""
    local = instant_utc.astimezone(ZoneInfo(tz_name))
    off = local.utcoffset() or timedelta(0)
    return int(off.total_seconds() // 60)


# ── Capacity states (indicative vs held vs confirmed) ────────────────────────

INDICATIVE, HELD, CONFIRMED = "indicative", "held", "confirmed"


def implies_live_availability(profile_is_stale: bool, capacity_state: str) -> bool:
    """Public copy must not imply live doctor availability from a stale profile."""
    if profile_is_stale:
        return False
    return capacity_state in (HELD, CONFIRMED)


# ── Deterministic recurring + exception resolution ───────────────────────────

@dataclass(frozen=True)
class Window:
    start: datetime   # UTC
    end: datetime     # UTC


def resolve_availability(recurring: list[Window], exceptions: list[Window]) -> list[Window]:
    """Exceptions (leave/blackout) subtract from recurring windows deterministically."""
    result: list[Window] = []
    for w in sorted(recurring, key=lambda x: x.start):
        segments = [w]
        for ex in exceptions:
            new_segments = []
            for s in segments:
                if ex.end <= s.start or ex.start >= s.end:
                    new_segments.append(s)                 # no overlap
                    continue
                if ex.start > s.start:
                    new_segments.append(Window(s.start, ex.start))
                if ex.end < s.end:
                    new_segments.append(Window(ex.end, s.end))
            segments = new_segments
        result.extend(segments)
    return result


def generate_slots(window: Window, duration_min: int, buffer_min: int) -> list[Window]:
    """Deterministic slot generation within a UTC window."""
    slots: list[Window] = []
    step = timedelta(minutes=duration_min + buffer_min)
    dur = timedelta(minutes=duration_min)
    cur = window.start
    while cur + dur <= window.end:
        slots.append(Window(cur, cur + dur))
        cur = cur + step
    return slots


# ── Schedule-change effects ──────────────────────────────────────────────────

def schedule_change_effect(has_confirmed: bool) -> dict:
    """A schedule edit releases affected indicative/held capacity, but confirmed
    appointments require explicit clinician/patient handling — never silently
    dropped."""
    return {
        "release_indicative": True,
        "release_unconfirmed_holds": True,
        "confirmed_requires_explicit_action": has_confirmed,
        "audit_recorded": True,
    }
