"""Patient transport & ambulance requests.

Patients create requests (scheduled, accessible, assisted or an emergency
pre-alert) and follow their status. Nothing here dispatches a vehicle: the
request is recorded for the transport operator and the patient is told to
call the emergency number for life-threatening situations.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import Notification, Patient, TransportRequest, TRANSPORT_KINDS
from app.models import User
from app.rbac import get_patient_for_user

router = APIRouter(prefix="/api/v1/transport", tags=["transport"])

Kind = Literal["scheduled", "accessible", "assisted", "emergency"]

KIND_LABELS = {
    "scheduled": "Transporte agendado",
    "accessible": "Mobilidade acessível",
    "assisted": "Transferência assistida",
    "emergency": "Emergência pré-hospitalar",
}


class TransportRequestIn(BaseModel):
    kind: Kind
    pickup_address: str = Field(min_length=3, max_length=300)
    destination: str = Field(min_length=2, max_length=300)
    scheduled_for: Optional[datetime] = None
    mobility_needs: Optional[str] = Field(default=None, max_length=1000)
    companion: bool = False
    notes: Optional[str] = Field(default=None, max_length=1000)
    consultation_id: Optional[str] = None


class TransportRequestOut(BaseModel):
    id: str
    kind: Kind
    kind_label: str
    status: str
    pickup_address: str
    destination: str
    scheduled_for: Optional[datetime]
    mobility_needs: Optional[str]
    companion: bool
    notes: Optional[str]
    consultation_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    guidance: Optional[str] = None


def _out(r: TransportRequest, guidance: Optional[str] = None) -> TransportRequestOut:
    return TransportRequestOut(
        id=r.id, kind=r.kind, kind_label=KIND_LABELS.get(r.kind, r.kind), status=r.status,
        pickup_address=r.pickup_address, destination=r.destination, scheduled_for=r.scheduled_for,
        mobility_needs=r.mobility_needs, companion=bool(r.companion), notes=r.notes,
        consultation_id=r.consultation_id, created_at=r.created_at, updated_at=r.updated_at, guidance=guidance,
    )


EMERGENCY_GUIDANCE = (
    "Em risco de vida ligue já para o 112. Este pedido avisa a rede KAYA e o hospital de destino, "
    "mas não substitui a chamada de emergência."
)


@router.get("/kinds")
def transport_kinds():
    return [{"kind": k, "label": KIND_LABELS[k]} for k in TRANSPORT_KINDS]


@router.get("/requests/me", response_model=List[TransportRequestOut])
def my_requests(patient: Patient = Depends(get_patient_for_user), db: Session = Depends(get_db)):
    rows = (db.query(TransportRequest).filter(TransportRequest.patient_id == patient.id)
            .order_by(TransportRequest.created_at.desc()).limit(50).all())
    return [_out(r) for r in rows]


@router.post("/requests", response_model=TransportRequestOut, status_code=201)
def create_request(body: TransportRequestIn, patient: Patient = Depends(get_patient_for_user),
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    scheduled = body.scheduled_for
    if scheduled is not None and scheduled.tzinfo is not None:
        # Store naive UTC like the rest of the schema.
        scheduled = scheduled.astimezone(timezone.utc).replace(tzinfo=None)
    if body.kind != "emergency" and scheduled is None:
        raise HTTPException(422, "Indique a data e hora pretendidas para o transporte.")
    if body.kind != "emergency" and scheduled is not None and scheduled < datetime.utcnow():
        raise HTTPException(422, "A data do transporte tem de ser no futuro.")
    row = TransportRequest(
        patient_id=patient.id, consultation_id=body.consultation_id, kind=body.kind, status="requested",
        pickup_address=body.pickup_address.strip(), destination=body.destination.strip(),
        scheduled_for=scheduled if body.kind != "emergency" else datetime.utcnow(),
        mobility_needs=(body.mobility_needs or "").strip() or None, companion=body.companion,
        notes=(body.notes or "").strip() or None, country="AO",
    )
    db.add(row)
    db.flush()
    title = "Pedido de emergência registado" if body.kind == "emergency" else "Pedido de transporte registado"
    msg = (EMERGENCY_GUIDANCE if body.kind == "emergency"
           else f"{KIND_LABELS[body.kind]} para {row.destination}. Aguarde a confirmação do operador.")
    db.add(Notification(user_id=user.id, title=title, message=msg, type="transport",
                        related_entity_type="transport_request", related_entity_id=row.id))
    db.commit()
    db.refresh(row)
    return _out(row, EMERGENCY_GUIDANCE if body.kind == "emergency" else None)


@router.post("/requests/{request_id}/cancel", response_model=TransportRequestOut)
def cancel_request(request_id: str, patient: Patient = Depends(get_patient_for_user), db: Session = Depends(get_db)):
    row = db.query(TransportRequest).filter(TransportRequest.id == request_id, TransportRequest.patient_id == patient.id).first()
    if not row:
        raise HTTPException(404, "Pedido não encontrado.")
    if row.status not in ("requested", "confirmed"):
        raise HTTPException(409, "Este pedido já não pode ser cancelado.")
    row.status = "cancelled"
    db.commit()
    db.refresh(row)
    return _out(row)
