# Kaya clinical safety case (Phase 11)

Evidence date 14 September 2026. **Status: HOLD.** This safety case is a
skeleton and hazard analysis prepared by engineering. It is **not approved** and
does not authorize patient use. It remains HOLD until a **named, qualified
clinical safety owner** and the licensed care organization approve intended use,
protocols, residual clinical risk, and all patient-facing clinical copy.

## Intended use (proposed, unapproved)

- **Intended users:** invited adults (18+) with capacity, in Luanda, during
  bounded clinic hours, via one licensed partner clinic.
- **Intended use:** coordinate **non-urgent** primary-care appointments and
  follow-up; organise structured information for a clinician. Kaya does not
  diagnose, does not provide urgent or emergency care, does not dispatch
  transport, does not notify hospitals, and does not replace a clinician.
- **Care setting / jurisdiction:** Angola/Luanda, one licensed clinic (planning
  only; formal adoption BLOCKED_EXTERNAL).

## Inclusion / exclusion (tester-actionable)

**Included:** invited adult, in area, in hours, non-urgent primary-care
coordination through the partner clinic. **Excluded:** emergencies/urgent
conditions; minors; users without capacity; unsupported geographies/hours;
diagnosis; prescribing without approved rules; teleconsult/video, payments, AI,
devices, and KAYA Response (all disabled). A feature is inside the approved
service only if it matches an Included row and no Excluded row — testable against
the pilot scope and capability matrix.

## Assumptions, contraindications, human oversight

Assumes a licensed clinician makes every clinical decision; Kaya only routes and
records. Contraindicated for any emergency or time-critical presentation. Human
oversight is mandatory: no automated output reduces urgency or substitutes for a
clinician.

## Hazard analysis

Severity P0 (catastrophic: death/serious harm/false reassurance) or P1
(critical). Each hazard has prevention, detection, response, evidence, owner, and
residual-risk status.

| Hazard | Sev | Prevention | Detection | Response | Owner | Residual |
| --- | --- | --- | --- | --- | --- | --- |
| Delayed care | P0 | Non-urgent scope + emergency guidance | Queue-age monitoring | Escalate/redirect to emergency services | Clinical safety | OPEN until validated |
| False reassurance | P0 | Fail-closed triage: incomplete → INCOMPLETE/INDETERMINATE, never LOW/SELF_CARE (R01) | Red-flag negative tests | Block low-risk output; human review | Clinical safety | OPEN (Phase 19/20) |
| Incorrect urgency | P0 | Red flags dominate; no AI downgrade | Validation corpus | Human override up only | Clinical safety | OPEN |
| Unavailable clinician | P1 | Truthful availability; no false confirmation | Coverage monitor | Show unavailable + guidance, never "booked" | Operations | OPEN |
| Bad handoff | P1 | Structured episode + provenance | Handoff completeness check | Re-handoff; audit | Clinical | OPEN (Phase 24) |
| Wrong patient | P0 | Identity binding + scope | Access audit | Block + investigate | Security | OPEN (Phase 14) |
| Wrong clinician | P1 | Assignment scope + credentials | Authz audit | Reassign; audit | Credentialing | OPEN |
| Missing record | P1 | Durable writes; migrations | Integrity checks | Restore; reconcile | Backend | OPEN (Phase 32/34) |
| Duplicate booking | P1 | Transactional + idempotency | Conflict metrics | Reject duplicate | Backend | OPEN (Phase 23) |
| Message failure | P1 | Delivery status; no silent drop | Delivery telemetry | Retry; surface failure | Comms | OPEN (Phase 28) |
| Credential expiry | P1 | Expiry enforcement | Expiry scan | Suspend privileges | Credentialing | OPEN (Phase 17) |
| Data corruption | P1 | Constraints; validated serialization | Integrity + restore test | Restore from backup | Backend | OPEN (Phase 34) |
| Translation error | P1 | Reviewed clinical copy per locale | Copy-contract + human review | Correct + re-version | Clinical + language | OPEN |
| AI output | P0 | AI disabled/fail-closed; no urgency reduction | Egress deny logs | Kill switch | Clinical + security | OPEN (Phase 30) |
| Device error | P1 | Provenance; plausibility bounds | Outlier flags | Human review; no auto-action | Clinical | OPEN (Phase 31) |
| Emergency-copy misunderstanding | P0 | Reviewed, jurisdiction-correct emergency wording; comprehension study | Comprehension evaluation | Rewrite; block until understood | Clinical + language | OPEN (R15/R16) |

## Mitigation hierarchy

Eliminate (exclude the hazard from scope) → engineering control (fail-closed
code + tests) → information/warning (truthful copy) → human oversight. Warnings
never substitute for a fail-closed control on a P0.

## Safe-degraded behavior (never false-reassure / false-confirm)

| Unavailable | Behavior |
| --- | --- |
| API/DB | 503 / honest error; never a success or "you're fine" |
| Video | Show unavailable; never "connected" |
| Notification | Surface failure; never assume delivered |
| Clinician coverage | Show no availability; never auto-confirm a booking |
| External provider | Fail closed; never a fake-live result |

Downtime and unavailable-clinician states must present a truthful non-confirmation
— never a false reassurance or false confirmation. The current held default
(503/no-store on every clinical route) satisfies this at rest.

## Clinical-content registry

Every rule set, questionnaire, threshold, instruction, disclaimer, translation,
protocol, and patient-facing recommendation is registered with version, author,
approver, effective dates, and rollback — see
[clinical content registry](KAYA_CLINICAL_CONTENT_REGISTRY.md). Clinical content
cannot change without a versioned review and a linked validation set; all current
items are DRAFT / unapproved.

## Surveillance (no patient use authorized)

Post-incident review and post-launch surveillance requirements are defined
(safety events, failed escalations, comprehension failures, availability, and
booking integrity), to be operated only after a pilot is authorized. Defining
them here authorizes nothing.

## Human / external gate

Only the accountable clinical safety owner and the licensed care organization can
approve intended use, protocols, residual clinical risk, and patient-facing
clinical copy. **BLOCKED_EXTERNAL** — this safety case stays HOLD until then.
