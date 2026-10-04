# Kaya consent model & representative authority (Phase 15)

Original domain-model evidence: 14 September 2026. Runtime assessment updated
4 October 2026. The intended consent contract is a durable, **server-owned,
append-only** record of the exact approved text and language a subject or
authorized representative saw, its purpose and the effect of withdrawal.
[`backend/app/consent.py`](../backend/app/consent.py) implements an in-memory
domain specification tested in [`backend/phase15_tests`](../backend/phase15_tests).
It is not the operational ORM ledger or a release approval.

The current operational `PatientConsent` rows contain consent type, time, IP and
user agent. Booking, document and closeout checks use the presence of relevant
types. The legacy compliance endpoint deduplicates by patient and type. These
checks cannot establish acceptance of the current approved version, content
hash, language or market, and do not enforce withdrawal. Onboarding records its
wizard version and country in an audit event; that is not adoption of an approved
document catalog. Durable catalog/ledger adoption and withdrawal UX are remaining
engineering work. Approved documents, lawful bases and authority rules also need
named human owners. Clinical release remains HOLD.

The sections below describe the domain contract and its isolated tests, not
completed runtime enforcement. Client route guards are supplementary only.

## Document catalog

Each consent/legal document is versioned with an **immutable content hash**,
jurisdiction, language, purpose, audience, kind, required-vs-optional flag,
effective dates, supersession, and an **approved source** (a document with no
approved source fails closed). Kinds are kept distinct and never bundled:
necessary — clinical informed consent, privacy notice, contract; optional — AI,
images, recording, marketing, research, devices, vendor transfer.

## Append-only ledger

Every record captures subject, representative (if any), channel/actor, exact
document id + version + hash, language, notice evidence, action
(grant/refuse/withdraw), timestamp, and resulting capability state. Records are
never mutated; the effective state is derived from the log.

## Fail-closed effectiveness

`has_effective_consent` returns true only for a current, matching, non-withdrawn
**grant** of the exact version, hash and language, within the effective window,
from an approved source. Missing, refused, withdrawn, stale, mismatched,
untranslated, unapproved, or expired ⇒ **fail closed**. Refusal never masquerades
as acceptance.

## Withdrawal, supersession, legal hold

Withdrawal stops future **optional** processing without deleting legally-required
records (`existing_required_records_deleted` is always false; required documents
stay under legal hold). Re-consent and supersession append new versions.

## Representative / minor authority

Representative authority is an explicit, bounded record (relationship, scope,
verification, expiry, revocation) — **never inferred from shared contact
details**. `can_represent` denies an unverified, expired, revoked, or
out-of-scope representative. Jurisdictional age/capacity and child-participation
rules are counsel-owned (below).

## Server gating

Server operations gate on the applicable effective record or a documented
alternate lawful basis (from the [data inventory](KAYA_DATA_INVENTORY.md) /
[legal matrix](KAYA_LEGAL_ISSUE_MATRIX.md)); a client checkbox is never the basis.

## Human / external gate

Counsel and the clinical owner must approve the consent catalog, lawful-basis
mapping, minor/capacity rules, and retention effects. BLOCKED_EXTERNAL.
