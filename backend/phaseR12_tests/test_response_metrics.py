"""Phase R12 Response metrics: rates, zero-boundary-event gate trips on any
boundary/failed escalation, comprehension gate (sample + aggregate target + no
individual admitted after a failed critical check), and PHI-free metrics.
"""
from __future__ import annotations

from app import response_metrics as M


def _metrics(**kw):
    base = dict(total_incidents=100, acknowledged=98, resolved=95,
                boundary_events=0, failed_escalations=0)
    base.update(kw)
    return M.OperationalMetrics(**base)


def test_rates():
    m = _metrics()
    assert abs(M.ack_rate(m) - 0.98) < 1e-9
    assert abs(M.resolution_rate(m) - 0.95) < 1e-9
    assert M.ack_rate(_metrics(total_incidents=0)) is None


def test_zero_boundary_gate_holds_when_clean():
    assert M.zero_boundary_gate(_metrics())
    assert not M.gate_tripped(_metrics())


def test_any_boundary_event_trips_gate():
    assert M.gate_tripped(_metrics(boundary_events=1))
    assert M.gate_tripped(_metrics(failed_escalations=1))


def test_comprehension_ready():
    ok, reasons = M.comprehension_ready(
        M.ComprehensionStudy(sample_size=20, passed=19, any_individual_failed_critical=False))
    assert ok, reasons


def test_comprehension_below_target_blocks():
    ok, reasons = M.comprehension_ready(
        M.ComprehensionStudy(sample_size=20, passed=15, any_individual_failed_critical=False))
    assert not ok and any("below target" in r for r in reasons)


def test_small_sample_blocks():
    ok, reasons = M.comprehension_ready(
        M.ComprehensionStudy(sample_size=5, passed=5, any_individual_failed_critical=False))
    assert not ok and any("sample must be" in r for r in reasons)


def test_failed_critical_blocks_admission():
    ok, reasons = M.comprehension_ready(
        M.ComprehensionStudy(sample_size=20, passed=20, any_individual_failed_critical=True))
    assert not ok and any("failed critical" in r for r in reasons)


def test_metrics_phi_free():
    assert M.metrics_are_phi_free(frozenset({"total_incidents", "ack_rate", "boundary_events"}))
    assert not M.metrics_are_phi_free(frozenset({"total_incidents", "reporter_id"}))
