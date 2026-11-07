"""Observability, audit, and privacy-safe telemetry (Phase 36). Domain-pure.

Security- and clinically-significant events are always audited; the audit trail is
append-only and tamper-evident; and telemetry (logs/metrics/traces/error reports)
never carries PHI or secrets. This module is the canonical policy; it composes
`app.redaction` and the PHI guard from `app.ai_egress`.

Stdlib-only (plus in-repo modules) and importable without the app.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, replace
from typing import Optional

from . import redaction
from .ai_egress import contains_phi_or_secret


# ── Audit event completeness ─────────────────────────────────────────────────

OUTCOME_SUCCESS = "success"
OUTCOME_DENIED = "denied"
OUTCOME_ERROR = "error"
_OUTCOMES = {OUTCOME_SUCCESS, OUTCOME_DENIED, OUTCOME_ERROR}


@dataclass(frozen=True)
class AuditEvent:
    actor_id: Optional[str]     # may be None for anonymous, but the field must be present
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    outcome: str
    at_epoch: int
    request_id: Optional[str] = None


def audit_event_valid(ev: AuditEvent) -> bool:
    """A usable audit event names an action, an outcome, and a time. (actor_id may
    be null for an anonymous/pre-auth action, but the who/what/when/outcome shape
    must be complete.)"""
    if not ev.action or not ev.action.strip():
        return False
    if ev.outcome not in _OUTCOMES:
        return False
    if ev.at_epoch <= 0:
        return False
    return True


# Actions that MUST be audited (never dropped by sampling or config).
MUST_AUDIT_ACTIONS = frozenset({
    "auth.login", "auth.logout", "auth.mfa", "auth.failed",
    "authz.denied", "privilege.grant", "privilege.revoke", "role.change",
    "consent.grant", "consent.withdraw",
    "clinical_note.sign", "clinical_note.amend", "prescription.issue",
    "record.access", "record.export", "file.download",
    "triage.complete", "emergency.redirect", "booking.confirm",
    "config.change", "data.delete",
})


def must_audit(action: str) -> bool:
    return action in MUST_AUDIT_ACTIONS


# ── Append-only, tamper-evident audit chain ──────────────────────────────────

_GENESIS = "0" * 64


def _hash(payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class AuditRecord:
    event: AuditEvent
    prev_hash: str
    this_hash: str


class AuditChain:
    """Append-only hash chain over audit events. Any reorder, insertion, edit, or
    deletion breaks `verify()` — the log is tamper-evident."""

    def __init__(self) -> None:
        self._items: list[AuditRecord] = []

    def _head(self) -> str:
        return self._items[-1].this_hash if self._items else _GENESIS

    def append(self, ev: AuditEvent) -> AuditRecord:
        if not audit_event_valid(ev):
            raise ValueError("incomplete audit event")
        prev = self._head()
        payload = {
            "actor_id": ev.actor_id, "action": ev.action,
            "resource_type": ev.resource_type, "resource_id": ev.resource_id,
            "outcome": ev.outcome, "at_epoch": ev.at_epoch,
            "request_id": ev.request_id, "prev_hash": prev,
        }
        rec = AuditRecord(event=ev, prev_hash=prev, this_hash=_hash(payload))
        self._items.append(rec)
        return rec

    def entries(self) -> tuple:
        return tuple(self._items)

    def verify(self) -> bool:
        prev = _GENESIS
        for rec in self._items:
            if rec.prev_hash != prev:
                return False
            payload = {
                "actor_id": rec.event.actor_id, "action": rec.event.action,
                "resource_type": rec.event.resource_type, "resource_id": rec.event.resource_id,
                "outcome": rec.event.outcome, "at_epoch": rec.event.at_epoch,
                "request_id": rec.event.request_id, "prev_hash": prev,
            }
            if rec.this_hash != _hash(payload):
                return False
            prev = rec.this_hash
        return True

    def delete(self, index: int) -> None:
        raise PermissionError("audit records are append-only and cannot be deleted")


# ── Privacy-safe telemetry ───────────────────────────────────────────────────

def scrub_telemetry(payload):
    """Return a telemetry-safe copy: sensitive/clinical keys and secret/PHI-shaped
    values are redacted (via app.redaction). Use for logs/metrics/traces."""
    return redaction.redact_mapping(payload)


def telemetry_is_safe(text: str) -> bool:
    """A log/metric/trace string is safe only when it carries no PHI or secret."""
    return not contains_phi_or_secret(text)


def assert_telemetry_safe(text: str) -> None:
    if not telemetry_is_safe(text):
        raise ValueError("telemetry payload contains PHI or secret material")


# ── Sampling never drops audit/security events ───────────────────────────────

def sampling_may_drop(action: str, is_sampled_out: bool) -> bool:
    """Trace/metric sampling may drop routine events, but NEVER a must-audit
    security/clinical event."""
    if must_audit(action):
        return False
    return is_sampled_out


# ── Audit log access control ─────────────────────────────────────────────────

_AUDIT_READER_ROLES = {"auditor", "security_admin", "dpo", "compliance"}


def can_read_audit(role: str, privileges: frozenset) -> bool:
    """Audit logs are read only by an auditor/security/compliance role holding the
    explicit `audit_read` privilege — not by ordinary clinicians or admins."""
    return role in _AUDIT_READER_ROLES and "audit_read" in privileges


# What the release board must see for the observability tier.
OBSERVABILITY_EVIDENCE_REQUIRED = (
    "tamper_evident_audit_store",
    "log_pii_scrubbing_verified",
    "audit_retention_schedule",
    "alerting_on_security_events",
)
