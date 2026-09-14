# Kaya clinical content registry (Phase 11)

Evidence date 14 September 2026. Every rule set, questionnaire, threshold,
instruction, disclaimer, translation, protocol, and patient-facing recommendation
that carries clinical meaning is registered here with **version, author,
approver, effective dates, and rollback**. Clinical content **cannot change
without a versioned review and a linked validation set**. All items are **DRAFT /
unapproved**; none is approved by an engineer, and none is effective while the
[clinical safety case](KAYA_CLINICAL_SAFETY_CASE.md) is HOLD.

| Item | Type | Source | Version | Author | Approver | Effective | Rollback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Triage questionnaire | questionnaire | `app/services/triage_engine` | v0-draft | engineering (preparer) | (clinical safety owner) | — | prior git rev | DRAFT / unapproved |
| Triage thresholds / risk rules | threshold | `triage_engine` | v0-draft | engineering | (clinical safety owner) | — | prior git rev | DRAFT / unapproved |
| Emergency guidance copy | instruction | `translations.ts` (`urg.*`, `dash.urgent_desc`) | v1 (Phase 3 neutralized) | engineering | (clinical + language) | — | prior git rev | DRAFT / unapproved |
| Medical disclaimer | disclaimer | `MedicalDisclaimerPage.tsx` | v0-draft | placeholder | (counsel + clinical) | — | prior git rev | DRAFT / launch-blocking |
| Consent text | protocol | onboarding/consent | v0-draft | placeholder | (DPO + clinical) | — | prior git rev | DRAFT / unapproved |
| Prescribing copy | protocol | prescriptions | v0-draft | engineering | (medical director) | — | prior git rev | DRAFT / unapproved |
| Chronic-care tips | recommendation | `translations.ts` (`dash.chronic_*`) | v0-draft | engineering | (clinical) | — | prior git rev | DRAFT / unapproved |
| Multilingual clinical copy (pt/en/fr/es) | translation | `translations.ts` | v1 | engineering | (clinical + language per locale) | — | prior git rev | DRAFT / unapproved |

## Change control

A clinical-content change is a governed change (`clinical_rules` /
`emergency_information` category in [governance](KAYA_GOVERNANCE_MODEL.md)):
required reviewers and an approver who is the medical director / clinical safety
owner, plus a linked validation set. The coding agent may prepare a draft version
and its validation harness, never approve it. Every change appends a new version
row (append-only); the prior version's git revision is the rollback.

## Effective-date rule

No item has an effective date while HOLD stands. An item becomes effective only
when its approver signs the version and the release board gate for its content
category is APPROVED with unexpired evidence.
