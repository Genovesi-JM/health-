"""Phase R1 Response scope & exclusion boundary: permanently excluded capabilities
can never be enabled, capabilities are a fail-closed allowlist gated on active +
approved jurisdiction, unknown jurisdiction is information-only, and the boundary
notice + no-external-action copy hold.
"""
from __future__ import annotations

from app import response_scope as S


def _scope(**kw):
    base = dict(scope_id="scope-1", approved_jurisdictions=frozenset({"AO-LUANDA"}),
                approved_capabilities=frozenset({"symptom_intake", "human_escalation_request"}),
                signed_off_by="Ops Owner")
    base.update(kw)
    return S.ResponseScope(**base)


def test_scope_valid():
    ok, reasons = S.scope_is_valid(_scope())
    assert ok, reasons


def test_scope_cannot_approve_excluded_capabilities():
    bad = _scope(approved_capabilities=frozenset({"ambulance_dispatch"}))
    ok, reasons = S.scope_is_valid(bad)
    assert not ok and any("excluded" in r for r in reasons)


def test_unsigned_scope_rejected():
    assert not S.scope_is_valid(_scope(signed_off_by=None))[0]


def test_excluded_capability_never_permitted():
    for cap in S.EXCLUDED_CAPABILITIES:
        assert not S.capability_permitted(_scope(), cap, "AO-LUANDA", response_active=True)


def test_capability_requires_active_response():
    assert not S.capability_permitted(_scope(), "symptom_intake", "AO-LUANDA", response_active=False)


def test_capability_requires_approved_jurisdiction():
    assert S.capability_permitted(_scope(), "symptom_intake", "AO-LUANDA", response_active=True)
    assert not S.capability_permitted(_scope(), "symptom_intake", "AO-HUAMBO", response_active=True)


def test_capability_must_be_in_allowlist():
    assert not S.capability_permitted(_scope(), "not_approved_thing", "AO-LUANDA", response_active=True)


def test_unknown_jurisdiction_is_information_only():
    assert S.exposure_for_jurisdiction(_scope(), "AO-LUANDA") == "capabilities"
    assert S.exposure_for_jurisdiction(_scope(), "ZZ") == "information_only"
    assert S.exposure_for_jurisdiction(_scope(), None) == "information_only"


def test_boundary_notice_present_and_non_emergency():
    n = S.boundary_notice()
    assert "não substitui" in n.lower() and "emergência" in n.lower()


def test_content_within_boundary_uses_emergency_guards():
    # The Phase 21 guard is English-only (localization is an owner gate, R15/R28).
    assert S.content_within_boundary("We can help you navigate; contact emergency services.")
    assert not S.content_within_boundary("We dispatched an ambulance; arrival in 10 minutes.")
