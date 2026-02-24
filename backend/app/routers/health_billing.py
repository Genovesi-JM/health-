from __future__ import annotations
"""
Health Billing Router — Consultation payments and invoices.

Endpoints:
- POST /api/v1/billing/consultation/checkout — Create payment for a consultation
- POST /api/v1/billing/webhook — Payment webhook (optional for MVP)
- GET  /api/v1/billing/me/invoices — Patient's payment history
"""
import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import Patient, Consultation, HealthPayment
from app.health_schemas import (
    ConsultCheckoutRequest, ConsultCheckoutResponse,
    InvoiceOut, RoleEnum,
)
from app.rbac import get_patient_for_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

# MVP consultation price in AOA centavos (50,000 AOA = ~$60)
CONSULT_PRICE_AOA = 5000000  # 50,000.00 AOA in centavos
CONSULT_CURRENCY = "AOA"


@router.post("/consultation/checkout", response_model=ConsultCheckoutResponse)
def checkout_consultation(
    body: ConsultCheckoutRequest,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a payment for a consultation."""
    consultation = db.query(Consultation).filter(
        Consultation.id == body.consultation_id,
        Consultation.patient_id == patient.id,
    ).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    if consultation.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Consulta já paga.")

    # Create payment record (MVP: manual simulation with "paid" status)
    payment = HealthPayment(
        patient_id=patient.id,
        consultation_id=consultation.id,
        payment_type="consultation",
        amount=CONSULT_PRICE_AOA,
        currency=CONSULT_CURRENCY,
        status="paid",  # MVP: auto-mark as paid
        provider=body.payment_method or "manual",
        description=f"Consulta {consultation.specialty} — {consultation.id[:8]}",
    )
    db.add(payment)

    # Update consultation payment status
    consultation.payment_status = "paid"
    consultation.payment_id = payment.id
    db.add(consultation)
    db.commit()
    db.refresh(payment)

    return ConsultCheckoutResponse(
        payment_id=payment.id,
        status=payment.status,
        amount=payment.amount,
        currency=payment.currency,
    )


@router.post("/webhook")
def billing_webhook():
    """Payment webhook endpoint (stub for MVP)."""
    # In production, verify Stripe/Multicaixa webhook signature
    # and update payment + consultation status accordingly
    return {"detail": "Webhook received (stub)."}


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
