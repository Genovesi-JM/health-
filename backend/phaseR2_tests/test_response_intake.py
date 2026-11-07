"""Phase R2 Response intake: fail-closed acceptance (active + permitted + consented
+ non-empty), always computes the emergency redirect and boundary notice, never
auto-acts (accepted reports are routed to a human), and dedupes reports.
"""
from __future__ import annotations

from app import response_intake as I
from app import response_scope as S


def _scope():
    return S.ResponseScope(
        scope_id="scope-1", approved_jurisdictions=frozenset({"AO-LUANDA"}),
        approved_capabilities=frozenset({"symptom_intake", "human_escalation_request"}),
        signed_off_by="Ops Owner")


def _report(**kw):
    base = dict(reporter_id="pat-1", jurisdiction="AO-LUANDA", text="feeling unwell",
                consented=True, reported_at_epoch=1000, external_id=None)
    base.update(kw)
    return I.IncidentReport(**base)


def test_accepted_when_active_and_permitted():
    r = I.intake(_report(), _scope(), response_active=True)
    assert r.accepted and r.routed_for_human_review
    assert r.boundary_notice


def test_rejected_when_response_inactive():
    r = I.intake(_report(), _scope(), response_active=False)
    assert not r.accepted and not r.routed_for_human_review
    assert any("not active" in x for x in r.reasons)


def test_rejected_on_unapproved_jurisdiction():
    r = I.intake(_report(jurisdiction="ZZ"), _scope(), response_active=True)
    assert not r.accepted


def test_rejected_without_consent_or_text():
    assert not I.intake(_report(consented=False), _scope(), response_active=True).accepted
    assert not I.intake(_report(text="  "), _scope(), response_active=True).accepted


def test_emergency_redirect_always_computed():
    r = I.intake(_report(text="I have chest pain and can't breathe"), _scope(), response_active=True)
    assert r.emergency_redirect
    # even a rejected intake computes the redirect and boundary notice
    r2 = I.intake(_report(text="chest pain"), _scope(), response_active=False)
    assert r2.emergency_redirect and r2.boundary_notice


def test_never_auto_actionable():
    assert I.incident_auto_actionable(_report()) is False


def test_intake_dedup():
    led = I.IncidentLedger()
    assert led.accept("pat-1", "ext-1")
    assert not led.accept("pat-1", "ext-1")       # duplicate ignored
    assert led.accept("pat-1", "ext-2")
    assert led.accept("pat-1", None)              # no external id → always new
    assert led.accept("pat-1", None)
