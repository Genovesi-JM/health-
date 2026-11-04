# Kaya governance model (Phase 2)

Evidence date 14 September 2026. This document is the human-readable governance
model. The **machine-checkable source of truth** is
[`backend/app/kaya_governance.json`](../backend/app/kaya_governance.json),
enforced by [`backend/app/governance.py`](../backend/app/governance.py) and
proven by [`backend/governance_tests/`](../backend/governance_tests/) (35 tests).
Where this prose and the policy/code disagree, the policy and its tests govern.

**A code commit alone can never represent a clinical, legal, privacy, security,
accessibility, or operational approval.** The coding agent is a *preparer only*
and is approval-prohibited in code (`engineering_preparer.approval_prohibited =
true`, enforced in `governance_self_check`, `validate_risk_acceptance`, and
`required_reviewers`).

## 1. Accountability (RACI)

No person is named or has accepted authority; these are proposed accountable
roles awaiting external appointment (see [KAYA_HUMAN_GATES.md](KAYA_HUMAN_GATES.md)).

| Function | Accountable (A) | Responsible (R) | Consulted (C) |
| --- | --- | --- | --- |
| Product perimeter & pilot scope | product_owner | product_owner | clinical_safety_lead, privacy_dpo |
| Clinical safety | clinical_safety_lead | clinical_safety_lead | medical_director |
| Medical direction / clinical ownership | medical_director | medical_director | clinical_safety_lead |
| Privacy, lawful basis, consent, transfers | privacy_dpo | privacy_dpo | security_lead |
| Information security & authorization | security_lead | security_lead | privacy_dpo, credentialing_authority |
| Credentialing & clinical privileges | credentialing_authority | credentialing_authority | security_lead, medical_director |
| Operations & monitoring | operations_owner | operations_owner | incident_commander |
| Support & complaints | support_owner | support_owner | operations_owner |
| Accessibility | accessibility_reviewer | accessibility_reviewer | product_owner |
| Commercial & finance | finance_owner | finance_owner | product_owner |
| Incident command | incident_commander | incident_commander | operations_owner, clinical_safety_lead |
| Release authority | release_board | release_board | clinical_safety_lead, privacy_dpo, security_lead |

Every function is *Informed* to the release_board. The release_board is a
distinct role from every preparer, reviewer, and operator.

## 2. Separation of duties

Preparer, reviewer, approver, and operator are distinct
(`separation_of_duties.preparer_reviewer_approver_operator_distinct = true`).

- The coding agent (`engineering_preparer`) prepares evidence and code; it may
  **never** approve, accept risk, or self-sign readiness.
- High-impact risk (residual severity **P0/P1**) requires an approver who is not
  the change author. Enforced in `validate_risk_acceptance`.
- The gate approver's role must own the gate; a wrong-authority approval fails
  closed. Enforced in `release_decision`.

## 3. Risk & hazard taxonomy

**Severity.** P0 catastrophic (death, serious harm, unlawful health-data
exposure, false clinical reassurance — *fails closed, stops release*); P1
critical; P2 moderate; P3 low. **Likelihood** L4 expected → L1 rare.

**P0 stop conditions** (any one returns `STOP` / blocks release; see policy
`risk_taxonomy.p0_stop_conditions`): incomplete-input triage reaching
LOW/SELF_CARE; unsupported emergency/outcome claims; any real patient/clinician
data in the repo; a reachable external processor without a disabled boundary and
dated approval; public self-assignment of clinical/admin privilege; fabricated or
non-functional emergency instructions.

**Residual-risk acceptance** is explicit, expiring, and attributable. Required
fields (`risk_taxonomy.acceptance_required_fields`): `risk_id`,
`residual_severity`, `accepted_by_role`, `accepted_by_person`, `rationale`,
`decision_date`, `expiry_date`, `evidence_link`, `change_author`. **P0 is never
acceptable** (`p0_acceptance_prohibited = true`) — it must be closed. Acceptance
that is missing a field, expired, dated in the future, self-approved for
high-impact, or attributed to the coding agent is rejected.

## 4. Change control

Every category requires a distinct human approver who is neither the preparer nor
a prohibited party. `required_reviewers(category)` fails closed on an unknown
category rather than defaulting to "no review".

| Change category | Required reviewers | Required approver |
| --- | --- | --- |
| clinical_rules | clinical_safety_lead | medical_director |
| legal_copy | privacy_dpo | product_owner |
| consent_documents | privacy_dpo, clinical_safety_lead | privacy_dpo |
| authorization_policy | security_lead | security_lead |
| providers | security_lead, privacy_dpo | operations_owner |
| infrastructure | security_lead | operations_owner |
| emergency_information | clinical_safety_lead, privacy_dpo | medical_director |

## 5. Release board

`release_decision(submission)` returns one of **GO, LIMITED_GO, HOLD, STOP** and
**defaults to HOLD**. It never lets missing evidence default to approval.

- **STOP** — any open P0.
- **HOLD** (fail closed) — a missing gate, missing/expired/contradictory
  evidence, environment mismatch, unknown status, wrong-authority approval, a
  rejected gate, or an approval evidenced only by a commit hash with no named
  human approver.
- **GO** — every one of the 11 gates is `APPROVED` (or `NOT_APPLICABLE`) with a
  named human approver of the correct role, a non-commit evidence link, an
  unexpired expiry, and a matching environment, with no open P0.
- **LIMITED_GO** — the GO conditions plus an explicit bounded `limited_scope`.

The 11 gates and their owners are the canonical launch gates in
[KAYA_HUMAN_GATES.md](KAYA_HUMAN_GATES.md): jurisdiction_and_intended_use,
clinical_safety, licensed_operation, privacy_and_legal, security, credentialing,
accessibility, operations_and_support, infrastructure_and_recovery, commercial,
pilot_release.

## 6. Decision & evidence index

The append-only index (`EvidenceIndex`, and
[KAYA_DECISION_EVIDENCE_INDEX.md](KAYA_DECISION_EVIDENCE_INDEX.md)) ties
requirement → code → test → build digest → environment → reviewer → decision
date → supersession. Existing records are immutable; a change is a new
superseding append (`verify_append_only` rejects any rewrite or shrink). Records
carrying secret or health-data markers are rejected.

## 7. What Phase 2 does and does not do

Phase 2 builds the governance and evidence *machinery*. It does **not** name any
human owner, close any launch gate, or approve any release — those remain
external, human, and launch-blocking (`BLOCKED_EXTERNAL`). Clinical release
remains **HOLD**.
