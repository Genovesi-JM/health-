"""Phase 38 payments & billing integrity: disabled by default, no card data on
our servers, server-authoritative integer-minor amounts in a supported currency,
no charge without a confirmed committed service, idempotent charge/refund with
refund <= captured and no double refund, and a refusing shipped provider.
"""
from __future__ import annotations

import pytest

from app import payments as P


# ── Enable gate ──────────────────────────────────────────────────────────────

def test_payments_disabled_by_default():
    assert not P.payments_enabled(None, True, True)
    assert not P.payments_enabled("false", True, True)


def test_payments_require_flag_provider_and_dpa():
    assert not P.payments_enabled("true", False, True)
    assert not P.payments_enabled("true", True, False)
    assert P.payments_enabled("true", True, True)


# ── No card data ─────────────────────────────────────────────────────────────

def test_card_pan_rejected():
    # a Luhn-valid test PAN
    assert P.contains_card_data({"note": "4242 4242 4242 4242"})
    with pytest.raises(P.CardDataRejected):
        P.assert_no_card_data({"card_number": "4242424242424242"})


def test_cvv_key_rejected():
    assert P.contains_card_data({"cvv": "123"})


def test_non_card_payload_ok():
    assert not P.contains_card_data({"amount_minor": 350000, "currency": "AOA"})
    P.assert_no_card_data({"amount_minor": 350000, "currency": "AOA"})   # no raise


# ── Money ────────────────────────────────────────────────────────────────────

def test_money_must_be_integer_minor_units():
    with pytest.raises(P.PaymentError):
        P.Money(35.5, "AOA")            # float rejected
    with pytest.raises(P.PaymentError):
        P.Money(-100, "AOA")            # negative rejected


def test_unsupported_currency_rejected():
    with pytest.raises(P.PaymentError):
        P.Money(1000, "USD")
    assert P.Money(1000, "AOA").amount_minor == 1000


def test_server_amount_is_authoritative():
    q = P.Money(350000, "AOA")
    assert P.authoritative_amount(q, client_claimed_minor=999999) is q   # client ignored
    assert P.client_amount_matches(q, 350000)
    assert not P.client_amount_matches(q, 1)


# ── Charge preconditions ─────────────────────────────────────────────────────

def _ctx(**kw):
    base = dict(service_confirmed=True, booking_committed=True,
                payer_authenticated=True, consent_to_charge=True)
    base.update(kw)
    return P.ChargeContext(**base)


def test_charge_allowed_when_all_hold():
    ok, reasons = P.charge_allowed(_ctx(), P.Money(350000, "AOA"))
    assert ok, reasons


def test_charge_denied_on_any_missing_precondition():
    for missing in ("service_confirmed", "booking_committed", "payer_authenticated", "consent_to_charge"):
        ok, _ = P.charge_allowed(_ctx(**{missing: False}), P.Money(350000, "AOA"))
        assert not ok, missing


def test_charge_denied_on_zero_amount():
    ok, reasons = P.charge_allowed(_ctx(), P.Money(0, "AOA"))
    assert not ok and any("positive" in r for r in reasons)


# ── Idempotent charge / refund ───────────────────────────────────────────────

def test_charge_idempotent_no_double_execute():
    led = P.PaymentLedger()
    calls = []
    r1 = led.charge("idem-1", "txn-1", P.Money(350000, "AOA"), execute=lambda: calls.append(1))
    r2 = led.charge("idem-1", "txn-9", P.Money(350000, "AOA"), execute=lambda: calls.append(1))
    assert r1 == r2 and r1["txn_id"] == "txn-1"
    assert len(calls) == 1              # side effect ran once


def test_refund_bounded_and_idempotent():
    led = P.PaymentLedger()
    led.charge("idem-1", "txn-1", P.Money(350000, "AOA"))
    led.refund("idem-1", "refund-1", 100000)
    # replayed refund does not double-apply
    led.refund("idem-1", "refund-1", 100000)
    rec = led._charges["idem-1"]
    assert rec["refunded_minor"] == 100000


def test_refund_cannot_exceed_capture():
    led = P.PaymentLedger()
    led.charge("idem-1", "txn-1", P.Money(350000, "AOA"))
    led.refund("idem-1", "refund-1", 300000)
    with pytest.raises(P.PaymentError):
        led.refund("idem-1", "refund-2", 100000)   # would exceed 350000


def test_refund_unknown_charge_rejected():
    led = P.PaymentLedger()
    with pytest.raises(P.PaymentError):
        led.refund("nope", "refund-1", 100)


# ── Shipped provider refuses ─────────────────────────────────────────────────

def test_disabled_provider_refuses_and_is_blocked_external():
    prov = P.DisabledPaymentProvider()
    assert prov.health() is False
    with pytest.raises(P.PaymentsDisabled):
        prov.charge()
    with pytest.raises(P.PaymentsDisabled):
        prov.refund()
    assert P.ADAPTER_STATUS == "BLOCKED_EXTERNAL"
    assert "pci_scope_and_saq" in P.ADAPTER_RELEASE_REQUIREMENTS
