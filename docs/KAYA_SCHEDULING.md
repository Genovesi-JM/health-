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

## Application integration — 4 October 2026

The running development application now has dated, clinician-owned appointment
slots, implemented by `app/services/appointments.py`,
`app/services/appointment_booking.py` and `app/routers/appointments.py`. This
integration is distinct from the Phase 22 policy model above. Current credential
authority and the clinician's practice country are enforced; this does not
certify organization, facility, service or on-call approval for a live launch.
The public release remains HOLD.

Clinicians publish future slots lasting 15–120 minutes, up to 180 days ahead.
Angola uses Africa/Luanda. Portugal supports Europe/Lisbon, Atlantic/Madeira and
Atlantic/Azores. Inputs must include an offset that matches the selected zone;
nonexistent clock times are rejected and repeated hours require an explicit
offset. Read windows cover at most 31 days. The web editor publishes individual
dated slots; older weekly availability remains stored but does not create
bookable capacity.

Patients choose a server-published slot or explicitly submit an unscheduled
request. Reserving a slot creates a `requested` consultation; it is not a
confirmed appointment until the doctor accepts. Arbitrary doctor/time inputs
cannot bypass published capacity. The database transaction reserves the slot,
creates the consultation and writes the audit event together. Clinician and
patient row locks precede conflict checks; a conditional slot update supplies
another guard against competing claims. Both resources are checked for overlaps,
including legacy timed appointments and active care. Adjacent slots may coexist.
Cancelling releases only the matching reservation; a reserved slot cannot be
withdrawn by the availability editor.

An owner-scoped UUID idempotency key recovers an identical booking after a lost
response. Changed content with the same key is rejected. Web keeps uncertain
requests unchanged while retrying; native persists the exact request and key in
SecureStore before submission and restores them after restart. A request in the
unscheduled queue does not promise a response time or appointment time.

The clinician agenda accepts an explicit date, country and timezone. Its UTC
query bounds follow the selected local day, including Portugal's 23-hour and
25-hour days. Responses include explicit UTC instants and known duration. Legacy
records with an unknown country remain unclassified and visible to their owning
doctor; the selected agenda zone controls display, without assigning a country
to those records. Patient lists use the recorded slot zone; historical records
without one show an explicit UTC fallback.

`appointment_slots_v1` adds slots and consultation booking metadata. Existing
consultations retain a null country and timezone unless they already have that
information. Tests use disposable databases; no user database has been migrated.

Remaining scheduling work includes recurring publication, leave/blackout editing,
expiry of unaccepted requests, pagination of broader consultation
history, deployment-specific PostgreSQL concurrency evidence and device verification.
Local PostgreSQL API concurrency checks are recorded in [booking](KAYA_BOOKING.md).
Published slots alone do not establish a clinical service's launch eligibility.

## Patient rescheduling — 4 October 2026

`POST /api/v1/consultations/{id}/reschedule` moves an owned, unpaid requested or
scheduled visit to another published slot for the same doctor and service
country. The request carries a UUID `Idempotency-Key`, `slot_id` and integer
`expected_revision`. The original reservation is retained until the new claim,
release, revision history, audit and in-app notices commit in one transaction.
Every successful change returns the visit to `requested`: the new time needs a
new clinician acceptance. Existing payment references require support review;
this endpoint does not change a payment or promise a refund.

An identical key and body recover the current consultation even if care has
subsequently progressed. Changing the body under the same key is rejected.
Only the structured `reschedule_not_committed` conflict confirms that this
specific key did not commit after the common resource locks were acquired.
Clients retain uncertain keys and exact bodies across retries. The web keeps a
minimal owner-scoped reference in session storage and exposes recovery even
after the current status would prohibit a fresh move.

Queue, agenda and video-preparation responses include the appointment revision.
Accept, start, video check-in and preflight writes send that displayed revision;
stale writes fail before acting on a changed time. For compatibility, an omitted
revision means zero and cannot approve a rescheduled visit. Rescheduling resets
unstarted video confirmations and current check-ins, retains authored notes and
audit history, and rejects any recorded start, completion or room attendance.
Replaying a committed request cannot erase newly recorded preparation.

`appointment_reschedules_v1` adds the revision and retained retry history after
`clinical_amendments_v1`, preserving existing clinical-retention triggers. Its
downgrade refuses to discard nonempty rescheduling history. All migration and
concurrency validation uses disposable databases; no operational database was
migrated.
