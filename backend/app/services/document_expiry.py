from __future__ import annotations
"""Document-expiry monitoring.

Runs periodically (via cron or the admin scan endpoint) to:

    1. Find every credential whose licence_expiry_date is coming up (or
       already passed) and fire a Notification at each configured threshold:
       90 / 60 / 30 / 14 / 7 / 0 days out.
    2. On the day the licence expires, transition a currently-``verified``
       credential to ``expired`` via the state machine — the spec is
       explicit that expired licences must lose privileges but preserve
       historical access.

The scanner is idempotent: it uses ``DocumentExpiryReminder`` with a unique
(entity, kind, threshold) index, so re-runs at any cadence never fire the
same reminder twice.
"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.health_models import (
    ClinicianCredential,
    DocumentExpiryReminder,
    Notification,
)

from .verification.state_machine import (
    InvalidTransitionError,
    record_transition,
)


ENTITY_TYPE_CREDENTIAL = "clinician_credential"

# Configurable per spec §14. Positive values = days before expiry, 0 = day-of.
DEFAULT_THRESHOLDS: tuple[int, ...] = (90, 60, 30, 14, 7, 0)


@dataclass
class ScanResult:
    scanned: int = 0
    reminders_fired: int = 0
    notifications_written: int = 0
    credentials_expired: int = 0
    details: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "scanned": self.scanned,
            "reminders_fired": self.reminders_fired,
            "notifications_written": self.notifications_written,
            "credentials_expired": self.credentials_expired,
            "details": self.details,
        }


def _parse_iso(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _reminder_message_pt(kind: str, days: int, expiry: date) -> tuple[str, str, str]:
    """Return (title, message, notification_type). Portuguese-first."""
    kind_label = {
        "professional_licence": "cédula profissional",
        "insurance": "seguro profissional",
        "identity_document": "documento de identidade",
    }.get(kind, kind)
    when = expiry.isoformat()
    if days <= 0:
        return (
            f"⚠ {kind_label.title()} expirou",
            f"A sua {kind_label} expirou em {when}. "
            "Não poderá aceitar novos pacientes até renovar. "
            "Envie o documento actualizado no ecrã Verificação profissional.",
            "error",
        )
    if days <= 14:
        return (
            f"Renove a sua {kind_label}",
            f"A sua {kind_label} expira em {days} dia(s) ({when}). "
            "Renove agora para não interromper o serviço.",
            "warning",
        )
    return (
        f"Lembrete: {kind_label} expira em breve",
        f"A sua {kind_label} expira em {days} dias ({when}).",
        "info",
    )


def _upsert_reminder(
    db: Session,
    *,
    entity_id: str,
    document_kind: str,
    expiry_iso: str,
    threshold: int,
    user_id: str,
    result: ScanResult,
) -> None:
    """Insert reminder + notification atomically. Silently no-ops on duplicate."""
    title, message, ntype = _reminder_message_pt(document_kind, threshold, date.fromisoformat(expiry_iso))
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=ntype,
        related_entity_type=ENTITY_TYPE_CREDENTIAL,
        related_entity_id=entity_id,
    )
    db.add(notification)
    db.flush()  # populate notification.id
    reminder = DocumentExpiryReminder(
        entity_type=ENTITY_TYPE_CREDENTIAL,
        entity_id=entity_id,
        document_kind=document_kind,
        expiry_date=expiry_iso,
        threshold_days=threshold,
        notification_id=notification.id,
    )
    db.add(reminder)
    try:
        db.flush()
    except IntegrityError:
        # Another concurrent scan beat us to it — roll back the reminder +
        # notification pair, keep the outer transaction healthy.
        db.rollback()
        return
    result.reminders_fired += 1
    result.notifications_written += 1
    result.details.append({
        "credential_id": entity_id,
        "document_kind": document_kind,
        "threshold_days": threshold,
        "expiry_date": expiry_iso,
    })


def scan_credentials(
    db: Session,
    *,
    thresholds: tuple[int, ...] = DEFAULT_THRESHOLDS,
    today: Optional[date] = None,
) -> ScanResult:
    """Scan every credential's licence_expiry_date and fire due reminders.

    ``today`` is injectable so tests can pin the date. The scanner commits
    once at the end so the whole batch is either applied or rolled back.
    """
    reference = today or date.today()
    result = ScanResult()

    credentials = db.query(ClinicianCredential).filter(
        ClinicianCredential.licence_expiry_date.is_not(None)
    ).all()

    for cred in credentials:
        result.scanned += 1
        expiry = _parse_iso(cred.licence_expiry_date)
        if not expiry:
            continue
        days_remaining = (expiry - reference).days

        # Fire every threshold we've reached or passed since last scan.
        # e.g. if today is 45 days before expiry, we fire the 90 + 60
        # thresholds if their reminders haven't already been written.
        for threshold in thresholds:
            if days_remaining <= threshold:
                _upsert_reminder(
                    db,
                    entity_id=cred.id,
                    document_kind="professional_licence",
                    expiry_iso=cred.licence_expiry_date,
                    threshold=threshold,
                    user_id=cred.user_id,
                    result=result,
                )

        # If the licence has actually expired AND the credential is still
        # marked verified/completed, transition it to "expired" so downstream
        # RBAC gates (require_verified_clinician) automatically deny.
        if days_remaining <= 0 and cred.status in ("verified", "completed"):
            try:
                record_transition(
                    db,
                    entity_type=ENTITY_TYPE_CREDENTIAL,
                    entity_id=cred.id,
                    previous_status=cred.status,
                    new_status="expired",
                    actor_user_id=None,
                    actor_kind="system",
                    reason_code="licence_expired",
                    reason_text=(
                        f"Cédula profissional expirou em {cred.licence_expiry_date}."
                    ),
                )
                cred.status = "expired"
                result.credentials_expired += 1
            except InvalidTransitionError:
                # The state graph should always allow verified→expired.
                # If it ever doesn't, we still write the reminder above.
                pass

    db.commit()
    return result
