# Kaya care episode, queue & handoff (Phase 24)

Evidence date 14 September 2026. Intake, queue ownership, nurse/doctor handoff,
consultation and closure are one explicit episode with bounded access. Enforced
by [`backend/app/episode.py`](../backend/app/episode.py); tested in
[`backend/phase24_tests`](../backend/phase24_tests).

- **Canonical states** (requested → triage_incomplete/awaiting_review →
  scheduled → checked_in → queued → claimed → in_progress → handed_off →
  completed → closed, plus cancelled/no_show/escalated). `can_transition`
  enforces per-transition **actor policy** and rejects impossible/stale
  transitions, returning the current allowed-next set.
- **Atomic claim** (`ClaimLedger`): concurrent claims yield exactly one owner; the
  loser gets an auditable `ClaimConflict` (no duplicate clinical work). Abandoned
  claims release; reassignment requires a supervisor.
- **Bounded queue visibility** (`queue_visible`): scoped by org, facility,
  service, shift, and privilege — a clinician never browses unrelated patients;
  after handoff or shift end, access is only via current assignment.
- **Handoff** carries scoped content (not the whole record), acknowledgement,
  unresolved tasks, escalation and sender access-expiry;
  `handoff_can_close_episode` is false while unacknowledged, tasks remain, or an
  escalation is open — an unfinished handoff can never silently close the episode
  or hide escalation.

Legacy consultation/doctor-queue/nurse-queue/teleconsult/workspace routes unify
behind this canonical service; end-to-end route unification and compatibility
tests are a harness adoption task.
