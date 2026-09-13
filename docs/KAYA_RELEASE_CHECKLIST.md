# Kaya release checklist

Release verdict HOLD on 14 September 2026. This checklist records evidence, not approval. Review on every phase completion and before any release action.

- [x] Initial branch and HEAD recorded; existing dirty work identified.
- [x] Source surfaces and release definitions inventoried.
- [x] Default API denies HTTP access without loading databases or clinical routers.
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
