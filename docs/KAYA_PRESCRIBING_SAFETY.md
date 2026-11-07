# Kaya prescribing safety & controlled-substance guardrails (Phase 27)

A prescription cannot be issued unsafely. Issuance is **fail-closed**
(`backend/app/prescribing_safety.py`, domain-pure): it proceeds only when a
prescriber with the right authority, in an active clinical relationship, has
passed every required safety screen with no blocking finding, and — for
controlled substances — additional restrictions hold.

> **NOT CLINICALLY VALIDATED.** The interaction, dose, pregnancy, and schedule
> tables are small **illustrative placeholders** that encode the guardrail
> *mechanism*, not a validated clinical knowledge base. A named clinical/
> pharmacology owner must replace them with a licensed, maintained drug-safety
> source and sign off before any real use. This module is never described as
> clinically validated.

## Invariants enforced

- **Prescriber authority.** `prescriber_can_prescribe` requires a clinician with
  prescribing privilege, in-jurisdiction, not suspended (suspended is the safe
  default). Controlled substances additionally require registered
  controlled-substance authority.
- **Active relationship.** No prescribing without an active consultation and an
  established clinician–patient relationship.
- **Unknown inputs BLOCK.** Missing allergy history, missing current-medication
  list, unknown age, missing weight for weight-based dosing, or unknown pregnancy
  status for a teratogenic-class drug are treated as UNKNOWN and block issuance —
  they never pass silently.
- **Allergy is absolute.** An allergy to the drug or its class blocks and is never
  overridable.
- **Interactions.** Class-level major interactions block; a documented override by
  an authorized prescriber can clear an *overridable* block, but
  never-override pairs (e.g. MAOI+SSRI) and allergy/pregnancy blocks always stand.
- **Duplicate therapy** is flagged; **dose bounds** (single and daily) block when
  exceeded; **renal caution** warns.
- **Controlled substances.** Schedule I is never prescribable; controlled drugs
  require controlled authority, verified patient identity, and a bounded day
  supply; refill ceilings are enforced (Schedule II → 0, III–V → limited) and
  `issue` clamps refills to the ceiling.
- **Immutable issued prescriptions.** `issue` materializes a hashed, immutable
  record; `edit_prohibited` raises — changes are cancel-and-re-issue, never a
  silent edit.

## Tests — `backend/phase27_tests/test_prescribing_safety.py` (22, all passing)

Clean-path allow; suspended/no-privilege/no-relationship deny; unknown
allergy/med-list/age/weight block; allergy by name and class block and are not
overridable; overridable major interaction needs a documented override;
never-override interaction stays blocked; pregnancy contra blocks (and unknown
pregnancy for a teratogen blocks); single- and daily-dose ceilings block;
Schedule I never prescribable; controlled requires authority + identity + bounded
day supply; refill ceilings; issued prescription immutable and hashed; refills
clamped for Schedule II.

## Human intervention / external gates

- **Licensed drug-safety knowledge base (owner-bound).** A named clinical/
  pharmacology owner must supply and sign off a validated interaction/allergy/
  dose/pregnancy/controlled-schedule source; the illustrative tables here must not
  reach patients.
- **Controlled-substance regulatory mapping.** The controlled schedules, day-supply
  limits, refill rules, identity requirements, and prescriber-registration model
  must be mapped to the operating jurisdiction (Angola / target) by a named legal
  + clinical owner.
- **ORM adoption.** The live `Prescription` model is a free-text `medications_json`
  blob with `ondelete=CASCADE` and no screening; adopting this policy (structured
  orders, screening gate, immutability) is an owner-approved migration. No live DB
  migrated here.
- **Runtime adoption verification** — a harness-verified task must confirm the held
  prescribing endpoints consume `can_issue` before any real issuance.
- **Clinical release stays HOLD.**
