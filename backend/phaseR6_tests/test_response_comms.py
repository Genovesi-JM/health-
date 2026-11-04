"""Phase R6 Response comms: boundary-violating bodies refused, reporter messages
always carry the boundary notice, responder messages must stay in boundary and
keep PHI/secrets off external channels.
"""
from __future__ import annotations

import pytest

from app import response_comms as C


def test_within_boundary_detection():
    assert C.message_within_boundary("We can help you find care; contact emergency services if urgent.")
    assert not C.message_within_boundary("We dispatched an ambulance; ETA 10 minutes.")


def test_compose_reporter_message_appends_notice():
    msg = C.compose_reporter_message("A nurse will review your message shortly.")
    assert C.boundary_notice_always_present(msg)


def test_compose_refuses_boundary_violation():
    with pytest.raises(C.CommsBoundaryError):
        C.compose_reporter_message("We have contacted the hospital and reserved a bed.")


def test_responder_message_boundary():
    ok, reasons = C.responder_message_ok("Please review incident notes.", to_external_channel=False)
    assert ok, reasons
    bad, reasons2 = C.responder_message_ok("Ambulance dispatched, arrival in 5 minutes.",
                                           to_external_channel=False)
    assert not bad


def test_responder_message_blocks_phi_to_external_channel():
    body = "patient phone +244923456789 needs follow-up"
    ok_internal, _ = C.responder_message_ok(body, to_external_channel=False)
    assert ok_internal                              # internal channel allowed
    ok_external, reasons = C.responder_message_ok(body, to_external_channel=True)
    assert not ok_external and any("PHI" in r for r in reasons)
