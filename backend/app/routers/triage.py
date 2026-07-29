from __future__ import annotations
"""
Triage Router — Digital triage sessions for patients.

Endpoints:
- POST /api/v1/triage/start — Start a new triage session
- POST /api/v1/triage/{id}/answers — Submit answers
- POST /api/v1/triage/{id}/complete — Complete and get result
- GET  /api/v1/triage/history — Patient triage history
"""
import hashlib
import io
import json
import logging
import zipfile
from pathlib import Path
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.health_models import (
    Consultation, Doctor, Patient, TriageSession, TriageAnswer, TriagePhoto,
    TriagePhotoRequest, TriageResult,
)
from app.health_schemas import (
    TriageStartRequest, TriageStartResponse,
    TriageAnswerSubmit, TriageResultOut,
    TriageHistoryItem, TriagePhotoOut, TriagePhotoRequestCreate,
    TriagePhotoRequestOut, RoleEnum,
)
from app.rbac import get_patient_for_user, log_health_audit, require_verified_doctor
from app.routers.notifications import create_notification
from app.services.health_storage import get_health_storage
from app.services.triage_engine import get_triage_questions, evaluate_triage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/triage", tags=["triage"])

ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIEW_TYPES = {"orientation", "context", "closeup"}
MAX_PHOTO_BYTES = 8 * 1024 * 1024
MAX_PHOTOS_PER_TRIAGE = 3


def _has_expected_image_signature(content: bytes, content_type: str) -> bool:
    signatures = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP",
    }
    return signatures.get(content_type, False)


def _photo_out(photo: TriagePhoto) -> TriagePhotoOut:
    try:
        technical_check = json.loads(photo.technical_check_json or "{}")
    except (json.JSONDecodeError, TypeError):
        technical_check = {}
    return TriagePhotoOut(
        id=photo.id,
        triage_session_id=photo.triage_session_id,
        view_type=photo.view_type,
        original_filename=photo.original_filename,
        content_type=photo.content_type,
        size_bytes=photo.size_bytes,
        technical_check=technical_check,
        content_url=f"/api/v1/triage/{photo.triage_session_id}/photos/{photo.id}/content",
        created_at=photo.created_at,
    )


def _photo_request_out(request: TriagePhotoRequest) -> TriagePhotoRequestOut:
    doctor = request.doctor
    doctor_name = None
    if doctor:
        display_name = doctor.display_name or "Profissional KAYA"
        doctor_name = f"{doctor.title or 'Dr.'} {display_name}".strip()
    return TriagePhotoRequestOut(
        id=request.id,
        triage_session_id=request.triage_session_id,
        consultation_id=request.consultation_id,
        view_type=request.view_type,
        message=request.message,
        status=request.status,
        chief_complaint=request.triage_session.chief_complaint,
        doctor_name=doctor_name,
        created_at=request.created_at,
        fulfilled_at=request.fulfilled_at,
    )


def _assert_photo_access(triage_id: str, user: User, db: Session) -> TriageSession:
    session = db.query(TriageSession).filter(TriageSession.id == triage_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")

    if user.role == RoleEnum.PATIENT:
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if patient and session.patient_id == patient.id:
            return session
    elif user.role == RoleEnum.DOCTOR:
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if doctor:
            linked = db.query(Consultation.id).filter(
                Consultation.triage_session_id == triage_id,
                Consultation.doctor_id == doctor.id,
            ).first()
            if linked:
                return session
    elif user.role == RoleEnum.NURSE:
        linked = db.query(Consultation.id).filter(
            Consultation.triage_session_id == triage_id,
        ).first()
        if linked:
            return session

    raise HTTPException(status_code=403, detail="Sem acesso às fotografias desta triagem.")


@router.post("/start", response_model=TriageStartResponse)
def start_triage(
    body: TriageStartRequest,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Start a new triage session. Returns triage ID and questions."""
    session = TriageSession(
        patient_id=patient.id,
        status="in_progress",
        chief_complaint=body.chief_complaint,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return TriageStartResponse(
        triage_id=session.id,
        session_id=session.id,
        status=session.status,
        questions=get_triage_questions(age_group=body.age_group, category=body.category),
    )


@router.post("/{triage_id}/photos", response_model=TriagePhotoOut, status_code=201)
async def upload_triage_photo(
    triage_id: str,
    file: UploadFile = File(...),
    view_type: str = Form(...),
    technical_check: str = Form("{}"),
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach a private, non-diagnostic photograph for later clinician review."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")
    pending_request = db.query(TriagePhotoRequest).filter(
        TriagePhotoRequest.triage_session_id == triage_id,
        TriagePhotoRequest.view_type == view_type,
        TriagePhotoRequest.status == "requested",
    ).first()
    if session.status != "in_progress" and not (
        session.status == "completed" and pending_request
    ):
        raise HTTPException(status_code=400, detail="Só pode adicionar fotos a uma triagem em curso.")
    if view_type not in ALLOWED_VIEW_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de vista inválido.")
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=415, detail="Use uma imagem JPEG, PNG ou WebP.")

    existing_photo = db.query(TriagePhoto).filter(
        TriagePhoto.triage_session_id == triage_id,
        TriagePhoto.view_type == view_type,
    ).first()
    current_count = db.query(TriagePhoto.id).filter(
        TriagePhoto.triage_session_id == triage_id,
    ).count()
    if not existing_photo and current_count >= MAX_PHOTOS_PER_TRIAGE:
        raise HTTPException(status_code=400, detail="Limite de 3 fotografias por triagem.")

    content = await file.read(MAX_PHOTO_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="A fotografia está vazia.")
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="A fotografia excede o limite de 8 MB.")
    if not _has_expected_image_signature(content, file.content_type):
        raise HTTPException(status_code=415, detail="O conteúdo do ficheiro não corresponde a uma imagem válida.")
    try:
        technical_data = json.loads(technical_check)
        if not isinstance(technical_data, dict):
            raise ValueError
    except (json.JSONDecodeError, ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Relatório técnico da fotografia inválido.")

    filename = Path(file.filename or f"{view_type}.jpg").name[:255]
    storage = get_health_storage()
    storage_key, _ = storage.upload_bytes(
        content,
        category=f"triage/{triage_id}",
        filename=filename,
        content_type=file.content_type,
    )
    if existing_photo:
        storage.delete(existing_photo.storage_key)
        photo = existing_photo
        photo.original_filename = filename
        photo.content_type = file.content_type
        photo.size_bytes = len(content)
        photo.storage_key = storage_key
        photo.technical_check_json = json.dumps(technical_data)
        photo.created_at = datetime.utcnow()
    else:
        photo = TriagePhoto(
            triage_session_id=triage_id,
            view_type=view_type,
            original_filename=filename,
            content_type=file.content_type,
            size_bytes=len(content),
            storage_key=storage_key,
            technical_check_json=json.dumps(technical_data),
        )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    fulfilled_requests = db.query(TriagePhotoRequest).filter(
        TriagePhotoRequest.triage_session_id == triage_id,
        TriagePhotoRequest.view_type == view_type,
        TriagePhotoRequest.status == "requested",
    ).all()
    for photo_request in fulfilled_requests:
        photo_request.status = "fulfilled"
        photo_request.fulfilled_at = datetime.utcnow()
        db.add(photo_request)
    if fulfilled_requests:
        db.commit()
    log_health_audit(
        db,
        action="triage_photo_uploaded",
        actor_user_id=user.id,
        resource_type="triage_photo",
        resource_id=photo.id,
        metadata={"triage_id": triage_id, "view_type": view_type, "size_bytes": len(content)},
    )
    for photo_request in fulfilled_requests:
        try:
            create_notification(
                db,
                user_id=photo_request.doctor.user_id,
                title="Nova fotografia de triagem",
                message=f"O paciente enviou a vista pedida ({view_type}).",
                type="success",
                entity_type="triage",
                entity_id=triage_id,
            )
        except Exception:
            pass
    return _photo_out(photo)


@router.get("/{triage_id}/photos", response_model=List[TriagePhotoOut])
def list_triage_photos(
    triage_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List photo metadata for the patient or linked clinical professional."""
    _assert_photo_access(triage_id, user, db)
    photos = db.query(TriagePhoto).filter(
        TriagePhoto.triage_session_id == triage_id,
    ).order_by(TriagePhoto.created_at.asc()).all()
    return [_photo_out(photo) for photo in photos]


@router.get("/photo-requests/pending", response_model=List[TriagePhotoRequestOut])
def list_pending_photo_requests(
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """List outstanding clinician photo requests for the current patient."""
    requests = (
        db.query(TriagePhotoRequest)
        .join(TriageSession, TriagePhotoRequest.triage_session_id == TriageSession.id)
        .filter(
            TriageSession.patient_id == patient.id,
            TriagePhotoRequest.status == "requested",
        )
        .order_by(TriagePhotoRequest.created_at.desc())
        .all()
    )
    return [_photo_request_out(item) for item in requests]


@router.get("/{triage_id}/photo-requests", response_model=List[TriagePhotoRequestOut])
def list_photo_requests(
    triage_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List requests for the owning patient or a linked clinical professional."""
    _assert_photo_access(triage_id, user, db)
    requests = db.query(TriagePhotoRequest).filter(
        TriagePhotoRequest.triage_session_id == triage_id,
    ).order_by(TriagePhotoRequest.created_at.desc()).all()
    return [_photo_request_out(item) for item in requests]


@router.post(
    "/{triage_id}/photo-requests",
    response_model=TriagePhotoRequestOut,
    status_code=201,
)
def request_triage_photo(
    triage_id: str,
    body: TriagePhotoRequestCreate,
    user: User = Depends(require_verified_doctor),
    db: Session = Depends(get_db),
):
    """Allow only the doctor linked to an active consultation to request a view."""
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    consultation = db.query(Consultation).filter(
        Consultation.triage_session_id == triage_id,
        Consultation.doctor_id == doctor.id,
        Consultation.status.in_(("scheduled", "in_progress")),
    ).first()
    if not consultation:
        raise HTTPException(
            status_code=403,
            detail="Só o médico associado a uma consulta ativa pode pedir fotografias.",
        )

    existing = db.query(TriagePhotoRequest).filter(
        TriagePhotoRequest.triage_session_id == triage_id,
        TriagePhotoRequest.doctor_id == doctor.id,
        TriagePhotoRequest.view_type == body.view_type,
        TriagePhotoRequest.status == "requested",
    ).first()
    if existing:
        return _photo_request_out(existing)

    photo_request = TriagePhotoRequest(
        triage_session_id=triage_id,
        consultation_id=consultation.id,
        doctor_id=doctor.id,
        view_type=body.view_type,
        message=(body.message or "").strip() or None,
    )
    db.add(photo_request)
    db.commit()
    db.refresh(photo_request)
    patient = consultation.patient
    try:
        create_notification(
            db,
            user_id=patient.user_id,
            title="Pedido de fotografia de triagem",
            message=(
                f"O profissional pediu uma nova fotografia ({body.view_type}). "
                "Abra o histórico de triagem para responder."
            ),
            type="warning",
            entity_type="triage",
            entity_id=triage_id,
        )
    except Exception:
        pass
    log_health_audit(
        db,
        action="triage_photo_requested_by_doctor",
        actor_user_id=user.id,
        resource_type="triage_photo_request",
        resource_id=photo_request.id,
        metadata={
            "triage_id": triage_id,
            "consultation_id": consultation.id,
            "view_type": body.view_type,
        },
    )
    return _photo_request_out(photo_request)


@router.get("/{triage_id}/photos-export")
def export_triage_photos(
    triage_id: str,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export the patient's private triage photographs with a portable manifest."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")

    photos = db.query(TriagePhoto).filter(
        TriagePhoto.triage_session_id == triage_id,
    ).order_by(TriagePhoto.created_at.asc()).all()
    storage = get_health_storage()
    archive = io.BytesIO()
    manifest_photos = []
    extensions = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for index, photo in enumerate(photos, start=1):
            content = storage.download_bytes(photo.storage_key)
            filename = f"{index:02d}-{photo.view_type}.{extensions.get(photo.content_type, 'bin')}"
            bundle.writestr(filename, content)
            try:
                technical_check = json.loads(photo.technical_check_json or "{}")
            except (json.JSONDecodeError, TypeError):
                technical_check = {}
            manifest_photos.append({
                "id": photo.id,
                "view_type": photo.view_type,
                "filename": filename,
                "original_filename": photo.original_filename,
                "content_type": photo.content_type,
                "size_bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "technical_check": technical_check,
                "created_at": photo.created_at.isoformat(),
            })
        manifest = {
            "format": "kaya-triage-photo-export-v1",
            "triage_session_id": triage_id,
            "chief_complaint": session.chief_complaint,
            "exported_at": datetime.utcnow().isoformat(),
            "photo_count": len(manifest_photos),
            "photos": manifest_photos,
        }
        bundle.writestr(
            "manifest.json",
            json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
        )
    archive.seek(0)
    log_health_audit(
        db,
        action="triage_photos_exported_by_patient",
        actor_user_id=user.id,
        resource_type="triage_session",
        resource_id=triage_id,
        metadata={"photo_count": len(manifest_photos)},
    )
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="kaya-triage-{triage_id}-photos.zip"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{triage_id}/photos/{photo_id}/content")
def get_triage_photo_content(
    triage_id: str,
    photo_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return private photo content after row-level authorisation."""
    _assert_photo_access(triage_id, user, db)
    photo = db.query(TriagePhoto).filter(
        TriagePhoto.id == photo_id,
        TriagePhoto.triage_session_id == triage_id,
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Fotografia não encontrada.")
    location = get_health_storage().get_signed_url(photo.storage_key)
    if location.startswith(("http://", "https://")):
        return RedirectResponse(location)
    return FileResponse(
        location,
        media_type=photo.content_type,
        filename=photo.original_filename,
    )


@router.delete("/{triage_id}/photos/{photo_id}", status_code=204)
def delete_triage_photo(
    triage_id: str,
    photo_id: str,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Let a patient permanently remove one of their own triage photographs."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")
    photo = db.query(TriagePhoto).filter(
        TriagePhoto.id == photo_id,
        TriagePhoto.triage_session_id == triage_id,
    ).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Fotografia não encontrada.")

    view_type = photo.view_type
    get_health_storage().delete(photo.storage_key)
    db.delete(photo)
    fulfilled_requests = db.query(TriagePhotoRequest).filter(
        TriagePhotoRequest.triage_session_id == triage_id,
        TriagePhotoRequest.view_type == view_type,
        TriagePhotoRequest.status == "fulfilled",
    ).all()
    for photo_request in fulfilled_requests:
        photo_request.status = "requested"
        photo_request.fulfilled_at = None
        db.add(photo_request)
    db.commit()
    log_health_audit(
        db,
        action="triage_photo_deleted_by_patient",
        actor_user_id=user.id,
        resource_type="triage_photo",
        resource_id=photo_id,
        metadata={"triage_id": triage_id, "view_type": view_type},
    )
    return Response(status_code=204)


@router.post("/{triage_id}/answers")
def submit_answers(
    triage_id: str,
    body: TriageAnswerSubmit,
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Submit answers for a triage session."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Sessão já completada ou expirada.")

    # Store answers
    normalized_answers = (
        [{"question_key": key, "answer": value} for key, value in body.answers.items()]
        if isinstance(body.answers, dict)
        else body.answers
    )
    for answer in normalized_answers:
        q_key = answer.get("question_key", "")
        a_val = answer.get("answer", "")
        ta = TriageAnswer(
            triage_session_id=triage_id,
            question_key=q_key,
            answer_value=json.dumps(a_val),
        )
        db.add(ta)

    db.commit()
    return {"detail": "Respostas registadas.", "triage_id": triage_id}


@router.post("/{triage_id}/complete", response_model=TriageResultOut)
def complete_triage(
    triage_id: str,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete a triage session and get the risk assessment result."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sessão de triagem não encontrada.")
    if session.status != "in_progress":
        raise HTTPException(status_code=400, detail="Sessão já completada.")

    # Collect answers
    answers_rows = db.query(TriageAnswer).filter(
        TriageAnswer.triage_session_id == triage_id,
    ).all()

    answers_dict = {}
    for a in answers_rows:
        try:
            answers_dict[a.question_key] = json.loads(a.answer_value)
        except (json.JSONDecodeError, TypeError):
            answers_dict[a.question_key] = a.answer_value

    # Evaluate
    evaluation = evaluate_triage(answers_dict)

    # Store result
    result = TriageResult(
        triage_session_id=triage_id,
        risk_level=evaluation.risk_level,
        recommended_action=evaluation.recommended_action,
        score=evaluation.score,
        reasoning_json=json.dumps(evaluation.reasoning),
    )
    db.add(result)

    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.add(session)
    db.commit()
    db.refresh(result)

    # Audit log for urgent results
    if evaluation.risk_level == "URGENT":
        log_health_audit(
            db,
            action="triage_urgent_flag",
            actor_user_id=user.id,
            resource_type="triage_session",
            resource_id=triage_id,
            metadata={"risk_level": evaluation.risk_level, "score": evaluation.score},
        )

    return TriageResultOut(
        triage_id=triage_id,
        risk_level=evaluation.risk_level,
        recommended_action=evaluation.recommended_action,
        score=evaluation.score,
        reasoning=evaluation.reasoning,
    )


@router.get("/history", response_model=List[TriageHistoryItem])
def triage_history(
    patient: Patient = Depends(get_patient_for_user),
    db: Session = Depends(get_db),
):
    """Get the patient's triage history."""
    sessions = (
        db.query(TriageSession)
        .filter(TriageSession.patient_id == patient.id)
        .order_by(TriageSession.created_at.desc())
        .limit(50)
        .all()
    )
    items = []
    for s in sessions:
        result = db.query(TriageResult).filter(
            TriageResult.triage_session_id == s.id
        ).first()
        items.append(TriageHistoryItem(
            id=s.id,
            status=s.status,
            chief_complaint=s.chief_complaint,
            risk_level=result.risk_level if result else None,
            recommended_action=result.recommended_action if result else None,
            created_at=s.created_at,
            completed_at=s.completed_at,
        ))
    return items


@router.delete("/{triage_id}", status_code=204)
def delete_triage(
    triage_id: str,
    patient: Patient = Depends(get_patient_for_user),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a triage session (and its answers/result) belonging to the current patient."""
    session = db.query(TriageSession).filter(
        TriageSession.id == triage_id,
        TriageSession.patient_id == patient.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Triagem não encontrada.")

    # Delete private photo objects before removing database records.
    storage = get_health_storage()
    for photo in db.query(TriagePhoto).filter(
        TriagePhoto.triage_session_id == triage_id
    ).all():
        storage.delete(photo.storage_key)

    # Delete related records first.
    # Use synchronize_session=False to avoid StaleDataError when the ORM
    # cascade also tries to delete already-gone rows.
    db.query(TriageAnswer).filter(
        TriageAnswer.triage_session_id == triage_id
    ).delete(synchronize_session=False)
    db.query(TriageResult).filter(
        TriageResult.triage_session_id == triage_id
    ).delete(synchronize_session=False)
    db.query(TriagePhoto).filter(
        TriagePhoto.triage_session_id == triage_id
    ).delete(synchronize_session=False)
    db.delete(session)
    db.commit()

    log_health_audit(
        db,
        action="triage_deleted",
        actor_user_id=user.id,
        resource_type="triage_session",
        resource_id=triage_id,
        metadata={"reason": "patient_requested_deletion"},
    )
    return
