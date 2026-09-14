"""Data-processing agreements and records of processing (Phase 39). Domain-pure.

Privacy governance-as-code for a health data controller: every processing purpose
has a lawful basis and a retention period (a Record of Processing Activities), each
sub-processor is covered by a DPA, cross-border transfers have a legal basis,
data-subject requests are handled within statutory deadlines (with clinical
retention overriding erasure), and a personal-data breach triggers notification.

The lawful-basis taxonomy is modeled on GDPR/Angola APD-style regimes; the exact
statutory mapping and every approval are owner-bound. Stdlib-only.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# ── Lawful basis ─────────────────────────────────────────────────────────────

LAWFUL_BASES = frozenset({
    "consent", "contract", "legal_obligation", "vital_interests",
    "public_task", "legitimate_interests",
})
# Special-category (health) data needs an additional condition.
SPECIAL_CATEGORY_CONDITIONS = frozenset({
    "explicit_consent", "health_care_provision", "public_health", "vital_interests",
})


@dataclass(frozen=True)
class ProcessingActivity:
    purpose: str
    lawful_basis: str
    data_categories: frozenset          # e.g. {"identity","health"}
    retention_days: Optional[int]
    recipients: frozenset = frozenset()
    transfer_countries: frozenset = frozenset()
    special_category_condition: Optional[str] = None


def ropa_entry_valid(a: ProcessingActivity) -> tuple[bool, tuple]:
    """A ROPA entry is valid only with a named purpose, a recognized lawful basis,
    a retention period, and — for health/special-category data — an appropriate
    additional condition."""
    reasons: list[str] = []
    if not a.purpose or not a.purpose.strip():
        reasons.append("purpose required")
    if a.lawful_basis not in LAWFUL_BASES:
        reasons.append(f"unknown lawful basis: {a.lawful_basis}")
    if a.retention_days is None or a.retention_days <= 0:
        reasons.append("a retention period is required (no indefinite retention)")
    if "health" in a.data_categories:
        if a.special_category_condition not in SPECIAL_CATEGORY_CONDITIONS:
            reasons.append("health data needs a special-category condition")
    return (not reasons, tuple(reasons))


# ── Sub-processors ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class SubProcessor:
    name: str
    purpose: str
    dpa_signed: bool = False
    country: str = ""


def subprocessor_allowed(sp: SubProcessor) -> bool:
    """A sub-processor may process personal data only under a signed DPA."""
    return bool(sp.name) and sp.dpa_signed


# ── Cross-border transfers ───────────────────────────────────────────────────

# Countries with an adequacy decision (illustrative; owner sets the real list).
ADEQUATE_COUNTRIES = frozenset()      # empty by default → nothing is assumed adequate
VALID_TRANSFER_MECHANISMS = frozenset({"adequacy", "scc", "bcr", "explicit_consent"})


def transfer_allowed(destination_country: str, home_country: str,
                     mechanism: Optional[str]) -> bool:
    """A cross-border transfer needs a valid mechanism; default deny. A domestic
    transfer is allowed."""
    if not destination_country or destination_country == home_country:
        return True
    if destination_country in ADEQUATE_COUNTRIES:
        return True
    return mechanism in VALID_TRANSFER_MECHANISMS and mechanism is not None


# ── Data-subject requests (DSAR) ─────────────────────────────────────────────

DSAR_TYPES = frozenset({
    "access", "rectification", "erasure", "portability", "restriction", "objection",
})
DSAR_DEADLINE_DAYS = 30


def dsar_deadline_days(request_type: str) -> int:
    if request_type not in DSAR_TYPES:
        raise ValueError(f"unknown DSAR type: {request_type}")
    return DSAR_DEADLINE_DAYS


def erasure_allowed(is_clinical_record: bool, clinical_retention_active: bool,
                    legal_hold: bool) -> bool:
    """Erasure ('right to be forgotten') does not override a clinical-record
    retention obligation or a legal hold — those keep the record."""
    if legal_hold:
        return False
    if is_clinical_record and clinical_retention_active:
        return False
    return True


# ── Breach notification ──────────────────────────────────────────────────────

BREACH_NOTIFICATION_DEADLINE_HOURS = 72


def breach_notification_required(involves_personal_data: bool,
                                 likely_risk_to_individuals: bool) -> bool:
    """A personal-data breach that is likely to risk individuals must be notified
    to the authority (and possibly the individuals)."""
    return involves_personal_data and likely_risk_to_individuals


def breach_deadline_hours() -> int:
    return BREACH_NOTIFICATION_DEADLINE_HOURS


# What the release board must see for the data-governance tier.
DATA_GOVERNANCE_EVIDENCE_REQUIRED = (
    "complete_ropa",
    "signed_subprocessor_dpas",
    "transfer_mechanism_per_destination",
    "dsar_workflow_and_sla",
    "breach_response_runbook",
    "retention_schedule_per_purpose",
)
