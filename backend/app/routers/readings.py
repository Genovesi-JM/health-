from __future__ import annotations
"""
Device Readings Router — Manual patient health measurements.

Endpoints:
- GET  /api/v1/readings/me                        → patient's own readings
- POST /api/v1/readings                            → create a reading (patient)
- GET  /api/v1/readings/patient/{patient_id}       → doctor/admin view
- DELETE /api/v1/readings/{reading_id}             → patient or admin delete
"""
import logging
import csv
import io
import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import DeviceReading, Patient, Doctor
from app.health_schemas import (
    DeviceReadingCreate,
    DeviceReadingOut,
    DeviceReadingListOut,
    HealthSyncRequest,
    HealthSyncResponse,
    RoleEnum,
)
from app.rbac import get_patient_for_user, require_roles, assert_doctor_can_access_patient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/readings", tags=["readings"])

MAX_IMPORT_BYTES = 2 * 1024 * 1024

SYNC_RANGES = {
    "weight": (2, 500),
    "body_fat": (0, 100),
    "bmi": (5, 100),
    "lean_body_mass": (0, 500),
    "body_water_mass": (0, 500),
    "bone_mass": (0, 100),
    "height": (0.3, 2.7),
    "waist_circumference": (20, 300),
    "basal_metabolic_rate": (100, 10_000),
    "heart_rate": (20, 260),
    "oxygen_saturation": (40, 100),
    "temperature": (25, 45),
    "glucose": (10, 1000),
}


def _normalise_header(value: str) -> str:
    return "".join(ch for ch in value.lower().strip() if ch.isalnum())


def _first_value(row: dict[str, str], aliases: tuple[str, ...]) -> Optional[str]:
    normalised = {_normalise_header(key): value for key, value in row.items() if key}
    for alias in aliases:
        value = normalised.get(_normalise_header(alias))
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def _parse_import_datetime(value: Optional[str]) -> datetime:
    if not value:
        return datetime.utcnow()
    cleaned = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(cleaned)
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except ValueError:
        pass
    for fmt in (
        "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",
        "%d/%m/%Y %H:%M", "%m/%d/%Y %H:%M",
        "%Y-%m-%d", "%d/%m/%Y",
    ):
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unsupported measurement date: {value}")


# ── helpers ──────────────────────────────────────────────────────────────────

def _build_reading(patient_id: str, body: DeviceReadingCreate) -> DeviceReading:
    """Map schema → model, defaulting measured_at to now."""
    return DeviceReading(
        patient_id=patient_id,
        reading_type=body.reading_type,
        value=body.value,
        unit=body.unit,
        systolic=body.systolic,
        diastolic=body.diastolic,
        pulse=body.pulse,
        measured_at=body.measured_at or datetime.utcnow(),
        source=body.source or "manual",
        device_brand=body.device_brand,
        device_model=body.device_model,
        notes=body.notes,
    )


def _validate_reading(body: DeviceReadingCreate) -> None:
    """Cross-field validation beyond the Pydantic regex."""
    if body.reading_type == "blood_pressure":
        if body.systolic is None or body.diastolic is None:
            raise HTTPException(
                status_code=422,
                detail="blood_pressure readings require systolic and diastolic values.",
            )
    else:
        if body.value is None:
            raise HTTPException(
                status_code=422,
                detail=f"{body.reading_type} readings require a value.",
            )


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=DeviceReadingListOut)
def list_my_readings(
    reading_type: Optional[str] = Query(default=None, description="Filter by type"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Return paginated readings for the authenticated patient."""
    q = db.query(DeviceReading).filter(DeviceReading.patient_id == patient.id)
    if reading_type:
        q = q.filter(DeviceReading.reading_type == reading_type)
    total = q.count()
    readings = (
        q.order_by(DeviceReading.measured_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return DeviceReadingListOut(total=total, readings=readings)


@router.post("", response_model=DeviceReadingOut, status_code=201)
def create_reading(
    body: DeviceReadingCreate,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Create a new device reading for the authenticated patient."""
    _validate_reading(body)
    reading = _build_reading(patient.id, body)
    db.add(reading)
    db.commit()
    db.refresh(reading)
    logger.info("DeviceReading created id=%s type=%s patient=%s", reading.id, reading.reading_type, patient.id)
    return reading


@router.post("/sync", response_model=HealthSyncResponse)
def sync_health_readings(
    body: HealthSyncRequest,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Upsert consented Apple Health and Health Connect measurements.

    Platform sample identifiers make retries idempotent. A corrected sample is
    updated in place, while malformed or physiologically impossible values are
    ignored rather than entering the clinical measurement history.
    """
    imported = 0
    updated = 0
    skipped = 0
    now = datetime.utcnow()

    for item in body.records:
        minimum, maximum = SYNC_RANGES.get(item.reading_type, (-1_000_000, 1_000_000))
        if not minimum <= item.value <= maximum:
            skipped += 1
            continue
        measured_at = (
            item.measured_at.astimezone(timezone.utc).replace(tzinfo=None)
            if item.measured_at.tzinfo
            else item.measured_at
        )
        if measured_at > now:
            skipped += 1
            continue

        metadata = json.dumps(
            {"source_app": item.source_app, "platform_external_id": item.external_id},
            ensure_ascii=False,
        )
        existing = db.query(DeviceReading).filter(
            DeviceReading.patient_id == patient.id,
            DeviceReading.source == item.source,
            DeviceReading.external_id == item.external_id,
        ).first()
        if existing:
            changed = (
                float(existing.value or 0) != item.value
                or existing.unit != item.unit
                or existing.measured_at != measured_at
            )
            if changed:
                existing.reading_type = item.reading_type
                existing.value = item.value
                existing.unit = item.unit
                existing.measured_at = measured_at
                existing.device_brand = item.device_brand
                existing.device_model = item.device_model
                existing.notes = metadata
                db.add(existing)
                updated += 1
            else:
                skipped += 1
            continue

        db.add(DeviceReading(
            patient_id=patient.id,
            reading_type=item.reading_type,
            value=item.value,
            unit=item.unit,
            measured_at=measured_at,
            source=item.source,
            external_id=item.external_id,
            device_brand=item.device_brand,
            device_model=item.device_model,
            notes=metadata,
        ))
        imported += 1

    db.commit()
    logger.info(
        "Health sync patient=%s imported=%s updated=%s skipped=%s",
        patient.id, imported, updated, skipped,
    )
    return HealthSyncResponse(imported=imported, updated=updated, skipped=skipped)


@router.post("/import")
async def import_readings_csv(
    file: UploadFile = File(...),
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Import RENPHO Health (or compatible) CSV weight history.

    RENPHO does not expose a public partner cloud API. Its official app can
    export measurement history, so this endpoint is the consent-preserving,
    semi-automatic bridge until HealthKit/Health Connect mobile sync is enabled.
    """
    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=415, detail="Envie um ficheiro CSV exportado pela aplicação.")
    content = await file.read(MAX_IMPORT_BYTES + 1)
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="O CSV excede o limite de 2 MB.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("utf-16")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="Não foi possível ler a codificação do CSV.") from exc

    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.DictReader(io.StringIO(text), dialect=dialect))
    if not rows:
        raise HTTPException(status_code=422, detail="O CSV não contém medições.")

    imported = 0
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(rows[:2000], start=2):
        weight_value = _first_value(row, (
            "Weight(kg)", "Weight (kg)", "Weight/kg", "Weight",
            "Peso(kg)", "Peso (kg)", "Peso",
        ))
        weight_lb = _first_value(row, ("Weight(lb)", "Weight (lb)", "Weight/lb", "Peso(lb)"))
        if not weight_value and weight_lb:
            weight_value = str(float(weight_lb.replace(",", ".")) * 0.45359237)
        if not weight_value:
            skipped += 1
            continue
        try:
            weight = round(float(weight_value.replace(",", ".")), 3)
            if not 2 <= weight <= 500:
                raise ValueError("weight outside supported range")
            measured_at = _parse_import_datetime(_first_value(row, (
                "Time of Measurement", "Measurement Time", "Date", "Time",
                "Data da medição", "Data", "Hora",
            )))
        except (TypeError, ValueError) as exc:
            errors.append(f"Linha {index}: {exc}")
            continue

        duplicate = db.query(DeviceReading.id).filter(
            DeviceReading.patient_id == patient.id,
            DeviceReading.reading_type == "weight",
            DeviceReading.measured_at == measured_at,
            DeviceReading.source == "renpho_csv",
        ).first()
        if duplicate:
            skipped += 1
            continue

        composition_aliases = {
            "bmi": ("BMI", "IMC"),
            "body_fat_percent": ("Body Fat(%)", "Body Fat (%)", "Gordura corporal(%)"),
            "body_water_percent": ("Body Water(%)", "Body Water (%)", "Água corporal(%)"),
            "muscle_mass_kg": ("Muscle Mass(kg)", "Muscle Mass (kg)", "Massa muscular(kg)"),
            "bone_mass_kg": ("Bone Mass(kg)", "Bone Mass (kg)", "Massa óssea(kg)"),
            "visceral_fat": ("Visceral Fat", "Gordura visceral"),
            "metabolic_age": ("Metabolic Age", "Idade metabólica"),
        }
        composition = {}
        for key, aliases in composition_aliases.items():
            value = _first_value(row, aliases)
            if value:
                try:
                    composition[key] = float(value.replace(",", "."))
                except ValueError:
                    pass

        db.add(DeviceReading(
            patient_id=patient.id,
            reading_type="weight",
            value=weight,
            unit="kg",
            measured_at=measured_at,
            source="renpho_csv",
            device_brand="RENPHO",
            device_model="RENPHO Health CSV",
            notes=json.dumps({"body_composition": composition}, ensure_ascii=False),
        ))
        imported += 1

    db.commit()
    logger.info("CSV readings import patient=%s imported=%s skipped=%s", patient.id, imported, skipped)
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:20],
        "source": "renpho_csv",
    }


@router.get("/patient/{patient_id}", response_model=DeviceReadingListOut)
def list_patient_readings(
    patient_id: str,
    reading_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(require_roles([RoleEnum.DOCTOR, RoleEnum.ADMIN, RoleEnum.SUPPORT])),
    db: Session = Depends(get_db),
):
    """Doctor/admin endpoint — view any patient's readings."""
    # Verify the patient exists
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    # Doctors must have a clinical connection to the patient (consultation or prescription request).
    # Admins and support have unrestricted read access (audited separately).
    if user.role == RoleEnum.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            raise HTTPException(status_code=403, detail="Perfil de médico não encontrado.")
        assert_doctor_can_access_patient(doctor, patient_id, db)
    q = db.query(DeviceReading).filter(DeviceReading.patient_id == patient_id)
    if reading_type:
        q = q.filter(DeviceReading.reading_type == reading_type)
    total = q.count()
    readings = (
        q.order_by(DeviceReading.measured_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return DeviceReadingListOut(total=total, readings=readings)


@router.delete("/{reading_id}", status_code=204)
def delete_reading(
    reading_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a reading.

    - Patients may only delete their own readings.
    - Admin/support may delete any reading.
    """
    reading = db.get(DeviceReading, reading_id)
    if not reading:
        raise HTTPException(status_code=404, detail="Leitura não encontrada.")

    if user.role in (RoleEnum.ADMIN, RoleEnum.SUPPORT):
        # Privileged delete — no ownership check
        pass
    else:
        # Patient must own the reading
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient or reading.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="Não tem permissão para eliminar esta leitura.")

    db.delete(reading)
    db.commit()
