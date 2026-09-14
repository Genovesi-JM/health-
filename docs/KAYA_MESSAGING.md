# Kaya secure clinical messaging (Phase 28)

Patient–clinician messaging that cannot leak, misroute, or be spoofed, is not an
emergency channel, and never auto-executes a clinical directive
(`backend/app/clinical_messaging.py`, domain-pure).

## Invariants enforced

- **Relationship-scoped send.** `can_send` allows a message only within an *open*
  thread where the sender is an authentic participant.
- **Server-derived recipient (no misroute).** `resolve_recipient` returns the
  other participant of the thread; the client never chooses a recipient, so PHI
  cannot be sent to a non-participant. `build_message` sets the recipient from the
  thread and refuses unauthorized senders and empty bodies.
- **Sender authenticity (no spoof).** `sender_authentic` requires the claimed role
  to match the sender's actual slot in the thread — a patient cannot claim a
  clinician role and vice versa.
- **Not an emergency channel.** Every thread carries `NON_EMERGENCY_NOTICE`, and
  `emergency_check` returns a redirect directive when a message contains emergency
  red-flags (multi-language). Such a message is surfaced, not treated as a routine
  clinical action.
- **Never auto-act on directives.** `patient_message_is_auto_actionable` is always
  `False`; `directive_requires_clinician_review` flags a patient message that reads
  like a clinical change ("stop my meds", "double the dose", "cancel my
  prescription") for a clinician decision — it is never auto-executed.
- **Integrity.** Sent messages are append-only (`edit_prohibited` /
  `delete_prohibited` raise; a correction is a new message); read receipts are set
  only by the recipient and are monotonic (never un-read or reset).
- **Participant-only read.** `can_read_thread` admits only the two participants.

## Tests — `backend/phase28_tests/test_clinical_messaging.py` (20, all passing)

Participant send in open threads; outsider and closed-thread denial;
server-derived recipient and misroute rejection; role-spoof denial; nurse valid
for the clinician slot; emergency redirect (EN/PT) with routine messages still
carrying the notice; patient directive never auto-actionable but routed for
review; immutable sent messages; recipient-only monotonic read receipts;
participant-only thread read.

## Human intervention / external gates

- **Emergency red-flag review (owner-bound).** The red-flag list is an
  illustrative safety net, not a validated triage tool; a named clinical owner
  must review and localize it, and decide the emergency redirect UX.
- **Retention & disclosure schedule.** The data controller sets how long message
  threads are retained and the lawful basis, plus any legal-hold/subject-access
  handling.
- **ORM adoption.** The live `ConsultationMessage` model has `ondelete=CASCADE`
  and no send/read relationship gate; adopting this policy (participant gate,
  derived recipient, append-only, monotonic reads, no-cascade) is an
  owner-approved migration. No live DB migrated here.
- **Runtime adoption verification** — a harness-verified task must confirm the held
  messaging endpoints consume this policy.
- **Clinical release stays HOLD.**
