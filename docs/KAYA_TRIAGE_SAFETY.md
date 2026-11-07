# Kaya fail-closed triage input (Phase 19)

Evidence date 14 September 2026. Clinical uncertainty **fails closed**: an empty,
partial, duplicate, contradictory, invalid, stale-version, or client-invented
answer set can never produce LOW, SELF_CARE, completed, or a reassuring message.
Enforced by [`backend/app/triage_safety.py`](../backend/app/triage_safety.py) and a
defense-in-depth guard in `services/triage_engine.py`; tested in
[`backend/phase19_tests`](../backend/phase19_tests).

## The gate (`assess`)

Returns `URGENT`, `INCOMPLETE`, `INDETERMINATE`, or `ASSESSABLE` — never LOW or
SELF_CARE (those require the validated rule set on an `ASSESSABLE`, non-red-flag
set, Phase 20). Empty / missing-required ⇒ `INCOMPLETE`. Unknown question id,
invalid unit, out-of-range, invalid select value, or stale questionnaire version
⇒ `INDETERMINATE`. This runs **before** any clinical rule set.

## Red flags dominate

`has_red_flag` is deterministic and independent of scoring, AI, photos, and
devices. Any red flag ⇒ `URGENT`, overriding all lower outcomes and even an
incomplete set — **missing data can never subtract risk**.

## Versioned questionnaire schema

`QuestionnaireSchema` carries a version and per-question spec (stable id, type,
allowed answers, required logic, unit, range, locale coverage). Completed results
are captured as an **immutable snapshot** (`CompletedTriage`) retaining the exact
schema/rule/content versions and input snapshot needed for review. A version
change drives explicit resumption/migration, and completion is idempotent with
server timestamps and provenance.

## R01 status

The observed R01 hazard (empty triage returning LOW/SELF_CARE) is closed at the
input gate: the canonical `assess` yields INCOMPLETE, and the real engine raises
`TriageIncompleteError` on empty input rather than returning a low outcome. The
validated clinical rule set and multilingual corpus are Phase 20; wiring web and
mobile to the same state machine and locale contract is a harness/UI adoption
task.
