"""Seed data helpers for the Health Platform."""

from __future__ import annotations

import json
from typing import List

from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.database import SessionLocal
from app.health_models import Patient, Doctor
from app.utils import hash_password


# ── Seed accounts ──

SEED_PASSWORD = "SeedDefault@1234"   # fallback if ADMIN_PASSWORD not set

ADMIN_USERS: List[dict] = [
    {
        "email": "genovesi.maria@geovisionops.com",
        "role": "admin",
    },
]

PATIENT_USERS: List[dict] = [
    {
        "email": "paciente@health.com",
        "role": "patient",
        "profile": {
            "date_of_birth": "1990-05-15",
            "gender": "female",
            "blood_type": "A+",
            "allergies": ["Penicilina", "Glúten"],
            "chronic_conditions": ["Asma"],
            "emergency_contact_name": "Carlos Silva",
            "emergency_contact_phone": "+244 923 456 789",
        },
    },
    {
        "email": "joao.paciente@health.com",
        "role": "patient",
        "profile": {
            "date_of_birth": "1985-11-22",
            "gender": "male",
            "blood_type": "O-",
            "allergies": [],
            "chronic_conditions": ["Diabetes Tipo 2", "Hipertensão"],
            "emergency_contact_name": "Ana Santos",
            "emergency_contact_phone": "+244 912 345 678",
        },
    },
]

DOCTOR_USERS: List[dict] = [
    {
        "email": "medico@health.com",
        "role": "doctor",
        "profile": {
            "license_number": "OM-2024-001",
            "specialization": "clinica_geral",
            "bio": "Médico de clínica geral com 10 anos de experiência.",
            "verification_status": "verified",
        },
    },
    {
        "email": "dra.ana@health.com",
        "role": "doctor",
        "profile": {
            "license_number": "OM-2024-002",
            "specialization": "cardiologia",
            "bio": "Cardiologista especializada em prevenção cardiovascular.",
            "verification_status": "verified",
        },
    },
]


def seed_admin_users() -> int:
    """Create admin user(s) if they do not exist."""
    password = (settings.admin_password or "").strip() or SEED_PASSWORD

    db: Session = SessionLocal()
    inserted = 0
    try:
        for user_data in ADMIN_USERS:
            exists = (
                db.query(models.User)
                .filter(models.User.email == user_data["email"])
                .first()
            )
            if exists:
                if not getattr(exists, "role", None):
                    exists.role = user_data.get("role", "admin")
                    db.add(exists)
                continue

            db.add(
                models.User(
                    email=user_data["email"],
                    password_hash=hash_password(password),
                    role=user_data.get("role", "admin"),
                )
            )
            inserted += 1

        db.commit()
        print(f"[HealthPlatform] Admin users created: {inserted}")
        return inserted
    finally:
        db.close()


def seed_patient_users() -> int:
    """Create patient test accounts with full clinical profiles."""
    password = (settings.admin_password or "").strip() or SEED_PASSWORD

    db: Session = SessionLocal()
    inserted = 0
    try:
        for pdata in PATIENT_USERS:
            exists = db.query(models.User).filter(models.User.email == pdata["email"]).first()
            if exists:
                continue

            user = models.User(
                email=pdata["email"],
                password_hash=hash_password(password),
                role="patient",
            )
            db.add(user)
            db.flush()  # get user.id

            prof = pdata["profile"]
            patient = Patient(
                user_id=user.id,
                date_of_birth=prof.get("date_of_birth"),
                gender=prof.get("gender"),
                blood_type=prof.get("blood_type"),
                allergies_json=json.dumps(prof.get("allergies", [])),
                chronic_conditions_json=json.dumps(prof.get("chronic_conditions", [])),
                emergency_contact_name=prof.get("emergency_contact_name"),
                emergency_contact_phone=prof.get("emergency_contact_phone"),
            )
            db.add(patient)
            inserted += 1

        db.commit()
        print(f"[HealthPlatform] Patient users created: {inserted}")
        return inserted
    finally:
        db.close()


def seed_doctor_users() -> int:
    """Create doctor test accounts with verified profiles."""
    password = (settings.admin_password or "").strip() or SEED_PASSWORD

    db: Session = SessionLocal()
    inserted = 0
    try:
        for ddata in DOCTOR_USERS:
            exists = db.query(models.User).filter(models.User.email == ddata["email"]).first()
            if exists:
                continue

            user = models.User(
                email=ddata["email"],
                password_hash=hash_password(password),
                role="doctor",
            )
            db.add(user)
            db.flush()

            prof = ddata["profile"]
            doctor = Doctor(
                user_id=user.id,
                license_number=prof["license_number"],
                specialization=prof.get("specialization", "clinica_geral"),
                bio=prof.get("bio"),
                verification_status=prof.get("verification_status", "pending"),
            )
            db.add(doctor)
            inserted += 1

        db.commit()
        print(f"[HealthPlatform] Doctor users created: {inserted}")
        return inserted
    finally:
        db.close()


def seed_all() -> dict:
    """Run all seed functions. Returns counts."""
    return {
        "admins": seed_admin_users(),
        "patients": seed_patient_users(),
        "doctors": seed_doctor_users(),
    }
