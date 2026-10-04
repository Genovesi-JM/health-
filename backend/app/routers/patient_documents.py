"""Private patient originals and explicitly reviewed, non-diagnostic text."""
from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import PurePath
from typing import Literal
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Path, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, StrictInt
from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, load_only

from app.database import get_db
from app.deps import get_current_user
from app.health_models import Doctor, HealthAuditLog, Patient, PatientConsent, PatientDocument
from app.models import User
from app.identity import normalize_role
from app.rbac import assert_doctor_can_access_patient
from app.services.clinician_access import require_current_clinician
from app.services.cursors import MAX_CURSOR_LENGTH, decode_position, encode_position, utc_timestamp
from app.services.health_storage import get_health_storage
from app.services.patient_document_extraction import extract_document
from app.services.patient_documents import (
    ACCEPTED_TYPES, MAX_BYTES, MAX_TEXT, doctor_has_document_relationship,
    processing_configured, scan_document, validate_upload,
)

def _private_response(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"


router = APIRouter(dependencies=[Depends(_private_response)], prefix="/api/v1/patient-documents", tags=["patient-documents"])
METADATA_FIELDS = (
    "country", "consent_language",
    "id", "original_filename", "content_type", "size_bytes", "status", "scan_status",
    "version", "extraction_method", "created_at", "reviewed_at", "error_code",
)


def serialize_document(document: PatientDocument) -> dict:
    return {name: getattr(document, name) for name in (
        "country", "consent_language",
        "id", "original_filename", "content_type", "size_bytes", "status", "scan_status",
        "version", "extraction_method", "extracted_text", "reviewed_text", "created_at",
        "reviewed_at", "error_code",
    )}


def serialize_metadata(document: PatientDocument) -> dict:
    result = {name: getattr(document, name) for name in METADATA_FIELDS}
    for name in ("created_at", "reviewed_at"):
        result[name] = utc_timestamp(result[name])
    return result


def _patient(user: User, db: Session) -> Patient:
    if normalize_role(user.role) != "patient":
        raise HTTPException(403, "Acesso restrito ao paciente.")
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(403, "Complete o perfil de paciente antes de enviar documentos.")
    return patient


def _consent(patient_id: str, db: Session, country: str | None, language: str | None) -> None:
    from app.services.consent_runtime import require_effective
    from app.services.appointments import lock_resources
    lock_resources(db, None, patient_id)
    require_effective(db, patient_id, country, language, purposes=('health_data_processing',))


def _configured() -> None:
    if not processing_configured():
        raise HTTPException(503, "O envio e processamento de documentos ainda não estão disponíveis.")


def _get(document_id: str, user: User, db: Session, *, owner: bool = False) -> PatientDocument:
    document = db.get(PatientDocument, document_id)
    if not document:
        raise HTTPException(404, "Documento não encontrado.")
    if normalize_role(user.role) == "patient":
        patient = _patient(user, db)
        if document.patient_id != patient.id:
            raise HTTPException(404, "Documento não encontrado.")
        return document
    if owner or user.role != "doctor":
        raise HTTPException(403, "Sem acesso a este documento.")
    _doctor_patient(document.patient_id, user, db)
    if document.scan_status != "clean":
        raise HTTPException(409, "O documento ainda não passou a verificação de segurança.")
    return document


def _doctor_patient(patient_id: str, user: User, db: Session) -> None:
    if user.role != "doctor":
        raise HTTPException(403, "Sem acesso aos documentos deste paciente.")
    require_current_clinician(user, db)
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(403, "Sem acesso a este documento.")
    assert_doctor_can_access_patient(doctor, patient_id, db)
    if not doctor_has_document_relationship(doctor.id, patient_id, db):
        raise HTTPException(403, "O acesso ao documento requer uma relação clínica aceite.")


def _document_page(user: User, patient_id: str, db: Session, *, limit: int, cursor: str | None,
                   clean_only: bool = False, metadata_only: bool = True) -> dict:
    scope = "patient_documents:clean" if clean_only else "patient_documents:owner"
    query = db.query(PatientDocument).filter(PatientDocument.patient_id == patient_id)
    if clean_only:
        query = query.filter(PatientDocument.scan_status == "clean")
    if cursor is not None:
        stamp, identifier = decode_position(cursor, scope=scope, viewer_id=user.id, owner_id=patient_id)
        query = query.filter(or_(PatientDocument.created_at < stamp,
                                 and_(PatientDocument.created_at == stamp, PatientDocument.id < identifier)))
    if metadata_only:
        query = query.options(load_only(*(getattr(PatientDocument, field) for field in METADATA_FIELDS)))
    rows = query.order_by(PatientDocument.created_at.desc(), PatientDocument.id.desc()).limit(limit + 1).all()
    items = rows[:limit]
    next_cursor = encode_position(scope=scope, viewer_id=user.id, owner_id=patient_id,
                                  created_at=items[-1].created_at, identifier=items[-1].id) if len(rows) > limit else None
    serializer = serialize_metadata if metadata_only else serialize_document
    # Serialize before committing the read audit, so expiration cannot reload
    # the large text columns excluded from a metadata-only query.
    result = {"items": [serializer(item) for item in items], "next_cursor": next_cursor}
    _audit_list(db, user, patient_id)
    _commit(db)
    return result


def _audit(db: Session, user: User, document: PatientDocument, action: str) -> None:
    metadata = {
        "version": document.version, "status": document.status,
        "scan_status": document.scan_status,
    }
    if action == "patient_document_uploaded":
        metadata.update(processing_consent=True, consent_version="patient-document-v1")
    db.add(HealthAuditLog(
        actor_user_id=user.id, action=action,
        resource_type="patient_document", resource_id=document.id,
        metadata_json=json.dumps(metadata),
    ))


def _audit_list(db: Session, user: User, patient_id: str) -> None:
    db.add(HealthAuditLog(actor_user_id=user.id, action="patient_documents_listed",
                          resource_type="patient", resource_id=patient_id))


def _mutate(db: Session, document: PatientDocument, version: int, **values) -> None:
    table = PatientDocument.__table__
    with db.no_autoflush:
        changed = db.execute(update(table).where(
            table.c.id == document.id,
            table.c.version == version,
        ).values(version=version + 1, **values))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "O documento mudou. Atualize-o antes de continuar.")
        db.refresh(document)


def _verify_version(document: PatientDocument, version: int) -> None:
    if document.version != version:
        raise HTTPException(409, "O documento mudou. Atualize-o antes de continuar.")


def _commit(db: Session) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(503, "Não foi possível guardar o documento. Tente novamente.") from None


@router.get("/capabilities")
def capabilities(user: User = Depends(get_current_user)):
    enabled = processing_configured() and normalize_role(user.role) == "patient"
    return {
        "upload_enabled": enabled, "max_bytes": MAX_BYTES,
        "request_lookup_enabled": normalize_role(user.role) == "patient",
        "accepted_types": list(ACCEPTED_TYPES), "extraction": "pdf_text",
        "message": None if enabled else "O envio e processamento de documentos ainda não estão disponíveis.",
    }


@router.get("")
@router.get("/", include_in_schema=False)
def list_documents(response: Response, limit: int = Query(100, ge=1, le=100),
                   cursor: str | None = Query(None, max_length=MAX_CURSOR_LENGTH),
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = _patient(user, db)
    page = _document_page(user, patient.id, db, limit=limit, cursor=cursor, metadata_only=False)
    response.headers["X-Has-More"] = "true" if page["next_cursor"] else "false"
    if page["next_cursor"]:
        response.headers["Link"] = f'<{router.prefix}?limit={limit}&cursor={page["next_cursor"]}>; rel="next"'
    return page["items"]


@router.get("/page")
def document_page(limit: int = Query(20, ge=1, le=100),
                  cursor: str | None = Query(None, max_length=MAX_CURSOR_LENGTH),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = _patient(user, db)
    return _document_page(user, patient.id, db, limit=limit, cursor=cursor)


@router.get("/patients/{patient_id}/page")
def patient_document_page(patient_id: str, limit: int = Query(20, ge=1, le=100),
                          cursor: str | None = Query(None, max_length=MAX_CURSOR_LENGTH),
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _doctor_patient(patient_id, user, db)
    return _document_page(user, patient_id, db, limit=limit, cursor=cursor, clean_only=True)


@router.get("/requests/{idempotency_key}")
def recover_document_request(idempotency_key: str = Path(..., max_length=64),
                             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Find an owner's committed upload without requiring the original file.

    Absence is only a snapshot: a concurrent upload can still commit later.
    """
    patient = _patient(user, db)
    try:
        key = str(UUID(idempotency_key))
    except ValueError:
        raise HTTPException(422, "A identificação do envio é inválida.", headers={"Cache-Control": "private, no-store"}) from None
    document = db.query(PatientDocument).filter_by(patient_id=patient.id, idempotency_key=key).first()
    if not document:
        db.add(HealthAuditLog(actor_user_id=user.id, action="patient_document_request_lookup",
            resource_type="patient", resource_id=patient.id, metadata_json=json.dumps({"found": False})))
        _commit(db)
        raise HTTPException(404, {"code": "document_request_not_found", "request_in_flight_may_commit": True,
            "message": "O envio ainda não foi encontrado. Um pedido em curso pode ser confirmado mais tarde."},
            headers={"Cache-Control": "private, no-store"})
    result = serialize_document(document)
    _audit(db, user, document, "patient_document_request_recovered")
    _commit(db)
    return result


@router.post("", status_code=201)
@router.post("/", status_code=201, include_in_schema=False)
async def upload_document(
    file: UploadFile = File(...),
    processing_consent: bool = Form(...),
    country: Literal["AO", "PT"] = Form(...),
    consent_language: str = Form("pt", pattern=r"^[a-z]{2}(-[A-Z]{2})?$", max_length=10),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    patient = _patient(user, db)
    if idempotency_key is not None:
        try:
            idempotency_key = str(UUID(idempotency_key))
        except ValueError:
            raise HTTPException(422, "A identificação do envio é inválida.") from None
    # Remove both path separators and control characters before persistence.
    filename = PurePath((file.filename or "").replace("\\", "/")).name
    filename = "".join(c for c in filename if c.isprintable()).strip()[:255]
    data = await file.read(MAX_BYTES + 1)
    content_type = file.content_type or ""
    validate_upload(data, content_type, filename)
    content_hash = hashlib.sha256(data).hexdigest()
    original_digest = hashlib.sha256((content_hash + "\0" + content_type + "\0" + filename).encode()).hexdigest()
    digest = hashlib.sha256(json.dumps([original_digest, country, consent_language, processing_consent], separators=(',', ':')).encode()).hexdigest()

    def existing_request():
        return db.query(PatientDocument).filter(
            PatientDocument.patient_id == patient.id,
            PatientDocument.idempotency_key == idempotency_key,
        ).first() if idempotency_key else None

    existing = existing_request()
    if existing:
        if existing.request_digest != digest and not (existing.country is None and existing.consent_language is None and existing.request_digest == original_digest):
            raise HTTPException(409, "A identificação do envio já pertence a outro documento.")
        return serialize_document(existing)
    from app.services.appointments import lock_resources
    lock_resources(db, None, patient.id)
    existing = existing_request()
    if existing:
        if existing.request_digest != digest and not (existing.country is None and existing.consent_language is None and existing.request_digest == original_digest):
            raise HTTPException(409, "A identificação do envio já pertence a outro documento.")
        return serialize_document(existing)
    _configured()
    _consent(patient.id, db, country, consent_language)
    if not processing_consent:
        raise HTTPException(422, "Confirme o processamento deste documento.")
    identifier = str(uuid4())
    storage = get_health_storage()
    try:
        key, _ = storage.upload_bytes(
            data, category=f"patient-documents/{patient.id}",
            filename=identifier + PurePath(filename).suffix.lower(), content_type=content_type,
        )
    except Exception:
        raise HTTPException(503, "Não foi possível guardar o ficheiro. Tente novamente.") from None
    document = PatientDocument(
        id=identifier, patient_id=patient.id, original_filename=filename, country=country, consent_language=consent_language,
        content_type=content_type, size_bytes=len(data), storage_key=key,
        sha256=content_hash, idempotency_key=idempotency_key, request_digest=digest,
        status="pending_processing", scan_status="pending", version=1, extraction_method="none",
    )
    commit_attempted = False
    try:
        db.add(document)
        db.flush()
        _audit(db, user, document, "patient_document_uploaded")
        commit_attempted = True
        db.commit()
    except Exception as exc:
        db.rollback()
        safe_to_delete = not commit_attempted
        if commit_attempted:
            try:
                persisted = db.execute(select(PatientDocument.id).where(PatientDocument.id == identifier)).scalar_one_or_none()
                if persisted:
                    return serialize_document(db.get(PatientDocument, identifier, populate_existing=True))
                safe_to_delete = True
            except Exception:
                # Unknown commit outcome: retain the original for retry/reconciliation.
                # Deleting here could destroy a successfully committed document.
                safe_to_delete = False
                db.rollback()
        if safe_to_delete:
            try:
                storage.delete(key)
            except Exception:
                pass  # Failed cleanup needs operational reconciliation, without exposing storage errors.
        # A duplicate arriving concurrently recovers the already committed object.
        if isinstance(exc, IntegrityError) and idempotency_key:
            existing = existing_request()
            if existing and existing.request_digest == digest:
                return serialize_document(existing)
            if existing:
                raise HTTPException(409, "A identificação do envio já pertence a outro documento.") from None
        raise HTTPException(503, "Não foi possível guardar o documento. Tente novamente.") from None
    # A refresh/serialization failure after commit must never delete the committed original.
    try:
        db.refresh(document)
        return serialize_document(document)
    except Exception:
        raise HTTPException(503, "O envio foi guardado. Tente novamente com a mesma identificação.") from None


@router.get("/{document_id}")
def get_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = _get(document_id, user, db)
    _audit(db, user, document, "patient_document_read")
    _commit(db)
    return serialize_document(document)


class ProcessRequest(BaseModel):
    version: StrictInt = Field(ge=1)


@router.post("/{document_id}/process")
def process_document(document_id: str, body: ProcessRequest,
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _configured()
    document = _get(document_id, user, db, owner=True)
    _consent(document.patient_id, db, document.country, document.consent_language)
    _verify_version(document, body.version)
    if document.status not in {"pending_processing", "processing_failed"}:
        raise HTTPException(409, "Este documento já foi processado.")
    try:
        data = get_health_storage().download_bytes(document.storage_key)
    except Exception:
        raise HTTPException(503, "O ficheiro está temporariamente indisponível.") from None
    # Detect storage substitution before a previously issued clean result is usable.
    if len(data) != document.size_bytes or hashlib.sha256(data).hexdigest() != document.sha256:
        scan = "error"
        result = {"status": "blocked", "text": "", "method": "none", "error_code": "integrity_failed"}
    else:
        scan = scan_document(data)
        if scan == "clean":
            try:
                result = extract_document(data, document.content_type)
            except Exception:
                result = {"status": "processing_failed", "text": "", "method": "none", "error_code": "extraction_unavailable"}
        elif scan == "infected":
            result = {"status": "blocked", "text": "", "method": "none", "error_code": "unsafe_file"}
        else:
            scan = "error"
            result = {"status": "processing_failed", "text": "", "method": "none", "error_code": "scanner_unavailable"}
    _mutate(db, document, body.version, status=result["status"], scan_status=scan,
            extraction_method=result["method"], extracted_text=result["text"], error_code=result["error_code"])
    _audit(db, user, document, "patient_document_processed")
    _commit(db)
    return serialize_document(document)


@router.get("/{document_id}/download")
def download_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = _get(document_id, user, db)
    if document.scan_status != "clean":
        raise HTTPException(409, "O documento ainda não passou a verificação de segurança.")
    try:
        data = get_health_storage().download_bytes(document.storage_key)
    except Exception:
        raise HTTPException(503, "O ficheiro está temporariamente indisponível.") from None
    if len(data) != document.size_bytes or hashlib.sha256(data).hexdigest() != document.sha256:
        raise HTTPException(409, "O ficheiro não corresponde ao documento verificado.")
    _audit(db, user, document, "patient_document_downloaded")
    _commit(db)
    return Response(data, media_type=document.content_type, headers={
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(document.original_filename, safe=""),
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    })


class ReviewRequest(BaseModel):
    version: StrictInt = Field(ge=1)
    decision: Literal["confirm", "reject"]
    text: str = Field(max_length=MAX_TEXT)


@router.put("/{document_id}/review")
def review_document(document_id: str, body: ReviewRequest,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = _get(document_id, user, db, owner=True)
    _consent(document.patient_id, db, document.country, document.consent_language)
    _verify_version(document, body.version)
    if document.scan_status != "clean" or document.status not in {"ready_for_review", "needs_manual_review"}:
        raise HTTPException(409, "Este documento não está disponível para revisão.")
    text = body.text.strip()
    if body.decision == "confirm" and not text:
        raise HTTPException(422, "Introduza e reveja o texto antes de confirmar.")
    _mutate(db, document, body.version,
            status="confirmed" if body.decision == "confirm" else "rejected",
            reviewed_text=text if body.decision == "confirm" else None,
            reviewed_at=datetime.utcnow())
    _audit(db, user, document, "patient_document_reviewed")
    _commit(db)
    return serialize_document(document)
