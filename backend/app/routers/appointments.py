"""Published appointment intervals, independent of recurring profile hours."""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import AppointmentSlot, Doctor, HealthAuditLog
from app.rbac import require_verified_doctor
from app.services.specialties import normalize_specialty
from app.services.appointments import (MARKET_ZONES, current_doctor, ensure_capacity,
    lock_resources, slot_interval, slot_out, window)

router = APIRouter(tags=["appointments"])


class PublishSlot(BaseModel):
    country: Literal["AO", "PT"]
    timezone: str
    starts_at: datetime
    ends_at: datetime


def _private(response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"


@router.get("/api/v1/appointments/capabilities")
def capabilities(user: User = Depends(get_current_user)):
    return {"enabled": True, "markets": [{"country": country, "timezones": list(zones)} for country, zones in MARKET_ZONES.items()],
            "max_window_days": 31, "max_publish_days": 180, "slot_duration_minutes": {"min": 15, "max": 120}}


@router.get("/api/v1/appointments/slots")
def available_slots(response: Response, country: Literal["AO", "PT"] = "AO", specialty: str | None = None,
                    doctor_id: str | None = None, from_at: datetime | None = None, to_at: datetime | None = None,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    start, end = window(from_at, to_at)
    query = db.query(AppointmentSlot).filter(AppointmentSlot.country == country,
        AppointmentSlot.starts_at >= max(start, datetime.utcnow()), AppointmentSlot.starts_at < end,
        AppointmentSlot.withdrawn.is_(False), AppointmentSlot.reserved_consultation_id.is_(None))
    if doctor_id:
        query = query.filter(AppointmentSlot.doctor_id == doctor_id)
    result = []
    for slot in query.order_by(AppointmentSlot.starts_at, AppointmentSlot.id).all():
        try:
            doctor = current_doctor(db, slot.doctor_id, country)
            if specialty and normalize_specialty(doctor.specialization) != normalize_specialty(specialty):
                continue
            ensure_capacity(db, doctor_id=doctor.id, patient_id=None, start=slot.starts_at, end=slot.ends_at)
        except HTTPException:
            continue
        result.append(slot_out(slot, db))
    _private(response)
    return result


@router.get("/api/v1/doctor/appointment-slots")
def my_slots(response: Response, from_at: datetime | None = None, to_at: datetime | None = None,
             user: User = Depends(require_verified_doctor), db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter_by(user_id=user.id).one()
    start, end = window(from_at, to_at)
    rows = db.query(AppointmentSlot).filter(AppointmentSlot.doctor_id == doctor.id,
        AppointmentSlot.starts_at >= start, AppointmentSlot.starts_at < end).order_by(AppointmentSlot.starts_at, AppointmentSlot.id).all()
    _private(response)
    return [slot_out(slot, db) for slot in rows]


@router.post("/api/v1/doctor/appointment-slots", status_code=201)
def publish_slot(body: PublishSlot, response: Response, user: User = Depends(require_verified_doctor), db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter_by(user_id=user.id).one()
    start, end = slot_interval(body.starts_at, body.ends_at, body.country, body.timezone)
    lock_resources(db, doctor.id)
    current_doctor(db, doctor.id, body.country)
    existing = db.query(AppointmentSlot).filter(AppointmentSlot.doctor_id == doctor.id,
        AppointmentSlot.withdrawn.is_(False), AppointmentSlot.starts_at < end, AppointmentSlot.ends_at > start).first()
    if existing:
        raise HTTPException(409, "Já existe um horário publicado neste intervalo.")
    ensure_capacity(db, doctor_id=doctor.id, patient_id=None, start=start, end=end)
    slot = AppointmentSlot(doctor_id=doctor.id, country=body.country, timezone=body.timezone, starts_at=start, ends_at=end)
    db.add(slot)
    db.flush()
    db.add(HealthAuditLog(actor_user_id=user.id, action="appointment_slot_published", resource_type="appointment_slot", resource_id=slot.id))
    db.commit()
    db.refresh(slot)
    _private(response)
    return slot_out(slot, db)


@router.delete("/api/v1/doctor/appointment-slots/{slot_id}")
def withdraw_slot(slot_id: str, user: User = Depends(require_verified_doctor), db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter_by(user_id=user.id).one()
    lock_resources(db, doctor.id)
    slot = db.query(AppointmentSlot).filter_by(id=slot_id, doctor_id=doctor.id).populate_existing().first()
    if not slot:
        raise HTTPException(404, "Horário não encontrado.")
    if slot.withdrawn:
        return {"id": slot.id, "status": "withdrawn"}
    table = AppointmentSlot.__table__
    changed = db.execute(update(table).where(table.c.id == slot.id, table.c.reserved_consultation_id.is_(None),
                        table.c.withdrawn.is_(False)).values(withdrawn=True))
    if changed.rowcount != 1:
        raise HTTPException(409, "Este horário está reservado. Resolva primeiro o pedido de consulta.")
    db.add(HealthAuditLog(actor_user_id=user.id, action="appointment_slot_withdrawn", resource_type="appointment_slot", resource_id=slot.id))
    db.commit()
    return {"id": slot.id, "status": "withdrawn"}
