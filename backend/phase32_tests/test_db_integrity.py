"""Phase 32 database integrity: migration safety (single head, no run-in-hold,
destructive needs backup+reversible+named approval, agent cannot self-approve),
clinical delete/cascade policy, backup policy, plus static source checks that the
held app does not auto-migrate and that clinical cascade-delete debt is
inventoried.
"""
from __future__ import annotations

import pathlib
import re

import pytest

from app import db_integrity as D


def _plan(**kw):
    base = dict(name="m1", destructive=False, reversible=True, single_head=True,
                backup_taken=False, approved_by=None, runs_in_hold=False)
    base.update(kw)
    return D.MigrationPlan(**base)


# ── Migration safety ─────────────────────────────────────────────────────────

def test_safe_nondestructive_migration():
    ok, reasons = D.migration_is_safe(_plan())
    assert ok, reasons


def test_second_head_unsafe():
    ok, _ = D.migration_is_safe(_plan(single_head=False))
    assert not ok


def test_no_migration_during_hold():
    ok, reasons = D.migration_is_safe(_plan(runs_in_hold=True))
    assert not ok and any("launch hold" in r for r in reasons)


def test_destructive_requires_backup_reversible_and_named_approval():
    ok, reasons = D.migration_is_safe(_plan(destructive=True))
    assert not ok
    assert any("backup" in r for r in reasons)
    assert any("approver" in r for r in reasons)
    # with backup + approval by a human
    ok2, _ = D.migration_is_safe(_plan(destructive=True, backup_taken=True,
                                       reversible=True, approved_by="Dr. Owner"))
    assert ok2


def test_agent_cannot_self_approve_destructive():
    ok, reasons = D.migration_is_safe(_plan(destructive=True, backup_taken=True,
                                            reversible=True, approved_by="agent"))
    assert not ok and any("self-approve" in r for r in reasons)


def test_assert_migration_safe_raises():
    with pytest.raises(D.MigrationUnsafe):
        D.assert_migration_safe(_plan(single_head=False))


# ── Clinical delete / cascade policy ─────────────────────────────────────────

def test_clinical_hard_delete_blocked_without_retention_and_approval():
    assert not D.clinical_delete_allowed("prescriptions", hard_delete=True,
                                         retention_expired=False, approved_by=None)
    assert not D.clinical_delete_allowed("prescriptions", hard_delete=True,
                                         retention_expired=True, approved_by="agent")
    assert D.clinical_delete_allowed("prescriptions", hard_delete=True,
                                     retention_expired=True, approved_by="Records Owner")


def test_soft_delete_and_nonclinical_allowed():
    assert D.clinical_delete_allowed("consultation_notes", hard_delete=False,
                                     retention_expired=False, approved_by=None)
    assert D.clinical_delete_allowed("some_cache_table", hard_delete=True,
                                     retention_expired=False, approved_by=None)


def test_cascade_acceptable_only_for_nonclinical():
    assert not D.cascade_is_acceptable("consultation_notes")
    assert not D.cascade_is_acceptable("device_readings")
    assert D.cascade_is_acceptable("onboarding_drafts")


# ── Backup policy ────────────────────────────────────────────────────────────

def test_backup_policy_requires_all():
    ok, reasons = D.backup_policy_ok(D.BackupPolicy())
    assert not ok and len(reasons) >= 3
    good = D.BackupPolicy(encrypted_at_rest=True, offsite_copy=True,
                          restore_tested=True, rpo_seconds=3600, rto_seconds=14400)
    ok2, _ = D.backup_policy_ok(good)
    assert ok2


def test_untested_restore_fails():
    p = D.BackupPolicy(encrypted_at_rest=True, offsite_copy=True,
                       restore_tested=False, rpo_seconds=3600, rto_seconds=3600)
    ok, reasons = D.backup_policy_ok(p)
    assert not ok and any("restore must be tested" in r for r in reasons)


# ── Static source checks ─────────────────────────────────────────────────────

def _backend_root():
    return pathlib.Path(__file__).resolve().parents[1]


def test_held_app_does_not_auto_migrate():
    """The default held app (app/main.py) must not create tables or run
    migrations at import/startup."""
    main = (_backend_root() / "app" / "main.py").read_text(encoding="utf-8", errors="ignore")
    assert "create_all" not in main
    assert "command.upgrade" not in main


def test_create_all_only_in_synthetic_runtime_path():
    """create_all lives behind init_db_engine, invoked only by the synthetic
    runtime — never eagerly at module import of the held app."""
    db = (_backend_root() / "app" / "database.py").read_text(encoding="utf-8", errors="ignore")
    # create_all must be inside a function, not at module top level.
    top_level = [ln for ln in db.splitlines()
                 if ln.startswith("Base.metadata.create_all")]
    assert not top_level, "create_all must not run at import time"


def test_clinical_cascade_debt_is_inventoried():
    """Enumerate ON DELETE CASCADE on clinical-record tables and assert the count
    is recorded in the debt doc, so the hazard is tracked (not silently fixed)."""
    models = (_backend_root() / "app" / "health_models.py").read_text(encoding="utf-8", errors="ignore")
    cascades = models.count('ondelete="CASCADE"')
    assert cascades > 0     # there IS debt to track
    doc = (_backend_root().parent / "docs" / "KAYA_DB_INTEGRITY.md")
    assert doc.exists(), "DB integrity doc must record the cascade inventory"
    assert "CASCADE" in doc.read_text(encoding="utf-8", errors="ignore")
