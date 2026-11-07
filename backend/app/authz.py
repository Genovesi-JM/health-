"""Server-owned authorization policy boundary (Phase 14). Domain-pure and
importable without the app: one `can_access` decision function used by REST
routes, background jobs, signed URLs, exports, search, dashboards, and mobile
endpoints.

**Default deny.** Health access is scoped by organization, assigned care team or
episode, profession, granted privilege, purpose, record type, resource status,
and time — a role alone, or the mere existence of a consultation, is never
sufficient. Support never sees clinical content or credential decisions.
Employers receive only aggregate data, never individual health records.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


CLINICAL_TYPES = frozenset({
    "clinical_record", "triage", "prescription", "photo", "document",
    "reading", "message", "consultation", "care_episode", "note",
})
CREDENTIAL_TYPES = frozenset({"credential", "credential_evidence", "privileging"})


@dataclass
class Actor:
    id: str
    role: str
    org_ids: frozenset = field(default_factory=frozenset)
    care_team_episode_ids: frozenset = field(default_factory=frozenset)  # assigned episodes
    privileges: frozenset = field(default_factory=frozenset)             # granted clinical privileges
    represented_ids: frozenset = field(default_factory=frozenset)        # caregiver's dependants
    profession: Optional[str] = None
    suspended: bool = False


@dataclass
class Resource:
    type: str
    owner_id: Optional[str] = None      # subject the data is about
    org_id: Optional[str] = None
    episode_id: Optional[str] = None
    status: str = "active"              # active | archived | suspended | deleted
    classification: str = "HEALTH"


@dataclass
class Decision:
    allow: bool
    reason: str

    def __bool__(self) -> bool:
        return self.allow


DENY = lambda reason: Decision(False, reason)  # noqa: E731
ALLOW = lambda reason: Decision(True, reason)   # noqa: E731


def _is_clinical(resource: Resource) -> bool:
    return resource.type in CLINICAL_TYPES or resource.classification == "HEALTH"


def can_access(actor: Actor, resource: Resource, purpose: str,
               now: Optional[datetime] = None) -> Decision:
    """Default-deny authorization decision. Returns Decision(allow, reason)."""
    role = (actor.role or "").strip().lower()

    # Global hard denies.
    if actor.suspended:
        return DENY("actor suspended")
    if resource.status in ("suspended", "deleted"):
        return DENY(f"resource status {resource.status}")

    # Support and unrelated ops staff: never clinical content or credential decisions.
    if role == "support":
        if _is_clinical(resource) or resource.type in CREDENTIAL_TYPES:
            return DENY("support cannot access clinical or credential data")
        return DENY("support has no default resource access")  # default deny

    # Employer / corporate: aggregate only, never an individual clinical record.
    if role in ("corporate_admin", "employer"):
        if resource.type == "aggregate_report" and purpose == "occupational_health":
            return ALLOW("employer aggregate report")
        return DENY("employer receives aggregate only, never individual clinical data")

    # Compliance reviewer: credentialing only, not clinical records.
    if role == "compliance_reviewer":
        if resource.type in CREDENTIAL_TYPES and purpose == "credentialing":
            return ALLOW("reviewer credentialing scope")
        return DENY("reviewer limited to credentialing")

    # Patient: own data only, for care/self purposes.
    if role in ("patient", "cliente"):
        if resource.owner_id == actor.id and purpose in ("care", "self_view", "data_rights"):
            return ALLOW("patient own record")
        return DENY("patient may access only own record")

    # Caregiver: authorized dependants only.
    if role == "caregiver":
        if resource.owner_id in actor.represented_ids and purpose in ("care", "self_view"):
            return ALLOW("caregiver authorized dependant")
        return DENY("caregiver not authorized for this subject")

    # Clinicians: org membership + assignment + verified privilege + purpose + time.
    if role in ("doctor", "nurse", "pharmacist"):
        if resource.org_id is None or resource.org_id not in actor.org_ids:
            return DENY("clinician not a member of the resource organization")
        if _is_clinical(resource):
            if resource.episode_id is None or resource.episode_id not in actor.care_team_episode_ids:
                return DENY("clinician not assigned to this episode/care team")
            if "clinical_read" not in actor.privileges and "clinical_write" not in actor.privileges:
                return DENY("clinician lacks a granted clinical privilege")
            if role == "pharmacist" and resource.type not in ("prescription",):
                return DENY("pharmacist limited to prescriptions")
            if purpose not in ("care", "handoff", "documentation"):
                return DENY("purpose not permitted for clinical access")
            return ALLOW("assigned clinician within privilege and purpose")
        return DENY("no default non-clinical access")

    # Platform admin: administration, NOT clinical content by default.
    if role == "admin":
        if _is_clinical(resource):
            return DENY("admin has no default clinical access (requires accepted break-glass)")
        if resource.type in ("platform_config", "audit_log", "user_admin"):
            return ALLOW("platform administration scope")
        return DENY("admin default deny for this resource")

    # Unmapped role / service identity: default deny.
    return DENY("default deny: no matching policy grant")


# Break-glass exists only if the clinical owner has accepted it (config, not code).
def break_glass_allowed(clinical_owner_accepted: bool) -> bool:
    return bool(clinical_owner_accepted)


# Access that must be audited (reads/downloads/exports/shares/break-glass, not
# only writes).
def is_auditable_access(resource: Resource, action: str) -> bool:
    return _is_clinical(resource) or action in ("download", "export", "share", "break_glass")


# Employer aggregate: minimum cohort size to resist re-identification.
MIN_AGGREGATE_COHORT = 10


def aggregate_release_allowed(cohort_size: int) -> bool:
    return cohort_size >= MIN_AGGREGATE_COHORT


# The documented permission matrix (roles → allowed resource families).
PERMISSION_MATRIX = {
    "patient": ["own record (care/self/data-rights)"],
    "caregiver": ["authorized dependant record"],
    "doctor": ["assigned-episode clinical, with privilege + purpose"],
    "nurse": ["assigned-episode clinical, with privilege + purpose"],
    "pharmacist": ["assigned-episode prescriptions only"],
    "compliance_reviewer": ["credentialing only"],
    "corporate_admin": ["aggregate occupational-health report only"],
    "support": ["no clinical, no credential; explicit non-clinical grants only"],
    "admin": ["platform config/audit/user-admin; no clinical without break-glass"],
    "service": ["default deny; explicit grants only"],
}
