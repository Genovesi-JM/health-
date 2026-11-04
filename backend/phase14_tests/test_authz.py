"""Phase 14 authorization: default-deny scope by org/episode/role/privilege/
purpose/status. Cross-tenant, cross-episode, role-confusion, object-ID
tampering, suspended-user, support, and employer negatives.
"""
from __future__ import annotations

from app.authz import (
    Actor, Resource, can_access, is_auditable_access, aggregate_release_allowed,
    break_glass_allowed, PERMISSION_MATRIX,
)


def _clin(**kw):
    base = dict(type="clinical_record", owner_id="pat-1", org_id="org-1",
                episode_id="ep-1", status="active", classification="HEALTH")
    base.update(kw)
    return Resource(**base)


# ── Default deny ─────────────────────────────────────────────────────────────

def test_unmapped_role_is_denied():
    a = Actor(id="x", role="wizard")
    assert not can_access(a, _clin(), "care")


def test_service_identity_default_deny():
    assert not can_access(Actor(id="svc", role="service"), _clin(), "care")


# ── Clinician scope ──────────────────────────────────────────────────────────

def _assigned_doctor():
    return Actor(id="doc-1", role="doctor", org_ids=frozenset({"org-1"}),
                 care_team_episode_ids=frozenset({"ep-1"}),
                 privileges=frozenset({"clinical_read"}))


def test_assigned_clinician_allowed():
    assert can_access(_assigned_doctor(), _clin(), "care")


def test_cross_tenant_denied():
    d = _assigned_doctor()
    assert not can_access(d, _clin(org_id="org-2"), "care")


def test_cross_episode_denied():
    d = _assigned_doctor()
    assert not can_access(d, _clin(episode_id="ep-9"), "care")


def test_clinician_without_privilege_denied():
    d = Actor(id="doc-1", role="doctor", org_ids=frozenset({"org-1"}),
              care_team_episode_ids=frozenset({"ep-1"}), privileges=frozenset())
    assert not can_access(d, _clin(), "care")


def test_clinician_wrong_purpose_denied():
    assert not can_access(_assigned_doctor(), _clin(), "marketing")


def test_pharmacist_limited_to_prescriptions():
    ph = Actor(id="ph", role="pharmacist", org_ids=frozenset({"org-1"}),
               care_team_episode_ids=frozenset({"ep-1"}), privileges=frozenset({"clinical_read"}))
    assert not can_access(ph, _clin(type="clinical_record"), "care")
    assert can_access(ph, _clin(type="prescription"), "care")


# ── Patient / caregiver ──────────────────────────────────────────────────────

def test_patient_own_record_only():
    p = Actor(id="pat-1", role="patient")
    assert can_access(p, _clin(owner_id="pat-1"), "care")
    assert not can_access(p, _clin(owner_id="pat-2"), "care")  # object-ID tampering


def test_caregiver_authorized_dependant_only():
    c = Actor(id="cg", role="caregiver", represented_ids=frozenset({"pat-1"}))
    assert can_access(c, _clin(owner_id="pat-1"), "care")
    assert not can_access(c, _clin(owner_id="pat-9"), "care")


# ── Support / employer / admin / reviewer ────────────────────────────────────

def test_support_never_clinical_or_credential():
    s = Actor(id="s", role="support")
    assert not can_access(s, _clin(), "care")
    assert not can_access(s, Resource(type="credential", org_id="org-1"), "credentialing")


def test_employer_aggregate_only():
    e = Actor(id="e", role="corporate_admin")
    assert not can_access(e, _clin(), "occupational_health")
    assert can_access(e, Resource(type="aggregate_report", classification="INTERNAL"), "occupational_health")


def test_admin_no_clinical_without_break_glass():
    a = Actor(id="a", role="admin")
    assert not can_access(a, _clin(), "care")
    assert can_access(a, Resource(type="platform_config", classification="INTERNAL"), "admin")


def test_reviewer_credentialing_only():
    r = Actor(id="r", role="compliance_reviewer")
    assert can_access(r, Resource(type="credential", org_id="org-1"), "credentialing")
    assert not can_access(r, _clin(), "care")


# ── Suspension / status ──────────────────────────────────────────────────────

def test_suspended_actor_denied():
    d = _assigned_doctor()
    d.suspended = True
    assert not can_access(d, _clin(), "care")


def test_deleted_resource_denied():
    assert not can_access(_assigned_doctor(), _clin(status="deleted"), "care")


# ── Audit / aggregate / break-glass ──────────────────────────────────────────

def test_clinical_reads_are_auditable():
    assert is_auditable_access(_clin(), "read")
    assert is_auditable_access(Resource(type="document", classification="INTERNAL"), "export")


def test_aggregate_min_cohort():
    assert not aggregate_release_allowed(3)
    assert aggregate_release_allowed(10)


def test_break_glass_requires_owner_acceptance():
    assert not break_glass_allowed(False)
    assert break_glass_allowed(True)


def test_permission_matrix_documents_all_roles():
    for role in ("patient", "doctor", "support", "admin", "corporate_admin", "service"):
        assert role in PERMISSION_MATRIX
