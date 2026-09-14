# Kaya human gates

All gates below are OPEN as of 14 September 2026. No named approver, approval date, expiry date or signed evidence was supplied. Role labels are proposed ownership, not assignments. They do not block isolated engineering work when the affected capability stays held.

| Gate | Required owner | Evidence needed for exact release scope |
| --- | --- | --- |
| Jurisdiction and intended use | Product owner and local counsel | One jurisdiction, workflow, exclusions, operator and controller decision |
| Clinical safety | Independent clinical safety lead | Validated rules and corpus, reviewed hazards, escalation and coverage |
| Licensed operation | Partner clinic and licensed clinical lead | Named clinic, professional authority, coverage and capacity |
| Privacy and legal | Privacy lead and qualified local counsel | Reviewed lawful basis, consent, retention, transfers and processor contracts |
| Security | Independent security reviewer | Reachability analysis, access/credential/audit tests, vulnerability disposition |
| Credentialing | Authorized credentialing decision maker | Verification, privileges, separation of duties and audited human decisions |
| Accessibility | Accessibility reviewer | Web/mobile evaluation and remediation evidence |
| Operations and support | Operations owner | Incident handling, complaints, monitoring, stop authority and support coverage |
| Infrastructure and recovery | Infrastructure owner | Exact environment/digest, restore and rollback exercises, current deployment inventory |
| Commercial | Commercial and financial owners | Approved pricing/payment scope and contracts; no payments activated |
| Pilot release | Independent release board | All preceding approvals, dates, scope, evidence references, review/expiry dates and conflicts |

No approval is implied by earlier documentation, configuration, translations, test passes, or resource existence. No new legal or clinical conclusion was researched or asserted in this engineering baseline.

Phase 0 is COMPLETE_WITH_EXTERNAL_GATES. All gates above remain OPEN with no approval, named owner acceptance or expiry fabricated. Their affected capabilities remain held in the tested local entry points; later isolated engineering may proceed. Exact deployed-system checks and named human assignments are still required before any clinical pilot.

## Phase 1 planning decision and specific gates

On 14 September 2026 the user explicitly selected **“Angola — Luanda”** in response to a planning-only market question. This is a recorded product-planning choice, not a clinical/legal/privacy signature or permission to enroll anyone. Its [decision record](KAYA_JURISDICTION_DECISION.md) compares the Spain-first alternative and required external evidence. Formal signed jurisdiction adoption is **BLOCKED_EXTERNAL**; clinical release remains **HOLD**.

The following rows refine the existing gates for the [draft pilot scope](KAYA_PILOT_SCOPE.md). All are OPEN; BLOCKED_EXTERNAL indicates the missing human/external evidence, not a technical permission to bypass the gate. No approver name, accepted assignment, signature, approval/expiry date, clinic contract, or live-provider approval has been supplied.

| Gate ID | Gate and status | Required accountable human | Required evidence / current reference |
| --- | --- | --- | --- |
| P1-G01 | Formal Angola/Luanda jurisdiction adoption — OPEN / BLOCKED_EXTERNAL | Accountable operator/product decision maker, with qualified local counsel reviewing relevant obligations | Scoped, dated signed decision for one jurisdiction and workflow; [planning record](KAYA_JURISDICTION_DECISION.md) records the user's preference only |
| P1-G02 | Named operator, clinic, clinical owner and controller — OPEN / BLOCKED_EXTERNAL | Product/clinic owners, independent clinical lead and privacy lead | Legal operator and controller roles, exactly one verified Luanda clinic and site, appointed clinical owner, contractual responsibilities and approved scope |
| P1-G03 | Workflow, eligibility and local exclusion/escalation wording — OPEN / BLOCKED_EXTERNAL | Independent clinical lead, qualified local counsel and clinic operations owner | Reviewed adult/capacity/consent/location rules, excluded pathways, authoritative local-source review, approved non-emergency instructions and human escalation handling; no invented emergency number or partner |
| P1-G04 | Dates, hours, holiday calendar, rota and capacity — OPEN / BLOCKED_EXTERNAL | Named clinic and operations owners | Signed start/end dates and staffed calendar in Africa/Luanda; coordinator/clinician/substitute assignments; approved appointment/queue limits and bounded support targets; [scope values](KAYA_PILOT_SCOPE.md#draft-operating-envelope) remain hypotheses |
| P1-G05 | Angolan Portuguese, accessibility and human comprehension — OPEN / BLOCKED_EXTERNAL | Language/accessibility reviewer, clinical owner and privacy reviewer for study arrangements | Approved wording/flow and consented human evaluation using scripted scenarios without patient health data; sample provenance and individual critical checks; synthetic tests cannot supply comprehension evidence |
| P1-G06 | Data map, metrics, processors, hosting and transfers — OPEN / BLOCKED_EXTERNAL | Privacy lead, qualified counsel, infrastructure and integration owners | Both stores and all processing/support/backup locations; minimal coordination data and telemetry, lawful purposes/access/retention, contracts and hosting/transfer decision; EU-region configuration is not an approval |
| P1-G07 | Stop, incident handling and human restart — OPEN / BLOCKED_EXTERNAL | Clinical, privacy/security, clinic and operations owners | Named stop authority, approved escalation chain, accessible support, booking reconciliation, privacy incident process, audit preservation and restart decision record; no automatic restart or flag-based authorization |
| P1-G08 | Exact perimeter and pilot release — OPEN / BLOCKED_EXTERNAL | Independent security reviewer and release board | Matching canonical/mirrored policy, direct-route and failure-path evidence, approved scope/caps/dates/rota, exact artifact/environment, remaining release gates and signed residual-risk decision |

Every gate is due before real participation, live provider activation or scope expansion. An unset required value or absent/expired/rejected evidence must deny admission. A policy flag, successful synthetic test, public metadata endpoint, informational client screen or selected market cannot change a human approval state. Phase 1 validation and completion status will be recorded in [execution status](KAYA_EXECUTION_STATUS.md); this gate update makes no pass claim.
