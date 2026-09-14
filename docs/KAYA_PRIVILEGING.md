# Kaya credential verification & privileging lifecycle (Phase 17)

Evidence date 14 September 2026. Professional verification is a **human-governed,
primary-source, expiring** decision that gates every clinical action. Enforced by
[`backend/app/privileging.py`](../backend/app/privileging.py); tested in
[`backend/phase17_tests`](../backend/phase17_tests).

## Lifecycle

`draft → pending_review → verified → {suspended, expired, revoked}` (plus
needs_information / rejected / reactivation). Transitions are bounded — review
cannot be skipped and `revoked` is terminal. **Only `verified` permits clinical
work.**

## Automated checks are evidence only

Document extraction, identity vendors, background checks, and digital credentials
are **evidence, never approval**. A check that is mock, sandbox, not-configured,
stale, inconclusive, failed, pending, or non-live can never approve
(`provider_check_can_approve`). Mock-only or incomplete evidence is visibly
non-live and cannot pass the activation policy.

## Activation policy (four-eyes)

`can_activate_privilege` requires ALL of: an authorized, MFA-verified reviewer
(credentialing authority or compliance reviewer) who is **not the applicant** and
**not support**; a **distinct second approver** (four-eyes); **primary-source,
live, malware-clean, unexpired, good-standing** evidence with insurance where
required; and the decision's jurisdiction, profession, organization, scope, and
effective dates. It fails closed otherwise.

## Atomic audit

The status change and its immutable audit transition commit **atomically** — an
audit failure fails the decision. No history is deleted.

## Status-loss propagation

Loss of status (expiry, suspension, revocation, privilege narrowing, org
departure) propagates promptly to sessions, caches, queue visibility,
prescribing, records access, video, and future appointments
(`REVOCATION_PROPAGATION`), blocking every clinical endpoint while retaining an
auditable event.

## No back-door activation

No public, support, automated-provider, or legacy path can activate clinical
authority. Provider webhooks verify signature, replay, ordering and idempotency
(`verification_webhooks.py`; end-to-end re-verified in the harness).

## Human / external gate

A designated credentialing authority and licensed care organization must define
and perform the primary-source review and clinical privileging. BLOCKED_EXTERNAL.
