"""Shared reviewer decision transaction for credential and compatibility routes."""
import json
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from app.credential_schemas import CredentialDecision
from app.health_models import ClinicianCredential, Doctor
from app.models import User
from app.services.clinician_access import licence_is_current
from app.services.credential_mutations import CredentialRevision, mutate_credential
from app.services.credential_verification import run_automated_checks
from app.services.verification.state_machine import is_allowed, record_transition

def application_checks(credential: ClinicianCredential) -> tuple[list[dict], int]:
    kinds = {item.kind for item in credential.evidence}
    checks, _ = run_automated_checks(credential, kinds)
    for check in checks:
        if check["code"] == "licence_not_expired":
            check["passed"] = licence_is_current(credential)
    required = [item for item in checks if item["severity"] == "required"]
    score = round(100 * sum(item["passed"] for item in required) / max(1, len(required)))
    return checks, score



def review_credential(credential_id: str, body: CredentialDecision, *, reviewer: User, db: Session) -> ClinicianCredential:
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
    checks, score = application_checks(credential)
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
    return credential
