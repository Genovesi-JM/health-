# Kaya canonical identity model (Phase 12)

Evidence date 14 September 2026. One person, identity, tenant membership, and
clinical authority have **distinct lifecycles**. Enforced by
[`backend/app/identity.py`](../backend/app/identity.py) and tested in
[`backend/phase12_tests`](../backend/phase12_tests).

## Layers (kept distinct)

| Layer | Meaning | Grants authority? |
| --- | --- | --- |
| Subject identity | Immutable, opaque, stable id (`User.id`) | No |
| Profile | Mutable display data (name, contact) | No |
| Requested persona | What a person *asks* to be (registration) | No |
| Organization membership | Scoped membership in an org/clinic | Scoped only |
| Platform role | Granted role (`patient` default) | Yes, if granted |
| Clinical profession | Claimed profession (doctor/nurse) | No — until verified |
| Credential status | Verification state of a dossier | Gates privilege |
| Granted clinical privilege | Explicitly granted, verified privilege | Yes |

**Only the granted platform role and verified privilege confer authority.** A
mutable field — email, phone, provider/OAuth id, licence number, full name, slug
— is never authorization authority.

## Registration invariant (no self-promotion)

Public registration creates only a **non-privileged** user
(`canonical_account_role` always returns `patient` for a privileged request).
Clinical/admin roles are additionally MFA-mandatory, so a public registration
requesting one is refused (403) before any account is created. A doctor/nurse
request may create an **application dossier**, which grants no authority until
verified (Phase 17). No unauthenticated or ordinary authenticated caller can
self-promote through registration, a profile field, onboarding, or a legacy
endpoint.

## Canonical vs legacy account model

The canonical identity is the main-product `User` (+ `UserProfile`, org
`AccountMember` for scoped membership). Legacy/overlapping account surfaces
(`Account`/`Company`, `CustomerAccount`/`Employee`, the separate accounts base)
are **compatibility-only**: they must delegate to the canonical service or be
default-off with a retirement plan (Phase 32 owns database convergence). No data
is merged or deleted in this phase.

## Identity linking, recovery, lifecycle

- **Linking / verified email-phone:** an identity may link a verified email/phone
  and OAuth identities to one subject; a duplicate email is rejected at
  registration.
- **Duplicate handling / merge:** merges require human review and are audited;
  no silent identity merge.
- **Recovery:** account recovery re-establishes access to the same subject
  without changing role or privilege.
- **Disablement / deletion / legal hold:** effects are defined in
  `ACCOUNT_LIFECYCLE_EFFECTS` — disablement revokes sessions and blocks login
  while retaining records under legal hold; deletion ends sessions/memberships,
  suspends credentials, retains legally-required records under legal hold, and is
  audited.

## Human / external gate

Merge review, legal-hold policy, and retention periods for disablement/deletion
require the privacy/legal owner (see [legal matrix](KAYA_LEGAL_ISSUE_MATRIX.md)).
