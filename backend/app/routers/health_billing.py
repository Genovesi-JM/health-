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
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import User
from app.health_models import Patient, Consultation, HealthPayment
from app.health_schemas import (
    ConsultCheckoutRequest, ConsultCheckoutResponse, PaymentStatusResponse,
    InvoiceOut,
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
        return bool(adapter.merchant_id and adapter.api_key)
    if isinstance(adapter, VisaMastercardAdapter):
        return bool(adapter.api_key)
    if isinstance(adapter, IBANTransferAdapter):
        return True  # manual transfer needs no external credentials
    if isinstance(adapter, PayPalAdapter):
        return bool(getattr(adapter, "client_id", "") and getattr(adapter, "secret", ""))
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
    if existing:
        meta = json.loads(existing.metadata_json or "{}")
        return ConsultCheckoutResponse(
            payment_id=existing.id, status=existing.status,
            amount=existing.amount, currency=existing.currency,
            provider=existing.provider, provider_reference=existing.provider_reference,
            qr_code=meta.get("qr_code"), redirect_url=meta.get("redirect_url"),
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

    payment.status = _to_health_status(result.status)
    payment.provider_reference = result.provider_reference
    payment.metadata_json = json.dumps({
        "qr_code": result.qr_code,
        "redirect_url": result.redirect_url,
        "mock": bool((result.raw_response or {}).get("mock")),
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
