"""Prescribing safety and controlled-substance guardrails (Phase 27). Domain-pure.

A prescription cannot be issued unsafely. Issuance is fail-closed: it proceeds
only when a prescriber with the right authority, in an active clinical
relationship, has passed every required safety screen with no blocking finding,
and — for controlled substances — additional restrictions hold. Missing screen
inputs are treated as UNKNOWN and BLOCK; they never pass silently.

IMPORTANT — NOT CLINICALLY VALIDATED. The interaction, dose, pregnancy, and
schedule tables below are small ILLUSTRATIVE placeholders that encode the
*mechanism* of the guardrail, not a validated clinical knowledge base. Before any
real use a NAMED clinical/pharmacology owner must replace them with a licensed,
maintained drug-safety source (e.g. an interaction/allergy/dose service) and sign
off. This module must never be described as clinically validated.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Optional

# ── Errors ───────────────────────────────────────────────────────────────────

class PrescribingError(Exception):
    """A prescribing-safety rule was violated (fail-closed)."""


class PrescriptionImmutableError(PrescribingError):
    """An issued prescription cannot be edited; cancel and re-issue."""


# ── Reference tables (ILLUSTRATIVE — not clinically validated) ────────────────

# Contraindicated / major class-level interactions (unordered pairs).
_MAJOR_INTERACTIONS: frozenset = frozenset({
    frozenset({"maoi", "ssri"}),                 # serotonin syndrome
    frozenset({"nitrate", "pde5_inhibitor"}),    # severe hypotension
    frozenset({"anticoagulant", "nsaid"}),       # bleeding
})

# Absolute allergy/contra pairs that can NEVER be overridden.
_NEVER_OVERRIDE_INTERACTIONS: frozenset = frozenset({
    frozenset({"maoi", "ssri"}),
})

# Per-drug dose ceilings (single dose mg, daily mg). Illustrative.
_DOSE_LIMITS: dict = {
    "paracetamol": (1000, 4000),
    "ibuprofen": (800, 3200),
    "amoxicillin": (1000, 3000),
}

# Drug classes contraindicated in pregnancy. Illustrative.
_PREGNANCY_CONTRA: frozenset = frozenset({"retinoid", "ace_inhibitor", "teratogen"})

# Classes needing renal caution. Illustrative.
_RENAL_CAUTION: frozenset = frozenset({"nsaid", "aminoglycoside"})


# ── Value objects ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class DrugOrder:
    name: str
    drug_classes: frozenset = frozenset()
    schedule: int = 0                 # 0 = non-controlled; 1..5 = controlled schedules
    dose_mg: float = 0.0              # per administration
    per_day: int = 1
    day_supply: int = 1
    quantity: int = 1
    weight_based: bool = False
    route: str = "oral"


@dataclass(frozen=True)
class PatientSafetyProfile:
    allergies: frozenset = frozenset()          # drug names and/or classes
    allergies_known: bool = False               # was an allergy history actually taken?
    current_med_classes: frozenset = frozenset()
    current_med_names: frozenset = frozenset()
    current_meds_known: bool = False            # was a current-medication list obtained?
    age_years: Optional[int] = None
    weight_kg: Optional[float] = None
    pregnant: Optional[bool] = None             # None = unknown
    renal_impairment: Optional[bool] = None     # None = unknown
    identity_verified: bool = False


@dataclass(frozen=True)
class PrescriberAuthority:
    is_clinician: bool = False
    prescribing_privilege: bool = False
    controlled_authority: bool = False          # registered to prescribe controlled drugs
    jurisdiction_ok: bool = False
    suspended: bool = True                       # safe default: suspended


@dataclass(frozen=True)
class ClinicalContext:
    active_consultation: bool = False
    relationship_established: bool = False


@dataclass(frozen=True)
class ScreenResult:
    blocks: tuple = ()          # hard stops
    warnings: tuple = ()        # advisory
    missing: tuple = ()         # required-but-unknown inputs (treated as blocks)
    overridable: tuple = ()     # which blocks a suitably-authorized prescriber MAY override

    @property
    def ok(self) -> bool:
        return not self.blocks and not self.missing


# ── Safety screening (fail-closed) ───────────────────────────────────────────

def screen(order: DrugOrder, profile: PatientSafetyProfile) -> ScreenResult:
    blocks: list[str] = []
    warnings: list[str] = []
    missing: list[str] = []
    overridable: list[str] = []

    # Required histories must actually have been taken.
    if not profile.allergies_known:
        missing.append("allergy history not taken")
    if not profile.current_meds_known:
        missing.append("current medication list not obtained")

    # Allergy — absolute, never overridable.
    if profile.allergies_known:
        if order.name in profile.allergies or (order.drug_classes & profile.allergies):
            blocks.append(f"allergy to {order.name} or its class")

    # Interactions vs current meds.
    if profile.current_meds_known:
        for cls in order.drug_classes:
            for cur in profile.current_med_classes:
                pair = frozenset({cls, cur})
                if pair in _MAJOR_INTERACTIONS:
                    label = f"major interaction: {cls}+{cur}"
                    blocks.append(label)
                    if pair not in _NEVER_OVERRIDE_INTERACTIONS:
                        overridable.append(label)
        # Duplicate therapy — same class already prescribed.
        dup = order.drug_classes & profile.current_med_classes
        if dup:
            warnings.append(f"duplicate therapy: {sorted(dup)}")

    # Dose bounds.
    limit = _DOSE_LIMITS.get(order.name)
    if limit is not None:
        max_single, max_daily = limit
        if order.dose_mg > max_single:
            blocks.append(f"dose {order.dose_mg}mg exceeds single-dose max {max_single}mg")
        if order.dose_mg * order.per_day > max_daily:
            blocks.append(f"daily dose exceeds max {max_daily}mg")

    # Weight-based drug requires a weight.
    if order.weight_based and profile.weight_kg is None:
        missing.append("weight required for weight-based dosing")

    # Pediatric safety — require explicit age.
    if profile.age_years is None:
        missing.append("patient age unknown")

    # Pregnancy contraindication.
    if profile.pregnant is None and (order.drug_classes & _PREGNANCY_CONTRA):
        missing.append("pregnancy status unknown for a teratogenic-class drug")
    elif profile.pregnant and (order.drug_classes & _PREGNANCY_CONTRA):
        blocks.append("contraindicated in pregnancy")   # not overridable

    # Renal caution.
    if profile.renal_impairment and (order.drug_classes & _RENAL_CAUTION):
        warnings.append("renal caution: adjust/monitor")

    return ScreenResult(tuple(blocks), tuple(warnings), tuple(missing), tuple(overridable))


# ── Controlled substances ────────────────────────────────────────────────────

def schedule_i_is_never_prescribable(order: DrugOrder) -> bool:
    return order.schedule == 1


def controlled_refills_allowed(schedule: int) -> int:
    """Illustrative: Schedule I none (never prescribable); II none; III-V limited."""
    if schedule <= 1:
        return 0
    if schedule == 2:
        return 0
    if schedule in (3, 4, 5):
        return 5
    return 12  # non-controlled default handled elsewhere


def controlled_ok(order: DrugOrder, prescriber: PrescriberAuthority,
                  profile: PatientSafetyProfile, max_day_supply: int = 30) -> list[str]:
    """Extra restrictions for controlled substances. Returns blocking reasons."""
    reasons: list[str] = []
    if order.schedule <= 0:
        return reasons  # not controlled
    if schedule_i_is_never_prescribable(order):
        reasons.append("Schedule I is never prescribable")
        return reasons
    if not prescriber.controlled_authority:
        reasons.append("prescriber lacks controlled-substance authority")
    if not profile.identity_verified:
        reasons.append("patient identity must be verified for a controlled substance")
    if order.day_supply > max_day_supply:
        reasons.append(f"day supply {order.day_supply} exceeds controlled limit {max_day_supply}")
    return reasons


# ── Authority + relationship ─────────────────────────────────────────────────

def prescriber_can_prescribe(prescriber: PrescriberAuthority) -> bool:
    return (
        prescriber.is_clinician
        and prescriber.prescribing_privilege
        and prescriber.jurisdiction_ok
        and not prescriber.suspended
    )


def relationship_ok(ctx: ClinicalContext) -> bool:
    """No prescribing without an active consultation and an established
    clinician-patient relationship."""
    return ctx.active_consultation and ctx.relationship_established


# ── Composite issuance decision (fail-closed) ────────────────────────────────

@dataclass(frozen=True)
class IssuanceDecision:
    allowed: bool
    reasons: tuple = ()


def can_issue(order: DrugOrder, prescriber: PrescriberAuthority,
              profile: PatientSafetyProfile, ctx: ClinicalContext,
              override_reason: Optional[str] = None) -> IssuanceDecision:
    """The single fail-closed gate. Denies unless authority, relationship, and a
    clean screen (or a validly-overridden overridable block) all hold, plus any
    controlled-substance restrictions."""
    reasons: list[str] = []

    if not prescriber_can_prescribe(prescriber):
        reasons.append("prescriber not authorized")
    if not relationship_ok(ctx):
        reasons.append("no active consultation / relationship")

    sr = screen(order, profile)
    if sr.missing:
        reasons.extend(f"missing: {m}" for m in sr.missing)

    # Blocks: overridable ones may be cleared only by an authorized prescriber
    # with a documented reason; allergy / pregnancy / schedule-I style blocks are
    # never in `overridable` and therefore always stand.
    hard_blocks = [b for b in sr.blocks if b not in sr.overridable]
    reasons.extend(hard_blocks)
    if sr.overridable:
        if not override_reason or not override_reason.strip():
            reasons.extend(f"override required: {b}" for b in sr.overridable)
        elif not (prescriber.is_clinician and prescriber.prescribing_privilege):
            reasons.extend(f"override not authorized: {b}" for b in sr.overridable)
        # else: documented override by an authorized prescriber clears them.

    reasons.extend(controlled_ok(order, prescriber, profile))

    return IssuanceDecision(allowed=not reasons, reasons=tuple(reasons))


# ── Immutable issued prescription ────────────────────────────────────────────

def _rx_hash(payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class IssuedPrescription:
    rx_id: str
    order: DrugOrder
    prescriber_id: str
    consultation_id: str
    issued_at_epoch: int
    refills_authorized: int
    rx_hash: str = ""


def issue(order: DrugOrder, prescriber_id: str, consultation_id: str,
          now_epoch: int, refills_authorized: int, rx_id: str) -> IssuedPrescription:
    """Materialize an immutable prescription record with a content hash. Refills
    are clamped to the controlled-substance ceiling."""
    max_refills = controlled_refills_allowed(order.schedule) if order.schedule > 0 else refills_authorized
    refills = min(refills_authorized, max_refills)
    payload = {
        "rx_id": rx_id, "name": order.name, "schedule": order.schedule,
        "dose_mg": order.dose_mg, "per_day": order.per_day,
        "day_supply": order.day_supply, "quantity": order.quantity,
        "prescriber_id": prescriber_id, "consultation_id": consultation_id,
        "issued_at_epoch": now_epoch, "refills": refills,
    }
    return IssuedPrescription(
        rx_id=rx_id, order=order, prescriber_id=prescriber_id,
        consultation_id=consultation_id, issued_at_epoch=now_epoch,
        refills_authorized=refills, rx_hash=_rx_hash(payload),
    )


def edit_prohibited(rx: IssuedPrescription) -> None:
    raise PrescriptionImmutableError("issued prescriptions are immutable; cancel and re-issue")
