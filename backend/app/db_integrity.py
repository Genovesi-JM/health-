"""Database integrity, migrations, and backups (Phase 32). Domain-pure.

Governance-as-code for the data tier: a migration cannot destroy data without a
backup and a named approval, clinical records are retained rather than hard
cascade-deleted, and a backup policy is only "ok" when it is encrypted, offsite,
and has a *tested* restore. This module holds the rules; provisioning real
backups/replicas and running migrations against a live database are external,
owner-bound operations.

Stdlib-only and importable without the app.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ── Migration safety ─────────────────────────────────────────────────────────

class MigrationUnsafe(Exception):
    """A migration violates the safety policy (fail-closed)."""


@dataclass(frozen=True)
class MigrationPlan:
    name: str
    destructive: bool                 # drops/renames columns/tables, backfills that lose data
    reversible: bool                  # has a tested down-migration
    single_head: bool                 # does not create a second Alembic head
    backup_taken: bool = False        # a restorable backup exists immediately before
    approved_by: Optional[str] = None # a NAMED human approver (not the agent)
    runs_in_hold: bool = False        # attempts to run while the app is in launch-hold


AGENT_IDENTITIES = {"agent", "engineering_preparer", "claude", "automation"}


def migration_is_safe(plan: MigrationPlan) -> tuple[bool, tuple]:
    """A migration is safe only when it keeps a single head, does not run during
    the launch hold, and — if destructive — has a backup, is reversible, and is
    approved by a named human who is not the agent."""
    reasons: list[str] = []
    if not plan.single_head:
        reasons.append("would create a second migration head")
    if plan.runs_in_hold:
        reasons.append("must not run migrations during launch hold")
    if plan.destructive:
        if not plan.backup_taken:
            reasons.append("destructive migration requires a restorable backup first")
        if not plan.reversible:
            reasons.append("destructive migration must be reversible")
        if not plan.approved_by:
            reasons.append("destructive migration requires a named approver")
        elif plan.approved_by.strip().lower() in AGENT_IDENTITIES:
            reasons.append("the agent may not self-approve a destructive migration")
    return (not reasons, tuple(reasons))


def assert_migration_safe(plan: MigrationPlan) -> None:
    ok, reasons = migration_is_safe(plan)
    if not ok:
        raise MigrationUnsafe("; ".join(reasons))


# ── Clinical delete policy ───────────────────────────────────────────────────

# Tables whose rows are clinical records and must be retained (soft-delete /
# retention), never hard-deleted by a parent cascade.
CLINICAL_RECORD_TABLES = frozenset({
    "consultation_notes", "prescriptions", "referrals", "consultation_messages",
    "device_readings", "clinical_care_tasks", "teleconsultation_sessions",
    "consultations", "triage_sessions", "health_audit_logs",
})


def clinical_delete_allowed(table: str, hard_delete: bool, retention_expired: bool,
                            approved_by: Optional[str]) -> bool:
    """A clinical record is never hard-deleted on demand: only after its retention
    has expired AND with a named approver. Non-clinical rows are unrestricted."""
    if table not in CLINICAL_RECORD_TABLES:
        return True
    if not hard_delete:
        return True                    # soft-delete/retain is always fine
    if not retention_expired:
        return False
    if not approved_by or approved_by.strip().lower() in AGENT_IDENTITIES:
        return False
    return True


def cascade_is_acceptable(table: str) -> bool:
    """An ON DELETE CASCADE that reaches a clinical-record table is NOT acceptable
    (it would silently erase a legal record when a parent is removed)."""
    return table not in CLINICAL_RECORD_TABLES


# ── Backup / restore policy ──────────────────────────────────────────────────

@dataclass(frozen=True)
class BackupPolicy:
    encrypted_at_rest: bool = False
    offsite_copy: bool = False
    restore_tested: bool = False         # a restore has actually been exercised
    rpo_seconds: Optional[int] = None    # max acceptable data loss
    rto_seconds: Optional[int] = None    # max acceptable downtime
    pitr_enabled: bool = False           # point-in-time recovery


def backup_policy_ok(p: BackupPolicy) -> tuple[bool, tuple]:
    reasons: list[str] = []
    if not p.encrypted_at_rest:
        reasons.append("backups must be encrypted at rest")
    if not p.offsite_copy:
        reasons.append("an offsite copy is required")
    if not p.restore_tested:
        reasons.append("restore must be tested, not assumed")
    if p.rpo_seconds is None or p.rto_seconds is None:
        reasons.append("RPO and RTO must be set by a named owner")
    return (not reasons, tuple(reasons))


# ── Required integrity constraints (checklist as data) ───────────────────────

REQUIRED_CONSTRAINTS = (
    "foreign keys on every cross-entity reference",
    "not-null on patient/clinician/consultation identifiers",
    "unique idempotency keys where side effects occur",
    "check constraints on enumerated states",
    "no ON DELETE CASCADE reaching a clinical-record table",
    "a single Alembic head",
)

# What the release board must see before the data tier is 'ready'.
DATA_TIER_EVIDENCE_REQUIRED = (
    "single_alembic_head_proof",
    "tested_restore_evidence",
    "backup_encryption_and_region",
    "clinical_cascade_review_signed",
    "rpo_rto_targets_approved",
)
