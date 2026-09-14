# Kaya clinician availability & schedule ownership (Phase 22)

Evidence date 14 September 2026. A slot represents where and when an **authorized**
clinician can deliver a specific service. Enforced by
[`backend/app/scheduling.py`](../backend/app/scheduling.py); tested in
[`backend/phase22_tests`](../backend/phase22_tests).

- **Authority gate** (`slot_exposable`): no slot is exposed unless the org can
  operate, the clinician is active, credentials are current, the privilege is
  granted, the service is approved, there is coverage, and the jurisdiction
  matches — fail closed on any missing condition.
- **Server-authoritative time**: instants stored in UTC (`to_utc`), local-zone
  context retained; DST-aware offsets (`local_offset_minutes`) — verified for the
  pilot zone Africa/Luanda (UTC+1, no DST) and a DST zone across its transition.
- **Capacity states** distinguish indicative vs held vs confirmed; a stale
  profile never implies live availability (`implies_live_availability`).
- **Deterministic resolution**: exceptions (breaks/leave/blackout) subtract from
  recurring windows deterministically (`resolve_availability`); slot generation
  respects duration and buffers.
- **Schedule-change effects**: an edit releases indicative and unconfirmed holds
  but confirmed appointments require explicit action and are never silently
  dropped; every change is audited.

Web and mobile render the same UTC instant and availability state. Real
credential/privilege/org state is supplied by Phases 17/18; end-to-end slot
exposure against the running app is a harness/UI adoption task.
