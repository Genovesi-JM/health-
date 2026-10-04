"""Dated appointment capacity and transaction-scoped concurrency guards.

An UPDATE of the existing clinician/patient row acquires a database write lock
on SQLite and a row lock on PostgreSQL. Always lock doctor before patient and
read conflicts after acquiring the lock. All consultation state transitions use
the same guards, including the independent video-start route.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.health_models import AppointmentSlot, Consultation, Doctor, Patient
from app.models import User
from app.services.clinician_access import require_current_clinician

MARKET_ZONES = {"AO": ("Africa/Luanda",), "PT": ("Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores")}
BLOCKING = ("requested", "scheduled", "in_progress")


def utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise HTTPException(422, "Indique uma data e hora com fuso horário.")
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def stamp(value: datetime) -> str:
    return value.replace(tzinfo=timezone.utc).isoformat()


def valid_zone(country: str, zone: str) -> ZoneInfo:
    if zone not in MARKET_ZONES.get(country, ()):
        raise HTTPException(422, "O fuso horário não corresponde ao país escolhido.")
    return ZoneInfo(zone)


def slot_interval(start: datetime, end: datetime, country: str, zone: str):
    selected = valid_zone(country, zone)
    for value in (start, end):
        utc(value)
        # The submitted local offset must be real in the selected IANA zone.
        # A spring gap cannot round-trip. A repeated hour is explicit via offset.
        if value.astimezone(selected).utcoffset() != value.utcoffset():
            raise HTTPException(422, "A hora e o desfasamento não correspondem ao fuso selecionado.")
    start, end = utc(start), utc(end)
    if start <= datetime.utcnow() or start > datetime.utcnow() + timedelta(days=180):
        raise HTTPException(422, "Publique horários futuros até 180 dias.")
    if not timedelta(minutes=15) <= end - start <= timedelta(minutes=120):
        raise HTTPException(422, "O horário deve durar entre 15 e 120 minutos.")
    return start, end


def window(start: datetime | None, end: datetime | None):
    beginning = utc(start) if start else datetime.utcnow()
    ending = utc(end) if end else beginning + timedelta(days=31)
    if ending <= beginning or ending - beginning > timedelta(days=31):
        raise HTTPException(422, "Escolha um intervalo até 31 dias.")
    return beginning, ending


def lock_resources(db: Session, doctor_id: str | None, patient_id: str | None = None):
    for model, identifier in ((Doctor, doctor_id), (Patient, patient_id)):
        if identifier:
            table = model.__table__
            result = db.execute(update(table).where(table.c.id == identifier).values(id=identifier))
            if result.rowcount != 1:
                raise HTTPException(409, "O perfil deixou de estar disponível.")


def current_doctor(db: Session, doctor_id: str, country: str | None) -> Doctor:
    doctor = db.get(Doctor, doctor_id, populate_existing=True)
    if not doctor:
        raise HTTPException(404, "Médico não encontrado.")
    user = db.get(User, doctor.user_id, populate_existing=True)
    if not user:
        raise HTTPException(409, "Este médico não está disponível para marcação.")
    # Expire credential state cached by earlier authentication dependencies.
    db.expire_all()
    credential = require_current_clinician(user, db)
    if country is not None and credential.practice_country != country:
        raise HTTPException(409, "O médico não está disponível no país escolhido.")
    return doctor


def ensure_capacity(db: Session, *, doctor_id: str | None, patient_id: str | None,
                    start: datetime | None, end: datetime | None,
                    exclude_id: str | None = None, starting: bool = False):
    now = datetime.utcnow()
    begin = start or now
    finish = end or begin + timedelta(minutes=30)
    if starting:
        duration = end - start if start and end and end > start else timedelta(minutes=30)
        begin = now
        finish = max(finish, now + duration)
    from sqlalchemy import or_
    predicates = []
    if doctor_id:
        predicates.append(Consultation.doctor_id == doctor_id)
    if patient_id:
        predicates.append(Consultation.patient_id == patient_id)
    query = db.query(Consultation).filter(Consultation.status.in_(BLOCKING), or_(*predicates))
    if exclude_id:
        query = query.filter(Consultation.id != exclude_id)
    for other in query.populate_existing().all():
        if other.status == "in_progress" and starting:
            raise HTTPException(409, "Já existe uma consulta em curso para o médico ou paciente.")
        if other.scheduled_at:
            other_start = other.scheduled_at
            other_end = other.scheduled_end_at or other_start + timedelta(minutes=30)
            if other.status == "in_progress":
                other_end = max(other_end, now + timedelta(minutes=30))
        elif other.status == "in_progress":
            other_start = other.started_at or now
            other_end = now + timedelta(minutes=30)
        else:
            # An unassigned queue request has no promised clock time. Do not
            # allow another unscheduled request for that same patient.
            if start is None and patient_id and other.patient_id == patient_id:
                raise HTTPException(409, "Já existe um pedido sem horário para este paciente.")
            continue
        if begin < other_end and finish > other_start:
            raise HTTPException(409, "O médico ou paciente já tem uma consulta neste horário.")


def guard_transition(db: Session, consultation: Consultation, status: str, doctor_id: str | None):
    lock_resources(db, doctor_id, consultation.patient_id)
    if status in ("scheduled", "in_progress"):
        current_doctor(db, doctor_id, consultation.country)
        if consultation.slot_id:
            slot = db.get(AppointmentSlot, consultation.slot_id, populate_existing=True)
            if not slot or slot.withdrawn or slot.reserved_consultation_id != consultation.id:
                raise HTTPException(409, "O horário reservado já não está disponível.")
            if status == "scheduled" and slot.starts_at <= datetime.utcnow():
                raise HTTPException(409, "Este horário já passou. Cancele o pedido e escolha outro.")
        ensure_capacity(db, doctor_id=doctor_id, patient_id=consultation.patient_id,
                        start=consultation.scheduled_at, end=consultation.scheduled_end_at,
                        exclude_id=consultation.id, starting=status == "in_progress")


def release_cancelled_slot(db: Session, consultation: Consultation):
    if consultation.slot_id:
        table = AppointmentSlot.__table__
        db.execute(update(table).where(table.c.id == consultation.slot_id,
                   table.c.reserved_consultation_id == consultation.id).values(reserved_consultation_id=None))


def slot_out(slot: AppointmentSlot, db: Session):
    doctor = db.get(Doctor, slot.doctor_id)
    user = db.get(User, doctor.user_id)
    name = doctor.display_name or (user.profile.full_name if user.profile else None) or "Médico"
    return {"id": slot.id, "doctor_id": slot.doctor_id, "doctor_name": name,
            "specialty": doctor.specialization, "country": slot.country, "timezone": slot.timezone,
            "starts_at": stamp(slot.starts_at), "ends_at": stamp(slot.ends_at),
            "status": "withdrawn" if slot.withdrawn else "reserved" if slot.reserved_consultation_id else "open"}
