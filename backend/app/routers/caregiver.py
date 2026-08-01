from __future__ import annotations
"""Caregiver + dependant management (§6).

A caregiver creates their own account, then links dependants with granular,
opt-in access scopes. Rules enforced here:

- Access is never all-or-nothing: every scope defaults OFF.
- ``can_act_on_behalf`` for a minor / legal ward requires guardianship
  evidence on file first.
- Every material change writes a ``DependantAccessEvent`` audit row.

    POST   /api/v1/caregiver/dependants                 add a dependant
    GET    /api/v1/caregiver/dependants                 list own dependants
    PATCH  /api/v1/caregiver/dependants/{id}/scopes     update access scopes
    POST   /api/v1/caregiver/dependants/{id}/evidence   upload guardianship proof
    POST   /api/v1/caregiver/dependants/{id}/invite     invite another guardian
    POST   /api/v1/caregiver/dependants/{id}/revoke     revoke access
    GET    /api/v1/caregiver/dependants/{id}/history     access-event history
"""
import hashlib
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.health_models import DependantAccessEvent, DependantLink
from app.models import User
from app.services.health_storage import get_health_storage

router = APIRouter(prefix="/api/v1/caregiver", tags=["caregiver"])

CAREGIVER_TYPES = {
    "parent_minor", "legal_guardian", "informal", "authorised_family", "professional",
}
# Types for which acting on behalf requires guardianship evidence.
EVIDENCE_REQUIRED_TYPES = {"parent_minor", "legal_guardian"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MIME_SIGNATURES = {
    "application/pdf": (b"%PDF-",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}


# ── Bodies ──────────────────────────────────────────────────────────────────

class DependantBody(BaseModel):
    full_name: str = Field(..., min_length=1)
    caregiver_type: str
    relationship: str = Field(..., min_length=1)
    date_of_birth: Optional[str] = None
    # Scopes are opt-in; omitted → False.
    can_view_appointments: bool = False
    can_view_prescriptions: bool = False
    can_receive_reminders: bool = False
    can_act_on_behalf: bool = False


class ScopesBody(BaseModel):
    can_view_appointments: Optional[bool] = None
    can_view_prescriptions: Optional[bool] = None
    can_receive_reminders: Optional[bool] = None
    can_act_on_behalf: Optional[bool] = None


class InviteBody(BaseModel):
    guardian_email: str = Field(..., min_length=3)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _serialize(link: DependantLink) -> dict:
    return {
        "id": link.id,
        "caregiver_type": link.caregiver_type,
        "relationship": link.relationship,
        "full_name": link.full_name,
        "date_of_birth": link.date_of_birth,
        "is_minor": link.is_minor,
        "has_evidence": bool(link.evidence_storage_key),
        "evidence_filename": link.evidence_filename,
        "scopes": {
            "view_appointments": link.can_view_appointments,
            "view_prescriptions": link.can_view_prescriptions,
            "receive_reminders": link.can_receive_reminders,
            "act_on_behalf": link.can_act_on_behalf,
        },
        "status": link.status,
        "created_at": link.created_at,
        "updated_at": link.updated_at,
    }


def _is_minor(dob: Optional[str]) -> bool:
    if not dob:
        return False
    try:
        born = date.fromisoformat(dob)
    except ValueError:
        return False
    today = date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age < 18


def _own_link_or_404(db: Session, user_id: str, link_id: str) -> DependantLink:
    link = (
        db.query(DependantLink)
        .filter(DependantLink.id == link_id, DependantLink.caregiver_user_id == user_id)
        .first()
    )
    if not link:
        raise HTTPException(404, "Dependente não encontrado.")
    return link


def _event(db: Session, link_id: str, actor_id: str, event_type: str, detail: str | None = None) -> None:
    db.add(DependantAccessEvent(
        dependant_link_id=link_id, actor_user_id=actor_id,
        event_type=event_type, detail=detail,
    ))


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/dependants", status_code=201)
def add_dependant(
    body: DependantBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.caregiver_type not in CAREGIVER_TYPES:
        raise HTTPException(422, f"caregiver_type deve ser um de: {', '.join(sorted(CAREGIVER_TYPES))}")

    minor = _is_minor(body.date_of_birth)
    # Acting on behalf of a minor / ward needs evidence, which isn't uploaded
    # yet at creation — force the scope off and let the caregiver enable it
    # after uploading proof.
    act_on_behalf = body.can_act_on_behalf
    if act_on_behalf and (minor or body.caregiver_type in EVIDENCE_REQUIRED_TYPES):
        act_on_behalf = False

    link = DependantLink(
        caregiver_user_id=user.id,
        caregiver_type=body.caregiver_type,
        relationship=body.relationship,
        full_name=body.full_name,
        date_of_birth=body.date_of_birth,
        is_minor=minor,
        can_view_appointments=body.can_view_appointments,
        can_view_prescriptions=body.can_view_prescriptions,
        can_receive_reminders=body.can_receive_reminders,
        can_act_on_behalf=act_on_behalf,
        status="active",
    )
    db.add(link)
    db.flush()
    _event(db, link.id, user.id, "created", f"type={body.caregiver_type}")
    db.commit()
    db.refresh(link)
    return _serialize(link)


@router.get("/dependants")
def list_dependants(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    links = (
        db.query(DependantLink)
        .filter(DependantLink.caregiver_user_id == user.id)
        .order_by(DependantLink.created_at.desc())
        .all()
    )
    return [_serialize(l) for l in links]


@router.patch("/dependants/{link_id}/scopes")
def update_scopes(
    link_id: str,
    body: ScopesBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = _own_link_or_404(db, user.id, link_id)
    if link.status != "active":
        raise HTTPException(409, "Este acesso não está ativo.")

    if body.can_view_appointments is not None:
        link.can_view_appointments = body.can_view_appointments
    if body.can_view_prescriptions is not None:
        link.can_view_prescriptions = body.can_view_prescriptions
    if body.can_receive_reminders is not None:
        link.can_receive_reminders = body.can_receive_reminders
    if body.can_act_on_behalf is not None:
        if body.can_act_on_behalf:
            # Gate act-on-behalf behind guardianship evidence for minors/wards.
            needs_evidence = link.is_minor or link.caregiver_type in EVIDENCE_REQUIRED_TYPES
            if needs_evidence and not link.evidence_storage_key:
                raise HTTPException(
                    409,
                    "Para agir em nome deste dependente, carregue primeiro o comprovativo de tutela.",
                )
        link.can_act_on_behalf = body.can_act_on_behalf

    _event(db, link.id, user.id, "scopes_updated")
    db.commit()
    db.refresh(link)
    return _serialize(link)


@router.post("/dependants/{link_id}/evidence")
async def upload_evidence(
    link_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = _own_link_or_404(db, user.id, link_id)
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Documento vazio ou superior a 10 MB.")
    content_type = (file.content_type or "").lower()
    sigs = MIME_SIGNATURES.get(content_type)
    if not sigs or not any(data.startswith(s) for s in sigs):
        raise HTTPException(415, "Apenas PDF, JPEG ou PNG válidos são aceites.")

    storage = get_health_storage()
    key, _ = storage.upload_bytes(
        data, f"guardianship/{link.id}", file.filename or "evidence.bin", content_type,
    )
    link.evidence_storage_key = key
    link.evidence_filename = (file.filename or "evidence.bin")[:250]
    _event(db, link.id, user.id, "evidence_uploaded", link.evidence_filename)
    db.commit()
    db.refresh(link)
    return _serialize(link)


@router.post("/dependants/{link_id}/invite")
def invite_guardian(
    link_id: str,
    body: InviteBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = _own_link_or_404(db, user.id, link_id)
    # Records the invitation intent + audit. Actual email dispatch is handled
    # by the notification/mail layer when configured.
    _event(db, link.id, user.id, "guardian_invited", body.guardian_email)
    db.commit()
    return {"invited": body.guardian_email, "dependant_link_id": link.id}


@router.post("/dependants/{link_id}/revoke")
def revoke_access(
    link_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    link = _own_link_or_404(db, user.id, link_id)
    link.status = "revoked"
    link.can_view_appointments = False
    link.can_view_prescriptions = False
    link.can_receive_reminders = False
    link.can_act_on_behalf = False
    _event(db, link.id, user.id, "access_revoked")
    db.commit()
    db.refresh(link)
    return _serialize(link)


@router.get("/dependants/{link_id}/history")
def access_history(
    link_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _own_link_or_404(db, user.id, link_id)  # authz
    rows = (
        db.query(DependantAccessEvent)
        .filter(DependantAccessEvent.dependant_link_id == link_id)
        .order_by(DependantAccessEvent.at.asc())
        .all()
    )
    return [
        {"id": r.id, "event_type": r.event_type, "detail": r.detail,
         "actor_user_id": r.actor_user_id, "at": r.at}
        for r in rows
    ]
