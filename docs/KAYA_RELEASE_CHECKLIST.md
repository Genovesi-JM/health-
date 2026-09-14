# Kaya release checklist

Release verdict HOLD on 14 September 2026. This checklist records evidence, not approval. Review on every phase completion and before any release action.

- [x] Initial branch and HEAD recorded; existing dirty work identified.
- [x] Source surfaces and release definitions inventoried.
- [x] Default API denies clinical HTTP access without loading databases or clinical routers; Phase 1 adds one validated informational GET exception.
- [x] Default-hold negative tests pass for clinical, auth, webhook, readiness and unknown paths.
- [x] Local Pages deployment job disabled.
- [x] Existing test/build/lint/migration/infrastructure commands measured with bounds.
- [x] Frontend and mobile dependency audits recorded.
- [x] Original runtime preserved; no data migration or live action performed.
- [x] Clean locked audit toolchain and reproducible source snapshots demonstrated.
- [x] Full backend before/after suites collected and completed; identical failures recorded.
- [x] Complete locked backend dependency audit and comprehensive local source/history secret scan captured.
- [ ] Baseline frontend tests and lint green.
- [ ] Empty and uncertain triage inputs fail closed in the original runtime.
- [ ] Unsupported emergency and outcome claims removed in every language.
- [ ] Provider, credential, tenant, consent and audit boundaries independently verified.
- [ ] Exact remote deployment state verified; no exposed clinical runtime assumed safe.
- [ ] Migration, restore and rollback exercised in the target environment.
- [ ] Named jurisdiction, clinic and human approvals recorded with scope and expiry.
- [ ] Phase 42 board authorizes exact pilot cohort, hours, workflow and immutable digest.

Do not push, deploy, run live migrations, activate providers, enroll patients, or interpret a synthetic test run as a release decision. These actions were not requested by this task.

Phase 0 audit gate PASS with external gates OPEN. Remaining unchecked items above are clinical-release requirements assigned to later phases, not a claim that the recorded baseline is green. Phase 1 technical work may begin under HOLD. No release promotion is authorized.

## Phase 1 gate

- [x] User selected Angola — Luanda for planning; formal signed adoption is BLOCKED_EXTERNAL.
- [x] Spain-first and Angola/Luanda alternatives and repository contradictions recorded.
- [x] One-clinic invited-adult coordination scope, exclusions and draft hours/capacity/owners represented in human and machine-readable form.
- [x] All 22 capability flags false; legacy API/web declarations mapped; unknown jurisdiction stays informational.
- [x] Web/Expo informational entrypoints preserve but do not mount legacy clinical applications.
- [x] Default API metadata exception is read-only; clinical readiness/auth/webhooks/providers remain held.
- [x] Draft metric and human stop/restart contract records insufficient-evidence and individual-comprehension failure behavior.
- [x] Final Phase 1 isolated checks, source preservation and independent review evidence verified.
- [x] One local phase-owned checkpoint prepared; commit identified in the completion report.
- [ ] P1-G01–P1-G08 external approvals recorded; all currently OPEN / BLOCKED_EXTERNAL.

The [Phase 1 human gates](KAYA_HUMAN_GATES.md#phase-1-planning-decision-and-specific-gates) remain launch-blocking even after engineering checks pass. No Phase 2 implementation is included in this checkpoint.

Phase 1 engineering gate PASS / COMPLETE_WITH_EXTERNAL_GATES. Clinical release HOLD. Safe to paste Phase 2: YES for isolated governance/evidence work only.
