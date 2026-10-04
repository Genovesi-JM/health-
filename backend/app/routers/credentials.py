from __future__ import annotations

import hashlib
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import update
from sqlalchemy.orm import Session, joinedload

from app.credential_schemas import CredentialDecision, CredentialUpsert, ProviderStartRequest
from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.health_models import (
    ClinicianCredential, CredentialEvidence, CredentialProviderCheck, Doctor,
)
from app.models import User
from app.rbac import require_compliance_reviewer
from app.services.clinician_access import licence_is_current
from app.services.credential_mutations import CredentialRevision, mutate_credential
from app.services.verification.state_machine import is_allowed, record_transition
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
EDITABLE_APPLICATION_STATES = {"draft", "needs_info", "rejected", "action_required", "failed", "pending_review"}
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
    if data.get("licence_expiry_date"):
        try:
            date.fromisoformat(data["licence_expiry_date"])
        except (TypeError, ValueError):
            raise HTTPException(422, "Indique uma data de validade no formato AAAA-MM-DD.")
    return data


def _application_checks(credential: ClinicianCredential) -> tuple[list[dict], int]:
    kinds = {item.kind for item in credential.evidence}
    checks, _ = run_automated_checks(credential, kinds)
    for check in checks:
        if check["code"] == "licence_not_expired":
            check["passed"] = licence_is_current(credential)
    required = [item for item in checks if item["severity"] == "required"]
    score = round(100 * sum(item["passed"] for item in required) / max(1, len(required)))
    return checks, score


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


def _owned_application(db: Session, user: User) -> ClinicianCredential:
    if user.role not in ("patient", "cliente", "doctor", "nurse"):
        raise HTTPException(403, "Este perfil destina-se a candidatos a médicos e enfermeiros.")
    try:
        credential = _get_credential(db, user.id)
    except HTTPException as exc:
        if exc.status_code == 404 and user.role in ("patient", "cliente"):
            raise HTTPException(403, "Não existe uma candidatura profissional nesta conta.")
        raise
    if credential.profession not in ALLOWED_PROFESSIONS or (
        user.role in ALLOWED_PROFESSIONS and user.role != credential.profession
    ):
        raise HTTPException(403, "A profissão não corresponde à candidatura.")
    return credential


def _require_editable(credential: ClinicianCredential) -> None:
    if credential.status not in EDITABLE_APPLICATION_STATES:
        raise HTTPException(409, "O processo já está fechado para alterações.")


def _require_credential_reader(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "support", "compliance_reviewer"):
        raise HTTPException(403, "Sem acesso à revisão profissional.")
    return user


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
    return _serialize(_owned_application(db, user))


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
    credential = _owned_application(db, user)
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
    return _serialize(_owned_application(db, user))


@router.post("/me/providers/refresh")
def refresh_provider_checks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    credential = _owned_application(db, user)
    for check in credential.provider_checks:
        if check.provider == "azure" and check.status == "processing":
            try:
                refresh_azure(check)
            except Exception as exc:
                check.status = "failed"
                check.error_message = str(exc)[:2000]
                check.completed_at = datetime.utcnow()
    db.commit()
    return _serialize(_owned_application(db, user))


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
    existing = db.query(ClinicianCredential).filter(ClinicianCredential.user_id == user.id).first()
    if not existing and user.role in ALLOWED_PROFESSIONS:
        # Preserve onboarding for controlled legacy accounts without a dossier.
        # Creating an application never changes their role or grants verification.
        data = _normalise_payload(body)
        if data["profession"] != user.role:
            raise HTTPException(403, "A profissão não corresponde ao tipo da conta.")
        db.add(ClinicianCredential(user_id=user.id, **data))
        db.commit()
        return _serialize(_owned_application(db, user))
    credential = _owned_application(db, user)
    _require_editable(credential)
    data = _normalise_payload(body)
    if data["profession"] != credential.profession:
        raise HTTPException(403, "A profissão não corresponde à candidatura.")
    revision = CredentialRevision.capture(credential)
    mutate_credential(db, credential, revision=revision, **data,
                      status="draft", rejection_reason=None)
    db.commit()
    return _serialize(_owned_application(db, user))


@router.post("/me/evidence/{kind}")
async def upload_evidence(
    kind: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if kind not in ALLOWED_EVIDENCE:
        raise HTTPException(422, "Tipo de documento inválido.")
    credential = _owned_application(db, user)
    _require_editable(credential)
    revision = CredentialRevision.capture(credential)
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
    try:
        # Acquire the revision before replacing evidence. Keep its row lock until
        # all evidence and checks are committed; stale uploads clean up the blob.
        mutate_credential(db, credential, revision=revision, status="draft")
        previous = db.query(CredentialEvidence).filter(
            CredentialEvidence.credential_id == credential.id,
            CredentialEvidence.kind == kind,
        ).all()
        previous_keys = [item.storage_key for item in previous]
        evidence = CredentialEvidence(
            credential_id=credential.id, kind=kind,
            original_filename=(file.filename or f"{kind}.bin")[:255],
            storage_key=key, content_type=content_type, size_bytes=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
        )
        for item in previous:
            db.delete(item)
        db.add(evidence)
        db.flush()
        db.expire(credential, ["evidence"])
        checks, score = _application_checks(credential)
        db.execute(update(ClinicianCredential.__table__).where(
            ClinicianCredential.id == credential.id,
        ).values(automated_checks_json=json.dumps(checks, ensure_ascii=False),
                 automated_score=score, updated_at=credential.updated_at))
        db.commit()
    except Exception:
        db.rollback()
        try:
            storage.delete(key)
        except Exception:
            # Preserve the original failure if storage is also unavailable.
            pass
        raise
    for previous_key in previous_keys:
        try:
            storage.delete(previous_key)
        except Exception:
            pass
    return _serialize(_owned_application(db, user))


@router.post("/me/submit")
def submit_my_credential(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    credential = _owned_application(db, user)
    _require_editable(credential)
    revision = CredentialRevision.capture(credential)
    checks, score = _application_checks(credential)
    missing = [item for item in required_evidence(credential) if item not in {e.kind for e in credential.evidence}]
    failed = [item for item in checks if item["severity"] == "required" and not item["passed"]]
    values = {"automated_checks_json": json.dumps(checks, ensure_ascii=False), "automated_score": score}
    if missing or failed:
        mutate_credential(db, credential, revision=revision, status="needs_info", **values)
        db.commit()
        raise HTTPException(422, {
            "message": "O processo precisa de informação adicional.",
            "missing_evidence": missing, "failed_checks": failed,
        })
    mutate_credential(db, credential, revision=revision, status="pending_review",
                      submitted_at=datetime.utcnow(), **values)
    db.commit()
    return _serialize(_owned_application(db, user))


@router.get("/admin")
def list_credentials(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(_require_credential_reader),
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
    user: User = Depends(_require_credential_reader),
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
    reviewer: User = Depends(require_compliance_reviewer),
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
        "reject": "rejected", "suspend": "suspended", "revoke": "revoked",
    }
    if action not in statuses:
        raise HTTPException(422, "Decisão inválida.")
    if credential.user_id == reviewer.id:
        raise HTTPException(403, "Não pode rever a sua própria candidatura.")
    if action in ("reject", "revoke") and not (body.notes or "").strip():
        raise HTTPException(422, "Indique o motivo da decisão.")
    revision = CredentialRevision.capture(credential)
    previous_status = revision.status
    new_status = statuses[action]
    if not is_allowed(previous_status, new_status) or previous_status == "revoked":
        raise HTTPException(409, "O estado da candidatura não permite esta decisão.")
    checks, score = _application_checks(credential)
    if new_status == "verified":
        if previous_status not in ("pending_review", "verified", "completed"):
            raise HTTPException(409, "A candidatura deve ser submetida para revisão antes da aprovação.")
        failed = [item for item in checks if item["severity"] == "required" and not item["passed"]]
        if failed or not licence_is_current(credential):
            raise HTTPException(409, "Não é possível aprovar enquanto faltam verificações obrigatórias.")

    applicant = db.get(User, credential.user_id)
    if not applicant or (new_status == "verified" and (
        not applicant.is_active or applicant.role not in ("patient", "cliente", credential.profession)
    )):
        raise HTTPException(409, "A conta não permite atribuir esta função profissional.")
    doctor = db.query(Doctor).filter(Doctor.user_id == credential.user_id).first()
    if new_status == "verified" and credential.profession == "doctor" and not doctor:
        raise HTTPException(409, "Perfil de médico não encontrado para esta candidatura.")

    # Status and revision compare-and-set prevents a stale review from approving
    # evidence that was replaced or a case withdrawn by another reviewer.
    now = datetime.utcnow()
    values = {
        "status": new_status, "updated_at": now, "review_notes": body.notes,
        "rejection_reason": body.notes if action == "reject" else None,
        "automated_checks_json": json.dumps(checks, ensure_ascii=False),
        "automated_score": score,
    }
    if new_status == "verified":
        values.update(verified_at=now, verified_by=reviewer.id)
    mutate_credential(db, credential, revision=revision, **values)
    if new_status == "verified":
        # Only this human review path grants the persisted professional role.
        # Existing applicant tokens subsequently fail the mandatory MFA gate.
        applicant.role = credential.profession
    if doctor:
        doctor.verification_status = credential.status
        doctor.verified_at = credential.verified_at
        doctor.verified_by = credential.verified_by

    # Audit failure aborts the role grant and verification together.
    record_transition(
        db, entity_type="clinician_credential", entity_id=credential.id,
        previous_status=previous_status, new_status=new_status,
        actor_user_id=reviewer.id, actor_kind="user", reason_code=f"reviewer_{action}",
        reason_text=body.notes,
    )

    # Notify the professional of the decision (§18) — applicant-visible copy only.
    try:
        from app.health_models import Notification
        _decision_templates = {
            "verified": ("Candidatura aprovada",
                         "A sua candidatura foi aprovada. Inicie sessão e conclua a autenticação de dois fatores para aceder às funções clínicas.", "success"),
            "rejected": ("Candidatura rejeitada", "A sua candidatura não foi aprovada.", "error"),
            "needs_info": ("Informação adicional necessária",
                           "A equipa de conformidade precisa de mais informação.", "warning"),
            "suspended": ("Conta suspensa", "A sua conta profissional foi suspensa.", "error"),
        }
        _tpl = _decision_templates.get(credential.status)
        if _tpl:
            _title, _msg, _type = _tpl
            if body.notes:
                _msg = f"{_msg} {body.notes}"
            db.add(Notification(
                user_id=credential.user_id, title=_title, message=_msg, type=_type,
                related_entity_type="clinician_credential", related_entity_id=credential.id,
            ))
    except Exception:
        pass

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
    if not credential or (credential.user_id != user.id and user.role not in ("admin", "support", "compliance_reviewer")):
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
