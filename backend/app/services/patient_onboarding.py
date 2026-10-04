"""Validate and materialize a patient wizard in the caller's transaction.

This service does not commit, send messages, verify contact ownership, or enable
clinical access. The submitted draft retains fields without a domain column.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timezone
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from fastapi import HTTPException, Request
from sqlalchemy.orm import Session

from app.health_models import HealthAuditLog, OnboardingDraft, Patient, PatientConsent
from app.identity import normalize_role
from app.models import User, UserProfile
from app.rbac import REQUIRED_CONSENTS


CONSENT_VERSION = "patient-onboarding-v1"
CONSENT_FIELDS = {
    "c_privacy": "privacy_policy",
    "c_telemedicine": "telemedicine_consent",
    "c_terms": "terms_of_service",
    "c_health": "health_data_processing",
    "c_medical_disclaimer": "medical_disclaimer",
}
OPTIONAL_CONSENT_FIELDS = ("c_family_share", "c_analytics", "c_marketing", "c_research")
SUPPORTED_MARKETS = frozenset({"AO", "PT"})


def _validate(user: User, payload: Any, profile: UserProfile | None) -> dict:
    errors: dict[str, str] = {}
    if not isinstance(payload, dict):
        payload = {}
    steps = {}
    for number in range(1, 9):
        step = payload.get(str(number))
        if not isinstance(step, dict):
            errors[str(number)] = "Dados da etapa em falta ou inválidos."
            step = {}
        steps[number] = step

    def text(step: int, key: str, *, required: bool = False, limit: int = 200) -> str | None:
        value = steps[step].get(key)
        if value is None and not required:
            return None
        if not isinstance(value, str):
            errors[f"{step}.{key}"] = "Introduza um texto válido."
            return None
        value = value.strip()
        if len(value) > limit or (required and not value):
            errors[f"{step}.{key}"] = "Preencha este campo com um valor válido."
            return None
        return value or None

    def phone(step: int, key: str, *, required: bool = False) -> str | None:
        value = text(step, key, required=required, limit=40)
        if value is None:
            return None
        value = re.sub(r"[\s()\-]", "", value)
        if not re.fullmatch(r"\+[1-9][0-9]{6,14}", value):
            errors[f"{step}.{key}"] = "Use o formato internacional, por exemplo +244900000000."
            return None
        return value

    language = text(1, "language", required=True, limit=10)
    if language not in {"pt", "en", "fr", "es", "zh"}:
        errors["1.language"] = "Selecione um idioma disponível."
    channel = text(1, "channel", required=True, limit=10)
    if channel not in {"email", "sms", "both"}:
        errors["1.channel"] = "Selecione uma preferência de contacto válida."

    email = text(2, "email", required=True, limit=254)
    if email is None or email.casefold() != user.email.strip().casefold():
        errors["2.email"] = "Use o email da conta. Altere o email nas definições de segurança."
    contact_phone = phone(2, "phone", required=channel in {"sms", "both"})
    if contact_phone and profile and profile.phone:
        existing_phone = re.sub(r"[\s()\-]", "", profile.phone)
        if contact_phone != existing_phone:
            errors["2.phone"] = "Altere o número existente nas definições de segurança."

    full_name = text(3, "full_name", required=True)
    dob = text(3, "dob", required=True, limit=10)
    try:
        if not dob or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", dob):
            raise ValueError
        if date.fromisoformat(dob) > datetime.now(timezone.utc).date():
            raise ValueError
    except ValueError:
        errors["3.dob"] = "Introduza uma data de nascimento válida que não seja futura."
    gender = text(3, "sex", limit=20)
    if gender not in {None, "female", "male", "intersex", "other"}:
        errors["3.sex"] = "Selecione uma opção válida."
    for key in ("preferred_name", "nationality"):
        text(3, key)

    country = text(4, "country", required=True, limit=2)
    if country not in SUPPORTED_MARKETS:
        errors["4.country"] = "Selecione Angola ou Portugal."
    city = text(4, "city")
    text(4, "province")
    text(4, "address", limit=500)

    blood_type = text(5, "blood_type", limit=10)
    if blood_type not in {None, "unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}:
        errors["5.blood_type"] = "Selecione um grupo sanguíneo válido."
    allergies = text(5, "allergies", limit=2000)
    chronic = text(5, "chronic", limit=2000)
    for key in ("medications", "surgeries"):
        text(5, key, limit=4000)

    emergency_name = text(6, "ec_name", required=True)
    emergency_phone = phone(6, "ec_phone", required=True)
    text(6, "ec_relation")
    phone(6, "ec_alt_phone")
    if steps[6].get("ec_consent") is not True:
        errors["6.ec_consent"] = "Confirme a autorização do contacto de emergência."

    if steps[7].get("catalog_country") != country or not isinstance(steps[7].get("catalog_language"), str):
        errors["7.consent_acceptances"] = "Escolha os textos aprovados para o país e idioma do perfil."
    if type(steps[7].get("consent_expected_revision")) is not int or steps[7].get("consent_expected_revision", -1) < 0:
        errors["7.consent_expected_revision"] = "Atualize o estado dos consentimentos."
    if not isinstance(steps[7].get("consent_acceptances"), list) or len(steps[7]["consent_acceptances"]) != len(CONSENT_FIELDS):
        errors["7.consent_acceptances"] = "Reveja e aceite cada um dos cinco textos aprovados."

    if errors:
        raise HTTPException(422, detail={
            "error": "invalid_patient_onboarding",
            "message": "Reveja os dados do perfil antes de concluir.",
            "fields": errors,
        })

    return {
        "steps": steps, "full_name": full_name, "phone": contact_phone,
        "dob": dob, "gender": gender, "country": country, "city": city,
        "blood_type": None if blood_type == "unknown" else blood_type,
        "allergies": [part.strip() for part in (allergies or "").split(",") if part.strip()],
        "chronic": [part.strip() for part in (chronic or "").split(",") if part.strip()],
        "emergency_name": emergency_name, "emergency_phone": emergency_phone,
        "language": language,
    }


def complete_patient_onboarding(db: Session, user: User, draft: OnboardingDraft, request: Request) -> None:
    """Apply a fully validated draft; the caller commits or rolls back all writes."""
    if normalize_role(user.role) != "patient":
        raise HTTPException(403, detail="O perfil de paciente só pode ser concluído numa conta de paciente.")
    # Keep the wizard aligned with the existing booking consent requirement.
    if not set(REQUIRED_CONSENTS).issubset(CONSENT_FIELDS.values()):
        raise HTTPException(503, detail="Os consentimentos necessitam de atualização.")
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    try:
        payload = json.loads(draft.data_json)
    except (TypeError, ValueError):
        payload = None
    values = _validate(user, payload, profile)

    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
    profile.full_name = values["full_name"]
    if values["phone"] and not profile.phone:
        # Self-reported contact only, never proof of phone ownership.
        profile.phone = values["phone"]
    profile.country = values["country"]
    if "city" in values["steps"][4]:
        profile.city = values["city"]

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if patient is None:
        patient = Patient(user_id=user.id)
        db.add(patient)
    patient.date_of_birth = values["dob"]
    if "sex" in values["steps"][3]:
        patient.gender = values["gender"]
    for source, target, value in (
        ("blood_type", "blood_type", values["blood_type"]),
        ("allergies", "allergies_json", json.dumps(values["allergies"], ensure_ascii=False)),
        ("chronic", "chronic_conditions_json", json.dumps(values["chronic"], ensure_ascii=False)),
    ):
        if source in values["steps"][5]:
            setattr(patient, target, value)
    patient.emergency_contact_name = values["emergency_name"]
    patient.emergency_contact_phone = values["emergency_phone"]
    db.flush()

    accepted_at = datetime.utcnow()
    ip = request.client.host[:45] if request.client else None
    user_agent = (request.headers.get("user-agent") or "")[:500]
    from app.services import consent_runtime
    from app.health_schemas import ConsentRequest
    from app.services.appointments import lock_resources
    from pydantic import ValidationError
    step = values["steps"][7]
    grants = {}
    lock_resources(db, None, patient.id)
    if consent_runtime.revision(db, patient.id) != step["consent_expected_revision"]:
        raise HTTPException(422, {"error": "invalid_patient_onboarding", "fields": {
            "7.consent_expected_revision": "Os consentimentos mudaram. Reveja a decisão atual antes de concluir."}})
    try:
        catalog = consent_runtime.catalog_rows(db, values["country"], step["catalog_language"])
        used = set()
        for offset, reference in enumerate(step["consent_acceptances"]):
            body = ConsentRequest(**reference, action="grant", expected_revision=step["consent_expected_revision"] + offset)
            document = next((row for row in catalog.values() if row.id == body.document_id), None)
            if (not document or document.purpose not in consent_runtime.REQUIRED_PURPOSES or document.purpose in used
                    or body.country != values["country"] or body.language != step["catalog_language"]):
                raise ValueError()
            event = consent_runtime.append_event(db, patient, user.id, body.model_dump(),
                str(uuid5(NAMESPACE_URL, f"kaya-onboarding:{draft.id}:{document.purpose}")))
            grants[document.purpose] = event
            used.add(document.purpose)
        if used != set(consent_runtime.REQUIRED_PURPOSES): raise ValueError()
    except (HTTPException, ValidationError, TypeError, ValueError):
        raise HTTPException(422, {"error": "invalid_patient_onboarding", "fields": {
            "7.consent_acceptances": "Os textos aprovados mudaram ou não estão disponíveis. Reveja cada texto antes de concluir."}}) from None
    choices = {field: purpose in grants for field, purpose in CONSENT_FIELDS.items()}
    choices.update({field: False for field in OPTIONAL_CONSENT_FIELDS})
    db.add(HealthAuditLog(
        actor_user_id=user.id, action="patient_onboarding_completed",
        resource_type="onboarding_draft", resource_id=draft.id,
        ip_address=ip, user_agent=user_agent, created_at=accepted_at,
        metadata_json=json.dumps({
            "patient_id": patient.id,
            "service_country": values["country"],
            # These versioned wizard statements are currently displayed in
            # Portuguese. A communication preference is not translation proof.
            "language": step["catalog_language"],
            "preferred_language": values["language"],
            "consent_version": CONSENT_VERSION,
            "consent_grants": {purpose: grant.id for purpose, grant in grants.items()},
            "consent_choices": choices,
            "emergency_contact_authorized": True,
            "contact_verification": "not_performed",
        }, ensure_ascii=False),
    ))
