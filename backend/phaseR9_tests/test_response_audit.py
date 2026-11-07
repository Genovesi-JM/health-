"""Phase R9 Response audit: append-only tamper-evident incident log, boundary
events tracked, unknown events rejected, per-incident query, access control, and
delete prohibited.
"""
from __future__ import annotations

import pytest

from app import response_audit as RA


def _log():
    log = RA.ResponseIncidentLog()
    log.record(RA.INTAKE, "pat-1", "inc-1", "success", 1000)
    log.record(RA.ROUTE, "system", "inc-1", "success", 1010)
    log.record(RA.ACK, "doc-1", "inc-1", "success", 1020)
    return log


def test_records_and_verifies():
    log = _log()
    assert len(log.entries()) == 3
    assert log.verify()


def test_unknown_event_rejected():
    log = RA.ResponseIncidentLog()
    with pytest.raises(RA.ResponseAuditError):
        log.record("response.teleport", "x", "inc-1", "success", 1000)


def test_boundary_events_tracked():
    log = _log()
    log.record(RA.BOUNDARY_EVENT, "system", "inc-1", "error", 1200)
    be = log.boundary_events()
    assert len(be) == 1 and be[0].event.action == RA.BOUNDARY_EVENT


def test_tamper_breaks_verify():
    log = _log()
    from dataclasses import replace
    items = log._chain._items
    items[0] = RA_replace(items[0])
    assert not log.verify()


def RA_replace(rec):
    from dataclasses import replace
    return type(rec)(event=replace(rec.event, outcome="denied"),
                     prev_hash=rec.prev_hash, this_hash=rec.this_hash)


def test_incident_query():
    log = _log()
    log.record(RA.INTAKE, "pat-2", "inc-2", "success", 1300)
    assert len(log.incident_events("inc-1")) == 3
    assert len(log.incident_events("inc-2")) == 1


def test_access_control():
    assert RA.can_read_response_audit("auditor", frozenset({"audit_read"}))
    assert RA.can_read_response_audit("response_supervisor", frozenset({"audit_read"}))
    assert not RA.can_read_response_audit("response_supervisor", frozenset())
    assert not RA.can_read_response_audit("doctor", frozenset({"audit_read"}))


def test_delete_prohibited():
    with pytest.raises(RA.ResponseAuditError):
        RA.delete_prohibited()
