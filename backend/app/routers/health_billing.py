from __future__ import annotations
"""
Health Billing Router — Consultation payments and invoices.

Payments go through the real payment orchestrator adapters (Multicaixa Express
for Angola by default). A checkout creates a *pending* payment and returns the
provider reference / QR code — it NEVER marks a consultation as paid on its own.
A consultation only becomes `paid` when:
  - a signed provider webhook confirms it, or
  - a status poll against the provider returns "completed", or
  - an admin explicitly confirms it (pilot / bank-transfer / cash reconciliation).

Per the launch plan, production checkout must not silently fall back to a
simulated payment: if the gateway is not configured in production, checkout
fails loudly (503) instead of pretending the payment succeeded.

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

from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.health_models import Patient, Consultation, HealthPayment
from app.health_schemas import (
    ConsultCheckoutRequest, ConsultCheckoutResponse, PaymentStatusResponse,
    PaymentMethodsResponse, PaymentMethodOption, InvoiceOut,
)
from app.rbac import get_patient_for_user
from app.services.payments import (
    PaymentIntent, PaymentProvider, PaymentStatus, Currency,
    MulticaixaExpressAdapter, VisaMastercardAdapter,
    IBANTransferAdapter, PayPalAdapter,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

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

_IS_PRODUCTION = settings.env in ("production", "prod")

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


def _resolve_provider(method: str | None) -> PaymentProvider:
    """Map an incoming payment_method string to a PaymentProvider (default MCX)."""
    if not method:
        return PaymentProvider.MULTICAIXA_EXPRESS
    try:
        return PaymentProvider(method)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Método de pagamento não suportado: {method}",
        )


def _provider_configured(provider: PaymentProvider) -> bool:
    """Whether the provider has real credentials (vs. dev mock)."""
    adapter = _ADAPTERS[provider]
    if isinstance(adapter, MulticaixaExpressAdapter):
        return _env_configured("MULTICAIXA_MERCHANT_ID") and _env_configured("MULTICAIXA_API_KEY")
    if isinstance(adapter, VisaMastercardAdapter):
        return _env_configured("STRIPE_SECRET_KEY")
    if isinstance(adapter, IBANTransferAdapter):
        return True  # manual transfer needs no external credentials
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


def _mark_consultation_paid(db: Session, payment: HealthPayment) -> None:
    """Reconcile a paid HealthPayment onto its consultation."""
    payment.status = "paid"
    db.add(payment)
    if payment.consultation_id:
        consultation = db.get(Consultation, payment.consultation_id)
        if consultation and consultation.payment_status != "paid":
            consultation.payment_status = "paid"
            consultation.payment_id = payment.id
            db.add(consultation)


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
        configured = _env_configured(_PROVIDER_ENV.get(item["provider"], "")) if item["provider"] != "bank_transfer" else True
        executable = checkout_id is not None
        enabled = executable and ((not _IS_PRODUCTION) or _provider_configured(checkout_id))
        if not include_planned and not enabled:
            continue
        if item.get("preview"):
            integration_status = "preview"
        elif not executable:
            integration_status = "adapter_required"
        elif configured:
            integration_status = "ready"
        else:
            integration_status = "sandbox"
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
    body: ConsultCheckoutRequest,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a payment for a consultation. Returns a *pending* payment."""
    consultation = db.query(Consultation).filter(
        Consultation.id == body.consultation_id,
        Consultation.patient_id == patient.id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    if consultation.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Consulta já paga.")

    provider = _resolve_provider(body.payment_method)

    # Launch-gate: never silently simulate a payment in production.
    if _IS_PRODUCTION and not _provider_configured(provider):
        logger.error("Checkout blocked: provider %s not configured in production", provider.value)
        raise HTTPException(
            status_code=503,
            detail="Pagamentos indisponíveis de momento. Tente novamente mais tarde.",
        )

    # Idempotency: reuse an existing open payment for this consultation.
    existing = (
        db.query(HealthPayment)
        .filter(
            HealthPayment.consultation_id == consultation.id,
            HealthPayment.status == "pending",
        )
        .order_by(HealthPayment.created_at.desc())
        .first()
    )
    if existing and existing.provider == provider.value:
        meta = json.loads(existing.metadata_json or "{}")
        return ConsultCheckoutResponse(
            payment_id=existing.id, status=existing.status,
            amount=existing.amount, currency=existing.currency,
            provider=existing.provider, provider_reference=existing.provider_reference,
            qr_code=meta.get("qr_code"), redirect_url=meta.get("redirect_url"),
            client_secret=meta.get("client_secret"),
            transfer_details=meta.get("transfer_details"), instructions=meta.get("instructions"),
        )

    payment = HealthPayment(
        patient_id=patient.id,
        consultation_id=consultation.id,
        payment_type="consultation",
        amount=CONSULT_PRICE_AOA,
        currency=CONSULT_CURRENCY,
        status="pending",
        provider=provider.value,
        description=f"Consulta {consultation.specialty} — {consultation.id[:8]}",
    )
    db.add(payment)
    db.flush()  # assign payment.id

    intent = PaymentIntent(
        id=payment.id,
        company_id="kaya",
        order_id=payment.id,
        amount=CONSULT_PRICE_AOA,
        currency=Currency.AOA,
        provider=provider,
        description=payment.description or "Consulta KAYA",
        metadata={"consultation_id": consultation.id, "patient_id": patient.id},
        idempotency_key=payment.id,
    )

    adapter = _ADAPTERS[provider]
    result = await adapter.create_payment(intent)

    if not result.success:
        payment.status = "failed"
        db.commit()
        raise HTTPException(
            status_code=502,
            detail=result.error_message or "Falha ao iniciar o pagamento.",
        )

    raw = result.raw_response or {}
    transfer_details = raw.get("transfer_details")
    instructions = raw.get("instructions")

    payment.status = _to_health_status(result.status)
    payment.provider_reference = result.provider_reference
    payment.metadata_json = json.dumps({
        "qr_code": result.qr_code,
        "redirect_url": result.redirect_url,
        "client_secret": result.client_secret,
        "transfer_details": transfer_details,
        "instructions": instructions,
        "mock": bool(raw.get("mock")),
    })
    db.add(payment)

    # A provider that confirms synchronously may already be completed — reconcile,
    # but only when it genuinely reports completed.
    if payment.status == "paid":
        _mark_consultation_paid(db, payment)

    db.commit()
    db.refresh(payment)

    return ConsultCheckoutResponse(
        payment_id=payment.id,
        status=payment.status,
        amount=payment.amount,
        currency=payment.currency,
        provider=payment.provider,
        provider_reference=payment.provider_reference,
        qr_code=result.qr_code,
        redirect_url=result.redirect_url,
        client_secret=result.client_secret,
        transfer_details=transfer_details,
        instructions=instructions,
    )


@router.get(
    "/consultation/{consultation_id}/payment-status",
    response_model=PaymentStatusResponse,
)
async def consultation_payment_status(
    consultation_id: str,
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
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    if payment.status == "pending" and payment.provider_reference:
        provider = PaymentProvider(payment.provider)
        adapter = _ADAPTERS[provider]
        provider_status = await adapter.check_status(payment.provider_reference)
        new_status = _to_health_status(provider_status)
        if new_status != payment.status:
            payment.status = new_status
            if new_status == "paid":
                _mark_consultation_paid(db, payment)
            db.add(payment)
            db.commit()
            db.refresh(payment)

    consultation = db.get(Consultation, consultation_id)
    return PaymentStatusResponse(
        payment_id=payment.id,
        status=payment.status,
        consultation_paid=bool(consultation and consultation.payment_status == "paid"),
    )


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
    if payment.status != "paid":
        meta = json.loads(payment.metadata_json or "{}")
        meta["confirmed_by"] = admin.id
        payment.metadata_json = json.dumps(meta)
        _mark_consultation_paid(db, payment)
        db.commit()
        db.refresh(payment)
        logger.info("Consultation %s payment manually confirmed by admin %s",
                    consultation_id, admin.id)

    consultation = db.get(Consultation, consultation_id)
    return PaymentStatusResponse(
        payment_id=payment.id,
        status=payment.status,
        consultation_paid=bool(consultation and consultation.payment_status == "paid"),
    )


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
        .filter(HealthPayment.provider_reference == provider_ref)
        .first()
    )
    if not payment:
        return {"status": "no_match"}

    payment.status = new_status
    if new_status == "paid":
        _mark_consultation_paid(db, payment)
    db.add(payment)
    db.commit()
    logger.info("Webhook %s updated payment %s -> %s", provider, payment.id, new_status)
    return {"status": "ok", "payment_id": payment.id, "new_status": new_status}


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
        )
        for p in payments
    ]
