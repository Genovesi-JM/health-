from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings
from app.health_models import ClinicianCredential, CredentialEvidence, CredentialProviderCheck
from app.services.health_storage import get_health_storage


TERMINAL_STATUSES = {"completed", "failed"}
ACTIVE_STATUSES = {"queued", "submitted", "processing", "action_required", "not_configured"}


def _configured(*values: str | None) -> bool:
    return all(bool(value and not value.upper().startswith(("FAKE", "CHANGE_ME", "YOUR_"))) for value in values)


def safe_json(value: str | None) -> dict:
    try:
        parsed = json.loads(value or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError):
        return {}


def serialize_check(check: CredentialProviderCheck) -> dict:
    return {
        "id": check.id,
        "provider": check.provider,
        "check_type": check.check_type,
        "status": check.status,
        "evidence_id": check.evidence_id,
        "external_id": check.external_id,
        "launch_url": check.launch_url,
        "extracted_data": safe_json(check.extracted_data_json),
        "result": safe_json(check.result_json),
        "error_message": check.error_message,
        "requested_at": check.requested_at,
        "completed_at": check.completed_at,
        "updated_at": check.updated_at,
    }


def extract_azure_fields(payload: dict) -> dict:
    """Return compact values and confidence scores from Azure's document result."""
    documents = payload.get("analyzeResult", {}).get("documents", [])
    fields = documents[0].get("fields", {}) if documents else {}
    extracted: dict[str, dict] = {}
    for name, field in fields.items():
        if not isinstance(field, dict):
            continue
        value = field.get("valueString")
        if value is None:
            value = field.get("valueDate", field.get("valueNumber", field.get("content")))
        if value is not None:
            extracted[name] = {
                "value": value,
                "confidence": round(float(field.get("confidence", 0)), 3),
            }
    return extracted


def start_azure(check: CredentialProviderCheck, evidence: CredentialEvidence) -> None:
    if not _configured(settings.azure_document_intelligence_endpoint, settings.azure_document_intelligence_key):
        check.status = "not_configured"
        check.result_json = json.dumps({
            "mode": "configuration_required",
            "message": "Configure Azure Document Intelligence to extract document fields.",
        })
        return
    data = get_health_storage().download_bytes(evidence.storage_key)
    endpoint = settings.azure_document_intelligence_endpoint.rstrip("/")
    model = quote(settings.azure_document_model_id, safe="")
    url = (
        f"{endpoint}/documentintelligence/documentModels/{model}:analyze"
        f"?api-version={settings.azure_document_api_version}"
    )
    response = httpx.post(
        url,
        headers={
            "Ocp-Apim-Subscription-Key": settings.azure_document_intelligence_key,
            "Content-Type": "application/octet-stream",
        },
        content=data,
        timeout=settings.credential_provider_timeout_seconds,
    )
    response.raise_for_status()
    operation_url = response.headers.get("operation-location")
    if not operation_url:
        raise RuntimeError("Azure did not return an operation-location header.")
    check.operation_url = operation_url
    check.external_id = operation_url.rsplit("/", 1)[-1].split("?", 1)[0]
    check.status = "processing"


def refresh_azure(check: CredentialProviderCheck) -> None:
    if check.status == "not_configured" or not check.operation_url:
        return
    response = httpx.get(
        check.operation_url,
        headers={"Ocp-Apim-Subscription-Key": settings.azure_document_intelligence_key or ""},
        timeout=settings.credential_provider_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    azure_status = str(payload.get("status", "")).lower()
    if azure_status == "succeeded":
        check.status = "completed"
        check.extracted_data_json = json.dumps(extract_azure_fields(payload), ensure_ascii=False)
        check.result_json = json.dumps({
            "provider_status": azure_status,
            "model_id": settings.azure_document_model_id,
        })
        check.completed_at = datetime.utcnow()
    elif azure_status in {"failed", "canceled"}:
        check.status = "failed"
        check.error_message = json.dumps(payload.get("error", {}), ensure_ascii=False)[:2000]
        check.completed_at = datetime.utcnow()
    else:
        check.status = "processing"


def start_persona(check: CredentialProviderCheck, credential: ClinicianCredential) -> None:
    if not _configured(settings.persona_api_key, settings.persona_inquiry_template_id):
        check.status = "not_configured"
        check.result_json = json.dumps({
            "mode": "configuration_required",
            "message": "Configure a Persona inquiry template and API key.",
        })
        return
    response = httpx.post(
        "https://api.withpersona.com/api/v1/inquiries",
        headers={
            "Authorization": f"Bearer {settings.persona_api_key}",
            "Content-Type": "application/json",
            "Persona-Version": "2023-01-05",
        },
        json={"data": {"attributes": {
            "inquiry-template-id": settings.persona_inquiry_template_id,
            "reference-id": credential.id,
        }}},
        timeout=settings.credential_provider_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    check.external_id = payload.get("data", {}).get("id")
    meta = payload.get("meta", {})
    check.launch_url = meta.get("one-time-link")
    check.status = "action_required"
    check.result_json = json.dumps({"provider_status": "created"})


def _dataflow_payload(credential: ClinicianCredential, evidence: list[CredentialEvidence]) -> dict:
    storage = get_health_storage()
    return {
        "reference_id": credential.id,
        "applicant": {
            "legal_name": credential.legal_name,
            "profession": credential.profession,
            "nationality_country": credential.nationality_country,
        },
        "licence": {
            "country": credential.licence_country,
            "jurisdiction": credential.licence_jurisdiction,
            "authority": credential.issuing_authority,
            "number": credential.licence_number,
        },
        "education": {
            "country": credential.diploma_country,
            "institution": credential.diploma_institution,
            "degree": credential.degree_title,
            "graduation_year": credential.graduation_year,
        },
        "practice_country": credential.practice_country,
        "evidence": [{
            "id": item.id,
            "kind": item.kind,
            "filename": item.original_filename,
            "content_type": item.content_type,
            "sha256": item.sha256,
            "content_base64": base64.b64encode(storage.download_bytes(item.storage_key)).decode(),
        } for item in evidence],
    }


def start_dataflow(
    check: CredentialProviderCheck,
    credential: ClinicianCredential,
    evidence: list[CredentialEvidence],
) -> None:
    # DataFlow's enterprise contract is assigned during partner onboarding.
    # This URL-driven adapter avoids pretending that a public API contract exists.
    if not _configured(settings.dataflow_submit_url, settings.dataflow_api_key):
        check.status = "not_configured"
        check.result_json = json.dumps({
            "mode": "enterprise_onboarding_required",
            "message": "Primary-source verification is ready for the contracted DataFlow endpoint.",
        })
        return
    response = httpx.post(
        settings.dataflow_submit_url,
        headers={
            "Authorization": f"Bearer {settings.dataflow_api_key}",
            "Content-Type": "application/json",
            "Idempotency-Key": credential.id,
        },
        json=_dataflow_payload(credential, evidence),
        timeout=settings.credential_provider_timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    check.external_id = str(payload.get("case_id") or payload.get("id") or credential.id)
    check.status = "submitted"
    check.result_json = json.dumps({"provider_status": payload.get("status", "submitted")})


def verify_timestamped_hmac(raw: bytes, signature: str, secret: str | None) -> bool:
    """Verify Persona's `t=...,v1=...` signature against the untouched body."""
    if not secret:
        return False
    parts = dict(
        part.split("=", 1) for part in signature.split(",")
        if "=" in part
    )
    timestamp, supplied = parts.get("t"), parts.get("v1")
    if not timestamp or not supplied:
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, supplied)


def verify_simple_hmac(raw: bytes, signature: str, secret: str | None) -> bool:
    if not secret or not signature:
        return False
    supplied = signature.removeprefix("sha256=")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, supplied)


def persona_event_update(payload: dict) -> tuple[str | None, str, dict]:
    data = payload.get("data", {})
    attributes = data.get("attributes", {})
    inquiry = attributes.get("payload", {}).get("data", {})
    inquiry_id = inquiry.get("id") or attributes.get("inquiry-id")
    event_name = str(attributes.get("name") or "")
    status = {
        "inquiry.completed": "completed",
        "inquiry.approved": "completed",
        "inquiry.failed": "failed",
        "inquiry.declined": "failed",
        "inquiry.expired": "failed",
    }.get(event_name, "processing")
    return inquiry_id, status, {"event": event_name, "event_id": data.get("id")}


def dataflow_event_update(payload: dict) -> tuple[str | None, str, dict]:
    external_id = payload.get("case_id") or payload.get("id")
    raw_status = str(payload.get("status", "")).lower()
    status = {
        "completed": "completed", "verified": "completed", "clear": "completed",
        "failed": "failed", "unable_to_verify": "failed", "rejected": "failed",
        "in_progress": "processing", "processing": "processing",
    }.get(raw_status, "processing")
    return str(external_id) if external_id else None, status, {
        "provider_status": raw_status,
        "reference_id": payload.get("reference_id"),
    }
