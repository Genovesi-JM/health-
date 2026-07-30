from __future__ import annotations

import hashlib
import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.credential_schemas import CredentialDecision, CredentialUpsert, ProviderStartRequest
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.health_models import (
    ClinicianCredential, CredentialEvidence, CredentialProviderCheck, Doctor,
)
from app.models import User
from app.rbac import require_admin_or_support
from app.services.credential_verification import (
    COUNTRIES,
    normalise_country,
    registry_for,
    required_evidence,
    run_automated_checks,
)
from app.services.health_storage import get_health_storage
from app.services.credential_providers import (
    ACTIVE_STATUSES,
    dataflow_event_update,
    persona_event_update,
    refresh_azure,
    safe_json,
    serialize_check,
    start_azure,
    start_dataflow,
    start_persona,
    verify_simple_hmac,
    verify_timestamped_hmac,
)

router = APIRouter(prefix="/api/v1/credentials", tags=["clinician-credentials"])

ALLOWED_PROFESSIONS = {"doctor", "nurse"}
ALLOWED_EVIDENCE = {
    "professional_card", "diploma", "recognition", "local_registration", "good_standing",
    "eu_professional_card", "language_certificate", "professional_liability", "other",
}
ALLOWED_PROVIDERS = {"azure", "persona", "dataflow"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MIME_SIGNATURES = {
    "application/pdf": (b"%PDF-",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}


def _normalise_payload(body: CredentialUpsert) -> dict:
    data = body.model_dump()
    profession = (data["profession"] or "").strip().lower()
    if profession not in ALLOWED_PROFESSIONS:
        raise HTTPException(422, "Profissão deve ser doctor ou nurse.")
    data["profession"] = profession
    try:
        for field in ("practice_country", "licence_country", "diploma_country"):
            data[field] = normalise_country(data[field])
        if data.get("nationality_country"):
            data["nationality_country"] = normalise_country(data["nationality_country"])
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    if data["registry_profile_url"] and not data["registry_profile_url"].startswith("https://"):
        raise HTTPException(422, "A ligação do registo deve usar HTTPS.")
    if data["licence_country"] == "US" and not (data.get("licence_jurisdiction") or "").strip():
        raise HTTPException(422, "Indique o estado ou jurisdição da licença dos EUA.")
    return data


def _refresh_checks(credential: ClinicianCredential) -> None:
    kinds = {item.kind for item in credential.evidence}
    checks, score = run_automated_checks(credential, kinds)
    credential.automated_checks_json = json.dumps(checks, ensure_ascii=False)
    credential.automated_score = score


def _serialize(credential: ClinicianCredential) -> dict:
    try:
        checks = json.loads(credential.automated_checks_json or "[]")
    except Exception:
        checks = []
    present = {item.kind for item in credential.evidence}
    return {
        "id": credential.id,
        "user_id": credential.user_id,
        "profession": credential.profession,
        "legal_name": credential.legal_name,
        "nationality_country": credential.nationality_country,
        "practice_country": credential.practice_country,
        "licence_country": credential.licence_country,
        "licence_jurisdiction": credential.licence_jurisdiction,
        "issuing_authority": credential.issuing_authority,
        "licence_number": credential.licence_number,
        "licence_expiry_date": credential.licence_expiry_date,
        "diploma_country": credential.diploma_country,
        "diploma_institution": credential.diploma_institution,
        "degree_title": credential.degree_title,
        "graduation_year": credential.graduation_year,
        "specialization": credential.specialization,
        "registry_profile_url": credential.registry_profile_url,
        "status": credential.status,
        "automated_score": credential.automated_score,
        "automated_checks": checks,
        "review_notes": credential.review_notes,
        "rejection_reason": credential.rejection_reason,
        "submitted_at": credential.submitted_at,
        "verified_at": credential.verified_at,
        "verification_consent_at": credential.verification_consent_at,
        "evidence": [{
            "id": item.id, "kind": item.kind, "original_filename": item.original_filename,
            "content_type": item.content_type, "size_bytes": item.size_bytes,
            "sha256": item.sha256, "created_at": item.created_at,
        } for item in credential.evidence],
        "registry": registry_for(credential.licence_country, credential.profession),
        "missing_evidence": [kind for kind in required_evidence(credential) if kind not in present],
        "provider_checks": [
            serialize_check(item)
            for item in sorted(credential.provider_checks, key=lambda value: value.created_at, reverse=True)
        ],
    }


def _get_credential(db: Session, user_id: str) -> ClinicianCredential:
    credential = (
        db.query(ClinicianCredential)
        .options(
            joinedload(ClinicianCredential.evidence),
            joinedload(ClinicianCredential.provider_checks),
        )
        .filter(ClinicianCredential.user_id == user_id)
        .first()
    )
    if not credential:
        raise HTTPException(404, "Perfil de verificação profissional não encontrado.")
    return credential


@router.get("/requirements")
def requirements(
    profession: str = Query(...),
    practice_country: str = Query("AO"),
    diploma_country: str = Query("AO"),
    licence_country: str = Query("AO"),
    licence_jurisdiction: str | None = Query(None),
):
    profession = profession.lower()
    if profession not in ALLOWED_PROFESSIONS:
        raise HTTPException(422, "Profissão inválida.")
    try:
        practice_country = normalise_country(practice_country)
        diploma_country = normalise_country(diploma_country)
        licence_country = normalise_country(licence_country)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    proxy = type("Credential", (), {
        "practice_country": practice_country,
        "diploma_country": diploma_country,
        "licence_country": licence_country,
        "licence_jurisdiction": licence_jurisdiction,
    })()
    return {
        "countries": [{"code": code, "name": name} for code, name in COUNTRIES.items()],
        "required_evidence": required_evidence(proxy),
        "registry": registry_for(licence_country, profession),
        "human_review_required": True,
        "automatic_approval": False,
        "eu_coordinated_recognition": practice_country in {
            "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
            "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
            "RO", "SK", "SI", "ES", "SE",
        },
    }


@router.get("/me")
def get_my_credential(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ALLOWED_PROFESSIONS:
        raise HTTPException(403, "Este perfil destina-se a médicos e enfermeiros.")
    return _serialize(_get_credential(db, user.id))


def _existing_provider_check(
    db: Session, credential_id: str, provider: str, evidence_id: str | None = None,
) -> CredentialProviderCheck | None:
    query = db.query(CredentialProviderCheck).filter(
        CredentialProviderCheck.credential_id == credential_id,
        CredentialProviderCheck.provider == provider,
        CredentialProviderCheck.status.in_(ACTIVE_STATUSES | {"completed"}),
    )
    query = query.filter(
        CredentialProviderCheck.evidence_id == evidence_id
        if evidence_id else CredentialProviderCheck.evidence_id.is_(None)
    )
    return query.order_by(CredentialProviderCheck.created_at.desc()).first()


@router.post("/me/providers/start")
def start_provider_checks(
    body: ProviderStartRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.consent:
        raise HTTPException(422, "É necessário consentimento explícito para enviar dados aos verificadores.")
    providers = list(dict.fromkeys(provider.lower() for provider in body.providers))
    invalid = set(providers) - ALLOWED_PROVIDERS
    if invalid:
        raise HTTPException(422, f"Fornecedor inválido: {', '.join(sorted(invalid))}.")
    credential = _get_credential(db, user.id)
    if not credential.evidence:
        raise HTTPException(422, "Envie os documentos antes de iniciar a verificação.")
    credential.verification_consent_at = datetime.utcnow()

    for provider in providers:
        targets = credential.evidence if provider == "azure" else [None]
        for evidence in targets:
            evidence_id = evidence.id if evidence else None
            if _existing_provider_check(db, credential.id, provider, evidence_id):
                continue
            check = CredentialProviderCheck(
                credential_id=credential.id,
                evidence_id=evidence_id,
                provider=provider,
                check_type={
                    "azure": "document_extraction",
                    "persona": "identity_document_fraud",
                    "dataflow": "primary_source_verification",
                }[provider],
            )
            db.add(check)
            db.flush()
            try:
                if provider == "azure":
                    start_azure(check, evidence)
                elif provider == "persona":
                    start_persona(check, credential)
                else:
                    start_dataflow(check, credential, credential.evidence)
            except Exception as exc:
                check.status = "failed"
                check.error_message = str(exc)[:2000]
                check.completed_at = datetime.utcnow()
    db.commit()
    return _serialize(_get_credential(db, user.id))


@router.post("/me/providers/refresh")
def refresh_provider_checks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    credential = _get_credential(db, user.id)
    for check in credential.provider_checks:
        if check.provider == "azure" and check.status == "processing":
            try:
                refresh_azure(check)
            except Exception as exc:
                check.status = "failed"
                check.error_message = str(exc)[:2000]
                check.completed_at = datetime.utcnow()
    db.commit()
    return _serialize(_get_credential(db, user.id))


@router.post("/webhooks/persona")
async def persona_webhook(
    request: Request,
    persona_signature: str = Header(default="", alias="Persona-Signature"),
    db: Session = Depends(get_db),
):
    raw = await request.body()
    if not verify_timestamped_hmac(raw, persona_signature, settings.persona_webhook_secret):
        raise HTTPException(401, "Assinatura Persona inválida.")
    payload = json.loads(raw)
    external_id, status, result = persona_event_update(payload)
    if external_id:
        check = db.query(CredentialProviderCheck).filter(
            CredentialProviderCheck.provider == "persona",
            CredentialProviderCheck.external_id == external_id,
        ).first()
        if check:
            previous = safe_json(check.result_json)
            if previous.get("event_id") != result.get("event_id"):
                check.status = status
                check.result_json = json.dumps(result)
                if status in {"completed", "failed"}:
                    check.completed_at = datetime.utcnow()
                db.commit()
    return {"received": True}


@router.post("/webhooks/dataflow")
async def dataflow_webhook(
    request: Request,
    signature: str = Header(default="", alias="X-DataFlow-Signature"),
    db: Session = Depends(get_db),
):
    raw = await request.body()
    if not verify_simple_hmac(raw, signature, settings.dataflow_webhook_secret):
        raise HTTPException(401, "Assinatura do parceiro inválida.")
    payload = json.loads(raw)
    external_id, status, result = dataflow_event_update(payload)
    query = db.query(CredentialProviderCheck).filter(CredentialProviderCheck.provider == "dataflow")
    if external_id:
        query = query.filter(CredentialProviderCheck.external_id == external_id)
    elif payload.get("reference_id"):
        query = query.filter(CredentialProviderCheck.credential_id == payload["reference_id"])
    else:
        return {"received": True}
    check = query.first()
    if check:
        check.status = status
        check.result_json = json.dumps(result)
        if status in {"completed", "failed"}:
            check.completed_at = datetime.utcnow()
        db.commit()
    return {"received": True}


@router.put("/me")
def upsert_my_credential(
    body: CredentialUpsert,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role not in ALLOWED_PROFESSIONS:
        raise HTTPException(403, "Este perfil destina-se a médicos e enfermeiros.")
    data = _normalise_payload(body)
    if data["profession"] != user.role:
        raise HTTPException(403, "A profissão não corresponde ao tipo da conta.")

    credential = db.query(ClinicianCredential).filter(ClinicianCredential.user_id == user.id).first()
    if credential and credential.status in ("verified", "suspended"):
        raise HTTPException(409, "Credenciais verificadas ou suspensas só podem ser alteradas pela equipa KAYA.")
    if not credential:
        credential = ClinicianCredential(user_id=user.id, **data)
        db.add(credential)
        db.flush()
    else:
        for key, value in data.items():
            setattr(credential, key, value)
        credential.status = "draft"
        credential.rejection_reason = None
    db.commit()
    return _serialize(_get_credential(db, user.id))


@router.post("/me/evidence/{kind}")
async def upload_evidence(
    kind: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if kind not in ALLOWED_EVIDENCE:
        raise HTTPException(422, "Tipo de documento inválido.")
    credential = _get_credential(db, user.id)
    if credential.status in ("verified", "suspended"):
        raise HTTPException(409, "O processo já está fechado para alterações.")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Documento vazio ou superior a 10 MB.")
    content_type = (file.content_type or "").lower()
    signatures = MIME_SIGNATURES.get(content_type)
    if not signatures or not any(data.startswith(signature) for signature in signatures):
        raise HTTPException(415, "Apenas PDF, JPEG ou PNG válidos são aceites.")

    storage = get_health_storage()
    key, _ = storage.upload_bytes(
        data, f"credentials/{credential.id}", file.filename or f"{kind}.bin", content_type,
    )
    previous = (
        db.query(CredentialEvidence)
        .filter(CredentialEvidence.credential_id == credential.id, CredentialEvidence.kind == kind)
        .all()
    )
    evidence = CredentialEvidence(
        credential_id=credential.id, kind=kind,
        original_filename=(file.filename or f"{kind}.bin")[:255],
        storage_key=key, content_type=content_type, size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
    )
    for item in previous:
        db.delete(item)
    db.add(evidence)
    credential.status = "draft"
    db.commit()
    for item in previous:
        try:
            storage.delete(item.storage_key)
        except Exception:
            pass
    credential = _get_credential(db, user.id)
    _refresh_checks(credential)
    db.commit()
    return _serialize(_get_credential(db, user.id))


@router.post("/me/submit")
def submit_my_credential(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    credential = _get_credential(db, user.id)
    _refresh_checks(credential)
    missing = [item for item in required_evidence(credential) if item not in {e.kind for e in credential.evidence}]
    failed = [
        item for item in json.loads(credential.automated_checks_json or "[]")
        if item["severity"] == "required" and not item["passed"]
    ]
    if missing or failed:
        credential.status = "needs_info"
        db.commit()
        raise HTTPException(422, {
            "message": "O processo precisa de informação adicional.",
            "missing_evidence": missing,
            "failed_checks": failed,
        })
    credential.status = "pending_review"
    credential.submitted_at = datetime.utcnow()
    db.commit()
    return _serialize(_get_credential(db, user.id))


@router.get("/admin")
def list_credentials(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(require_admin_or_support),
    db: Session = Depends(get_db),
):
    query = db.query(ClinicianCredential).options(
        joinedload(ClinicianCredential.evidence),
        joinedload(ClinicianCredential.provider_checks),
    )
    if status_filter:
        query = query.filter(ClinicianCredential.status == status_filter)
    return [_serialize(item) for item in query.order_by(ClinicianCredential.updated_at.desc()).all()]


@router.get("/admin/{credential_id}")
def get_admin_credential(
    credential_id: str,
    user: User = Depends(require_admin_or_support),
    db: Session = Depends(get_db),
):
    credential = (
        db.query(ClinicianCredential).options(
            joinedload(ClinicianCredential.evidence),
            joinedload(ClinicianCredential.provider_checks),
        )
        .filter(ClinicianCredential.id == credential_id).first()
    )
    if not credential:
        raise HTTPException(404, "Processo não encontrado.")
    return _serialize(credential)


@router.post("/admin/{credential_id}/decision")
def decide_credential(
    credential_id: str,
    body: CredentialDecision,
    reviewer: User = Depends(require_admin_or_support),
    db: Session = Depends(get_db),
):
    credential = (
        db.query(ClinicianCredential).options(
            joinedload(ClinicianCredential.evidence),
            joinedload(ClinicianCredential.provider_checks),
        )
        .filter(ClinicianCredential.id == credential_id).first()
    )
    if not credential:
        raise HTTPException(404, "Processo não encontrado.")
    action = body.action.lower()
    statuses = {
        "approve": "verified", "verify": "verified", "needs_info": "needs_info",
        "reject": "rejected", "suspend": "suspended",
    }
    if action not in statuses:
        raise HTTPException(422, "Decisão inválida.")
    if action == "reject" and not (body.notes or "").strip():
        raise HTTPException(422, "Indique o motivo da rejeição.")
    if action in ("approve", "verify"):
        _refresh_checks(credential)
        failed = [
            item for item in json.loads(credential.automated_checks_json or "[]")
            if item["severity"] == "required" and not item["passed"]
        ]
        if failed:
            raise HTTPException(409, "Não é possível aprovar enquanto faltam verificações obrigatórias.")

    credential.status = statuses[action]
    credential.review_notes = body.notes
    credential.rejection_reason = body.notes if action == "reject" else None
    if credential.status == "verified":
        credential.verified_at = datetime.utcnow()
        credential.verified_by = reviewer.id

    doctor = db.query(Doctor).filter(Doctor.user_id == credential.user_id).first()
    if doctor:
        doctor.verification_status = credential.status
        doctor.verified_at = credential.verified_at
        doctor.verified_by = credential.verified_by
    db.commit()
    return _serialize(_get_credential(db, credential.user_id))


@router.get("/evidence/{evidence_id}/download")
def download_evidence(
    evidence_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    evidence = db.query(CredentialEvidence).filter(CredentialEvidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(404, "Documento não encontrado.")
    credential = db.get(ClinicianCredential, evidence.credential_id)
    if not credential or (credential.user_id != user.id and user.role not in ("admin", "support")):
        raise HTTPException(403, "Sem acesso a este documento.")
    data = get_health_storage().download_bytes(evidence.storage_key)
    safe_name = "".join(
        char for char in evidence.original_filename
        if char.isalnum() or char in "._- "
    ).strip() or "credential"
    return Response(
        content=data,
        media_type=evidence.content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"', "Cache-Control": "no-store"},
    )
