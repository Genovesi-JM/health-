from __future__ import annotations
"""
Health Device Shop — a small catalog of monitoring devices/kits patients can buy.

Payments reuse the same orchestrator as consultations (Multicaixa Express by
default), creating a HealthPayment with payment_type="device". Never silently
simulates a payment in production.

- GET  /api/v1/shop/devices                    — catalog
- POST /api/v1/shop/devices/{device_id}/checkout — start a purchase (pending)
- GET  /api/v1/shop/payments/{payment_id}/status — poll + reconcile
- GET  /api/v1/shop/orders/me                   — the patient's device orders
"""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.health_models import Patient, HealthPayment
from app.rbac import get_patient_for_user
from app.services.payments import (
    PaymentIntent, PaymentProvider, PaymentStatus, Currency, MulticaixaExpressAdapter,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["shop"])

_IS_PRODUCTION = settings.env in ("production", "prod")
_MCX = MulticaixaExpressAdapter()

# Hardcoded catalog (prices in AOA centavos). Small and stable for the pilot.
DEVICE_CATALOG = [
    {"id": "bp-monitor", "name": "Medidor de Tensão Arterial", "category": "Cardiovascular",
     "description": "Monitor digital de braço, com deteção de arritmia e memória.", "price": 2500000},
    {"id": "glucometer", "name": "Glicómetro + 50 tiras", "category": "Diabetes",
     "description": "Kit de medição de glicemia capilar com lancetas e tiras.", "price": 1800000},
    {"id": "oximeter", "name": "Oxímetro de Pulso", "category": "Respiratório",
     "description": "Medição de SpO₂ e frequência cardíaca ao dedo.", "price": 900000},
    {"id": "thermometer", "name": "Termómetro Infravermelho", "category": "Geral",
     "description": "Termómetro sem contacto, leitura em 1 segundo.", "price": 750000},
    {"id": "scale", "name": "Balança Digital com IMC", "category": "Geral",
     "description": "Peso, IMC e composição corporal, sincronizável.", "price": 1500000},
    {"id": "chronic-kit", "name": "Kit Cuidado Crónico", "category": "Programa Crónico",
     "description": "Tensão + glicemia + oxímetro, para acompanhamento contínuo.", "price": 5500000},
]
_CATALOG_BY_ID = {d["id"]: d for d in DEVICE_CATALOG}


class DeviceOut(BaseModel):
    id: str
    name: str
    category: str
    description: str
    price: int          # centavos
    price_label: str    # "25.000 Kz"


class DeviceCheckoutRequest(BaseModel):
    payment_method: Optional[str] = None


class DeviceCheckoutResponse(BaseModel):
    payment_id: str
    status: str
    amount: int
    currency: str
    provider: Optional[str] = None
    provider_reference: Optional[str] = None
    qr_code: Optional[str] = None


class DeviceOrderOut(BaseModel):
    id: str
    description: Optional[str] = None
    amount: int
    currency: str
    status: str
    created_at: str


def _kz(centavos: int) -> str:
    return f"{(centavos or 0)/100:,.0f}".replace(",", ".") + " Kz"


@router.get("/api/v1/shop/devices", response_model=List[DeviceOut])
def list_devices():
    return [DeviceOut(**d, price_label=_kz(d["price"])) for d in DEVICE_CATALOG]


@router.post("/api/v1/shop/devices/{device_id}/checkout", response_model=DeviceCheckoutResponse)
async def checkout_device(
    device_id: str,
    body: DeviceCheckoutRequest,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    device = _CATALOG_BY_ID.get(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo não encontrado.")

    provider = PaymentProvider.MULTICAIXA_EXPRESS
    if _IS_PRODUCTION and not (_MCX.merchant_id and _MCX.api_key):
        raise HTTPException(status_code=503, detail="Pagamentos indisponíveis de momento.")

    payment = HealthPayment(
        patient_id=patient.id, payment_type="device",
        amount=device["price"], currency="AOA", status="pending",
        provider=provider.value, description=f"Dispositivo: {device['name']}",
    )
    db.add(payment)
    db.flush()

    intent = PaymentIntent(
        id=payment.id, company_id="kaya", order_id=payment.id,
        amount=device["price"], currency=Currency.AOA, provider=provider,
        description=payment.description or device["name"], idempotency_key=payment.id,
    )
    result = await _MCX.create_payment(intent)
    if not result.success:
        payment.status = "failed"; db.commit()
        raise HTTPException(status_code=502, detail=result.error_message or "Falha ao iniciar o pagamento.")

    payment.provider_reference = result.provider_reference
    payment.metadata_json = json.dumps({"qr_code": result.qr_code, "device_id": device_id})
    payment.status = "paid" if result.status == PaymentStatus.COMPLETED else "pending"
    db.add(payment); db.commit(); db.refresh(payment)

    return DeviceCheckoutResponse(
        payment_id=payment.id, status=payment.status, amount=payment.amount,
        currency=payment.currency, provider=payment.provider,
        provider_reference=payment.provider_reference, qr_code=result.qr_code,
    )


@router.get("/api/v1/shop/payments/{payment_id}/status")
async def device_payment_status(
    payment_id: str,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    payment = db.query(HealthPayment).filter(
        HealthPayment.id == payment_id, HealthPayment.patient_id == patient.id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")
    if payment.status == "pending" and payment.provider_reference:
        provider_status = await _MCX.check_status(payment.provider_reference)
        if provider_status == PaymentStatus.COMPLETED:
            payment.status = "paid"; db.add(payment); db.commit(); db.refresh(payment)
        elif provider_status in (PaymentStatus.FAILED, PaymentStatus.CANCELLED):
            payment.status = "failed"; db.add(payment); db.commit(); db.refresh(payment)
    return {"payment_id": payment.id, "status": payment.status}


@router.get("/api/v1/shop/orders/me", response_model=List[DeviceOrderOut])
def my_orders(patient: Patient = Depends(get_patient_for_user), db: Session = Depends(get_db)):
    rows = (
        db.query(HealthPayment)
        .filter(HealthPayment.patient_id == patient.id, HealthPayment.payment_type == "device")
        .order_by(HealthPayment.created_at.desc()).limit(50).all()
    )
    return [DeviceOrderOut(id=p.id, description=p.description, amount=p.amount,
                           currency=p.currency, status=p.status, created_at=p.created_at.isoformat()) for p in rows]
