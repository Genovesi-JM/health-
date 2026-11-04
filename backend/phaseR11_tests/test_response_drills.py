"""Phase R11 Response drills: readiness requires enough recent signed drills
covering every required scenario, all passing, with ZERO boundary events.
"""
from __future__ import annotations

from app import response_drills as D

NOW = 2_000_000_000


def _full_set(**overrides):
    recs = []
    for sc in D.REQUIRED_SCENARIOS:
        recs.append(D.DrillRecord(scenario=sc, ran_at_epoch=NOW - 1000, passed=True,
                                  boundary_events=0, signed_off_by="Ops Owner"))
    recs = [overrides.get(r.scenario, r) for r in recs]
    return recs


def test_full_clean_drill_set_ready():
    ok, reasons = D.drills_ready(_full_set(), NOW)
    assert ok, reasons


def test_missing_scenario_not_ready():
    recs = _full_set()[:-1]         # drop one scenario
    ok, reasons = D.drills_ready(recs, NOW)
    assert not ok and any("missing scenarios" in r for r in reasons)


def test_any_boundary_event_blocks():
    recs = _full_set()
    recs[0] = D.DrillRecord(scenario=recs[0].scenario, ran_at_epoch=NOW - 1000, passed=True,
                            boundary_events=1, signed_off_by="Ops Owner")
    ok, reasons = D.drills_ready(recs, NOW)
    assert not ok and any("boundary events must be zero" in r for r in reasons)


def test_failed_drill_blocks():
    recs = _full_set()
    recs[0] = D.DrillRecord(scenario=recs[0].scenario, ran_at_epoch=NOW - 1000, passed=False,
                            boundary_events=0, signed_off_by="Ops Owner")
    ok, reasons = D.drills_ready(recs, NOW)
    assert not ok and any("did not pass" in r for r in reasons)


def test_stale_drill_blocks():
    recs = _full_set()
    recs[0] = D.DrillRecord(scenario=recs[0].scenario, ran_at_epoch=NOW - D.DRILL_RECENCY_S - 1,
                            passed=True, boundary_events=0, signed_off_by="Ops Owner")
    ok, reasons = D.drills_ready(recs, NOW)
    assert not ok and any("stale" in r for r in reasons)


def test_unsigned_drill_not_counted():
    recs = _full_set()
    recs[0] = D.DrillRecord(scenario=recs[0].scenario, ran_at_epoch=NOW - 1000, passed=True,
                            boundary_events=0, signed_off_by=None)
    ok, reasons = D.drills_ready(recs, NOW)
    assert not ok       # now one scenario is effectively missing


def test_too_few_drills():
    ok, reasons = D.drills_ready(_full_set()[:2], NOW)
    assert not ok and any("at least" in r for r in reasons)
