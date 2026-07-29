import asyncio

from fastapi.testclient import TestClient

from app.services.payments import (
    MulticaixaExpressAdapter,
    PaymentStatus,
    VisaMastercardAdapter,
)


def test_payment_catalog_covers_angola_portugal_and_sadc(client: TestClient):
    angola = client.get("/api/v1/billing/payment-methods", params={
        "country": "AO", "currency": "AOA", "include_planned": "true",
    })
    assert angola.status_code == 200
    ao_ids = {method["id"] for method in angola.json()["methods"]}
    assert {"multicaixa_express", "visa_mastercard", "iban_transfer"}.issubset(ao_ids)

    portugal = client.get("/api/v1/billing/payment-methods", params={
        "country": "PT", "currency": "EUR", "include_planned": "true",
    })
    pt_ids = {method["id"] for method in portugal.json()["methods"]}
    assert {"multibanco", "visa_mastercard", "iban_transfer", "paypal"}.issubset(pt_ids)

    sadc = client.get("/api/v1/billing/payment-methods", params={
        "country": "ZM", "include_planned": "true",
    })
    sadc_ids = {method["id"] for method in sadc.json()["methods"]}
    assert {"flutterwave_mobile_money", "dpo_sadc"}.issubset(sadc_ids)
    assert all("integration_status" in method for method in sadc.json()["methods"])


def test_unconfigured_card_sandbox_never_auto_completes(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    adapter = VisaMastercardAdapter()
    status = asyncio.run(adapter.check_status("pi_sandbox_placeholder"))
    assert status == PaymentStatus.PENDING


def test_unconfigured_webhooks_are_never_trusted(monkeypatch):
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    monkeypatch.delenv("MULTICAIXA_WEBHOOK_SECRET", raising=False)
    assert VisaMastercardAdapter().verify_webhook(b"{}", "") is False
    assert MulticaixaExpressAdapter().verify_webhook(b"{}", "") is False
