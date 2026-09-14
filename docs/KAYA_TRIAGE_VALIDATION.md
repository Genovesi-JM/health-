# Kaya triage validation framework (Phase 20)

Evidence date 14 September 2026. This is the **technical scaffolding** for
clinical validation, enforced by
[`backend/app/triage_governance.py`](../backend/app/triage_governance.py) and tested
in [`backend/phase20_tests`](../backend/phase20_tests). **The coding agent reports
technical evidence and never labels the rules clinically validated** — clinical
validation, thresholds, protocol approval, and residual-risk acceptance require
qualified clinicians for the selected service and jurisdiction (BLOCKED_EXTERNAL).

## Excluded populations & complaints

Pediatric, minor, pregnancy, mental-health crisis, safeguarding, severe pain, and
communication-limited populations — and complaints such as chest pain, stroke,
suicidal ideation, overdose, severe bleeding, anaphylaxis, obstetric emergency —
are excluded from the invited-adult pilot. Excluded cohorts get a safe redirect
(`EXCLUDED_REDIRECT`), **never a definitive low-risk recommendation** — the rules
exclude rather than improvise.

## Clinical-content approval gate

Every pilot triage output/instruction must carry a named author, an **independent
approver**, a version, an effective date, and validation evidence
(`content_is_usable`). Self-approval and any approval by `engineering_preparer`
are rejected. Rules/thresholds/messages/citations live in this versioned package,
approved outside code.

## Locked-corpus metrics

`evaluate_corpus` computes technical metrics (false-negative rate on urgent truth,
unclassifiable rate, reviewer disagreement) over a locked corpus.
`corpus_meets_clinical_threshold` returns a pass/fail **only** when a
clinician-supplied threshold is given, and `None` (undecided) otherwise — the
agent never invents a clinical pass mark.

## Kill switch & rollback

`triage_enabled` runs triage only when not killed and the content is approved.
The kill switch and rule rollback disable triage **without blocking emergency
guidance** (`emergency_guidance_available` always true) and never strand users —
`next_step_on_disabled_triage` gives clinician-review-or-local-emergency-services,
never a low outcome.
