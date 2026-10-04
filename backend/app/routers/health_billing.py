from __future__ import annotations
"""
Health Billing Router — Consultation payments and invoices.

Checkout durably records one owned request before dispatch. Exact retries
recover that request without redispatching it. Provider observations and manual
confirmation retain financial receipts; current care eligibility determines
whether they can mark a consultation paid or require financial review.
Unconfigured adapters and unapproved Portugal quotes cannot start checkout.

Endpoints:
- POST /api/v1/billing/consultation/checkout            — start a payment (pending)
- GET  /api/v1/billing/consultation/{id}/payment-status — poll provider + reconcile
- POST /api/v1/billing/consultation/{id}/confirm        — admin manual confirmation
- POST /api/v1/billing/webhook/{provider}               — signed provider webhook
- GET  /api/v1/billing/me/invoices                      — patient payment history
"""
import json
import logging
import os
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.health_models import Patient, Consultation, HealthPayment
from app.health_schemas import (
    ConsultCheckoutRequest, ConsultCheckoutResponse, PaymentStatusResponse,
    PaymentMethodsResponse, PaymentMethodOption, InvoiceOut,
)
from app.rbac import get_patient_for_user
from app.services import consultation_payments as lifecycle
from app.services.payments import (
    PaymentIntent, PaymentProvider, PaymentStatus, Currency,
    MulticaixaExpressAdapter, VisaMastercardAdapter,
    IBANTransferAdapter, PayPalAdapter,
)

logger = logging.getLogger(__name__)

def _private(response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"


router = APIRouter(prefix="/api/v1/billing", tags=["billing"], dependencies=[Depends(_private)])

# MVP consultation price in AOA centavos (50,000.00 AOA)
CONSULT_PRICE_AOA = 5000000
CONSULT_CURRENCY = "AOA"

# Provider adapters are stateless; instantiate once.
_ADAPTERS = {
    PaymentProvider.MULTICAIXA_EXPRESS: MulticaixaExpressAdapter(),
    PaymentProvider.VISA_MASTERCARD: VisaMastercardAdapter(),
    PaymentProvider.IBAN_TRANSFER: IBANTransferAdapter(),
    PaymentProvider.PAYPAL: PayPalAdapter(),
}

# Regional discovery catalog. Only entries with a checkout_id are executable
# today; the remaining entries make the integration contract and credential
# requirements visible without pretending that a payment can be completed.
_REGIONAL_METHODS = [
    {
        "id": "multicaixa_express", "provider": "emis_multicaixa",
        "label": "Multicaixa Express", "description": "Pagamento móvel e por referência em Angola.",
        "countries": ["AO"], "currencies": ["AOA"], "channels": ["mobile", "reference", "qr"],
        "checkout_id": PaymentProvider.MULTICAIXA_EXPRESS,
    },
    {
        "id": "visa_mastercard", "provider": "stripe",
        "label": "Cartão internacional", "description": "Visa e Mastercard com autenticação 3-D Secure.",
        "countries": ["*"], "currencies": ["AOA", "EUR", "USD", "GBP", "ZAR"],
        "channels": ["card", "wallet"], "checkout_id": PaymentProvider.VISA_MASTERCARD,
    },
    {
        "id": "multibanco", "provider": "stripe",
        "label": "Multibanco", "description": "Referência Multibanco para clientes em Portugal.",
        "countries": ["PT"], "currencies": ["EUR"], "channels": ["reference"],
        "checkout_id": None,
    },
    {
        "id": "bizum", "provider": "stripe",
        "label": "Bizum", "description": "Pagamento bancário em tempo real para clientes em Espanha.",
        "countries": ["ES"], "currencies": ["EUR"], "channels": ["real_time_bank"],
        "checkout_id": None, "preview": True,
    },
    {
        "id": "iban_transfer", "provider": "bank_transfer",
        "label": "Transferência bancária / IBAN", "description": "Angola, SEPA e transferências internacionais.",
        "countries": ["*"], "currencies": ["AOA", "EUR", "USD", "GBP", "ZAR"],
        "channels": ["bank_transfer"], "checkout_id": PaymentProvider.IBAN_TRANSFER,
    },
    {
        "id": "paypal", "provider": "paypal",
        "label": "PayPal", "description": "Checkout PayPal internacional.",
        "countries": ["*"], "currencies": ["EUR", "USD", "GBP"],
        "channels": ["wallet"], "checkout_id": PaymentProvider.PAYPAL,
    },
    {
        "id": "paystack", "provider": "paystack",
        "label": "Paystack", "description": "Cartões, EFT e mobile money nos mercados Paystack.",
        "countries": ["NG", "GH", "KE", "ZA"], "currencies": ["NGN", "GHS", "KES", "ZAR", "USD"],
        "channels": ["card", "eft", "mobile_money", "bank_transfer"], "checkout_id": None,
    },
    {
        "id": "flutterwave_mobile_money", "provider": "flutterwave",
        "label": "Mobile Money África", "description": "M-Pesa, MTN, Airtel, Orange Money e redes elegíveis.",
        "countries": ["CM", "CI", "ET", "GH", "KE", "RW", "SN", "TZ", "UG", "ZM"],
        "currencies": ["XAF", "XOF", "ETB", "GHS", "KES", "RWF", "TZS", "UGX", "ZMW"],
        "channels": ["mobile_money"], "checkout_id": None,
    },
    {
        "id": "dpo_sadc", "provider": "dpo",
        "label": "DPO Pay SADC", "description": "Adaptador preparado para adquirência regional SADC.",
        "countries": ["ZA", "BW", "MZ", "NA", "ZM", "ZW", "MW", "LS", "SZ", "TZ"],
        "currencies": ["ZAR", "BWP", "MZN", "NAD", "ZMW", "ZWL", "MWK", "LSL", "SZL", "TZS"],
        "channels": ["card", "bank_transfer", "mobile_money"], "checkout_id": None,
    },
]

_PROVIDER_ENV = {
    "stripe": "STRIPE_SECRET_KEY",
    "emis_multicaixa": "MULTICAIXA_API_KEY",
    "paypal": "PAYPAL_CLIENT_ID",
    "paystack": "PAYSTACK_SECRET_KEY",
    "flutterwave": "FLUTTERWAVE_SECRET_KEY",
    "dpo": "DPO_COMPANY_TOKEN",
}

_DEFAULT_CURRENCY_BY_COUNTRY = {
    "AO": "AOA", "PT": "EUR", "ES": "EUR", "ZA": "ZAR", "NG": "NGN",
    "GH": "GHS", "KE": "KES", "ZM": "ZMW", "MZ": "MZN", "BW": "BWP",
    "NA": "NAD", "ZW": "ZWL", "MW": "MWK", "LS": "LSL", "SZ": "SZL",
    "TZ": "TZS", "UG": "UGX", "RW": "RWF", "CM": "XAF", "CI": "XOF",
    "SN": "XOF", "ET": "ETB",
}


def _env_configured(name: str) -> bool:
    value = os.getenv(name, "")
    upper = value.upper()
    return bool(value) and "REPLACE_WITH" not in upper and "EXAMPLE" not in upper


def _provider_configured(provider: PaymentProvider, currency: str = "AOA") -> bool:
    """Whether the provider has real credentials (vs. dev mock)."""
    adapter = _ADAPTERS[provider]
    if isinstance(adapter, MulticaixaExpressAdapter):
        return _env_configured("MULTICAIXA_MERCHANT_ID") and _env_configured("MULTICAIXA_API_KEY")
    if isinstance(adapter, VisaMastercardAdapter):
        return _env_configured("STRIPE_SECRET_KEY")
    if isinstance(adapter, IBANTransferAdapter):
        return adapter.recipient_configured(currency)
    if isinstance(adapter, PayPalAdapter):
        return _env_configured("PAYPAL_CLIENT_ID") and _env_configured("PAYPAL_SECRET")
    return False


def _to_health_status(status: PaymentStatus) -> str:
    """Map orchestrator PaymentStatus → HealthPayment.status vocabulary."""
    if status == PaymentStatus.COMPLETED:
        return "paid"
    if status in (PaymentStatus.FAILED, PaymentStatus.CANCELLED):
        return "failed"
    if status in (PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED):
        return "refunded"
    return "pending"  # pending, processing, awaiting_confirmation


def _attempt_out(db, payment):
    meta, _ = lifecycle._metadata(payment)
    consultation = db.get(Consultation, payment.consultation_id) if payment.consultation_id else None
    return ConsultCheckoutResponse(
        payment_id=payment.id, status=payment.status, amount=payment.amount, currency=payment.currency,
        provider=payment.provider, provider_reference=payment.provider_reference,
        qr_code=meta.get("qr_code"), redirect_url=meta.get("redirect_url"), client_secret=meta.get("client_secret"),
        transfer_details=meta.get("transfer_details"), instructions=meta.get("instructions"),
        consultation_paid=lifecycle.consultation_payment_applied(payment, consultation),
        dispatch_state=payment.dispatch_state, request_key=payment.checkout_request_key,
        **lifecycle.review_fields(payment),
    )


def _payment_status_out(db, payment):
    consultation = db.get(Consultation, payment.consultation_id) if payment.consultation_id else None
    return PaymentStatusResponse(payment_id=payment.id, status=payment.status,
        provider=payment.provider, amount=payment.amount, currency=payment.currency,
        consultation_paid=lifecycle.consultation_payment_applied(payment, consultation),
        dispatch_state=payment.dispatch_state, request_key=payment.checkout_request_key,
        **lifecycle.review_fields(payment))


def _checkout_provider_gate(provider):
    if not any(item.get('checkout_id') == provider and 'AOA' in item['currencies']
               and ('AO' in item['countries'] or '*' in item['countries']) for item in _REGIONAL_METHODS):
        raise HTTPException(409, {"reason": "provider_currency_unavailable", "message": "Método indisponível para esta moeda."})
    if not _provider_configured(provider):
        raise HTTPException(503, {"code": "provider_unavailable", "message": "O método de pagamento ainda não está configurado."})


@router.get("/payment-methods", response_model=PaymentMethodsResponse)
def payment_methods(
    country: str = Query(default="AO", min_length=2, max_length=2),
    currency: str | None = Query(default=None, min_length=3, max_length=3),
    include_planned: bool = Query(default=False),
):
    """Discover executable and planned payment methods for a market."""
    country = country.upper()
    currency = currency.upper() if currency else _DEFAULT_CURRENCY_BY_COUNTRY.get(country)
    methods = []
    for item in _REGIONAL_METHODS:
        if "*" not in item["countries"] and country not in item["countries"]:
            continue
        if currency and currency not in item["currencies"]:
            continue
        checkout_id = item.get("checkout_id")
        configured = _provider_configured(checkout_id, currency or "AOA") if checkout_id else False
        executable = checkout_id is not None
        quote_ready = country == "AO" and currency == "AOA"
        enabled = executable and configured and quote_ready
        if not include_planned and not enabled:
            continue
        if executable and not quote_ready:
            integration_status = "quote_required"
        elif item.get("preview"):
            integration_status = "preview"
        elif not executable:
            integration_status = "adapter_required"
        elif configured:
            integration_status = "ready"
        else:
            integration_status = "configuration_required"
        methods.append(PaymentMethodOption(
            id=item["id"],
            label=item["label"],
            description=item["description"],
            enabled=enabled,
            provider=item["provider"],
            countries=item["countries"],
            currencies=item["currencies"],
            channels=item["channels"],
            integration_status=integration_status,
            test_mode=not configured,
        ))
    return PaymentMethodsResponse(methods=methods)


@router.post("/consultation/checkout", response_model=ConsultCheckoutResponse)
async def checkout_consultation(
    body: ConsultCheckoutRequest, idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    patient: Patient = Depends(get_patient_for_user), user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    payment, dispatch = lifecycle.prepare_checkout(db, patient_id=patient.id, actor_id=user.id,
        consultation_id=body.consultation_id, method=body.payment_method, key=idempotency_key,
        provider_gate=_checkout_provider_gate, amount=CONSULT_PRICE_AOA, currency=CONSULT_CURRENCY)
    if not dispatch:
        return _attempt_out(db, lifecycle.refresh_known_receipt(db, payment))
    identifier = payment.id
    intent = PaymentIntent(id=identifier, company_id="kaya", order_id=identifier, amount=payment.amount,
        currency=Currency(payment.currency), provider=PaymentProvider(payment.provider), description="Consulta KAYA",
        metadata={"consultation_id": payment.consultation_id, "patient_id": patient.id}, idempotency_key=identifier)
    try:
        result = await _ADAPTERS[PaymentProvider(payment.provider)].create_payment(intent)
        payment = lifecycle.record_dispatch_result(db, identifier, result)
    except Exception:
        db.rollback()
        try:
            payment = lifecycle.mark_unknown(db, identifier)
        except Exception:
            db.rollback()
            raise HTTPException(503, "Não foi possível confirmar o resultado. Recupere o pedido com a mesma chave; não inicie outro pagamento.") from None
    return _attempt_out(db, lifecycle.refresh_known_receipt(db, payment))


@router.get(
    "/consultation/{consultation_id}/payment-status",
    response_model=PaymentStatusResponse,
)
async def consultation_payment_status(
    consultation_id: str, request_key: str | None = Query(None, max_length=64),
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Poll the provider for the latest status and reconcile the consultation."""
    payment = (
        db.query(HealthPayment)
        .filter(
            HealthPayment.consultation_id == consultation_id,
            HealthPayment.patient_id == patient.id,
        )
        .order_by(HealthPayment.created_at.desc())
        .first()
    )
    if request_key is not None:
        key = lifecycle.request_key(request_key)
        payment = db.query(HealthPayment).filter_by(patient_id=patient.id, consultation_id=consultation_id, checkout_request_key=key).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado. Um pedido em curso ainda pode ser confirmado.")

    # Unknown dispatch outcomes require verified reconciliation. Adapter
    # fallback "pending" is not proof that an ambiguous dispatch succeeded.
    if payment.status == "pending" and payment.provider_reference and payment.dispatch_state == "response_recorded":
        provider = PaymentProvider(payment.provider)
        adapter = _ADAPTERS[provider]
        provider_status = await adapter.check_status(payment.provider_reference)
        new_status = _to_health_status(provider_status)
        # The provider await can overlap a callback. Reconcile even an
        # unchanged observation under the shared locks and refresh the row;
        # never return the cached pre-await payment or erase a newer receipt.
        lifecycle.apply_observation(db, payment, new_status, source="provider_status")
        db.commit()
        db.refresh(payment)

    return _payment_status_out(db, lifecycle.refresh_known_receipt(db, payment))


@router.post(
    "/consultation/{consultation_id}/confirm",
    response_model=PaymentStatusResponse,
)
def admin_confirm_consultation_payment(
    consultation_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin manual confirmation (bank transfer / cash / pilot reconciliation)."""
    payment = (
        db.query(HealthPayment)
        .filter(HealthPayment.consultation_id == consultation_id)
        .order_by(HealthPayment.created_at.desc())
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    lifecycle.apply_observation(db, payment, "paid", source="admin", actor_id=admin.id)
    db.commit(); db.refresh(payment)
    return _payment_status_out(db, payment)


@router.post("/webhook/{provider}")
async def billing_webhook(
    provider: str,
    request: Request,
    signature: str | None = Header(default=None, alias="X-Signature"),
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    """Signed provider webhook. Confirms/rejects a pending consultation payment."""
    try:
        provider_enum = PaymentProvider(provider)
    except ValueError:
        raise HTTPException(status_code=404, detail="Provider desconhecido.")

    adapter = _ADAPTERS[provider_enum]
    raw = await request.body()
    sig = stripe_signature if provider_enum == PaymentProvider.VISA_MASTERCARD else signature

    if not adapter.verify_webhook(raw, sig or ""):
        logger.warning("Rejected %s webhook: bad signature", provider)
        raise HTTPException(status_code=401, detail="Assinatura inválida.")

    try:
        data = json.loads(raw or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Payload inválido.")

    provider_ref = None
    new_status = None
    if provider_enum == PaymentProvider.MULTICAIXA_EXPRESS:
        provider_ref = data.get("payment_id") or data.get("reference")
        new_status = {
            "completed": "paid", "failed": "failed", "expired": "failed",
        }.get(data.get("status"))
    elif provider_enum == PaymentProvider.VISA_MASTERCARD:
        obj = data.get("data", {}).get("object", {})
        provider_ref = obj.get("id")
        new_status = {
            "payment_intent.succeeded": "paid",
            "payment_intent.payment_failed": "failed",
        }.get(data.get("type"))

    if not provider_ref or not new_status:
        return {"status": "ignored"}

    payment = (
        db.query(HealthPayment)
        .filter(HealthPayment.provider_reference == provider_ref, HealthPayment.provider == provider_enum.value)
        .first()
    )
    if not payment:
        return {"status": "no_match"}

    lifecycle.apply_observation(db, payment, new_status, source="provider_webhook")
    db.commit()
    logger.info("Webhook %s updated payment %s -> %s", provider, payment.id, new_status)
    return {"status": "ok", "payment_id": payment.id, "new_status": payment.status, **lifecycle.review_fields(payment)}


@router.get("/me/invoices", response_model=List[InvoiceOut])
def my_invoices(
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Get the patient's payment/invoice history."""
    payments = (
        db.query(HealthPayment)
        .filter(HealthPayment.patient_id == patient.id)
        .order_by(HealthPayment.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        InvoiceOut(
            id=p.id,
            payment_type=p.payment_type,
            amount=p.amount,
            currency=p.currency,
            status=p.status,
            description=p.description,
            created_at=p.created_at,
            **lifecycle.review_fields(p),
        )
        for p in payments
    ]
