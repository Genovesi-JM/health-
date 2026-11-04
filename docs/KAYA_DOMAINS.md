# Kaya modular-monolith domains (Phase 7)

Evidence date 14 September 2026. This defines domain ownership and dependency
rules over the existing routers, services, and models, preserving compatible
behavior. It is additive: no dead code is removed here, and no removal is claimed
without usage evidence. Capability states are bound to the Phase 1 flags in
[`kaya_policy.json`](../backend/app/kaya_policy.json) and the
[capability matrix](KAYA_CAPABILITY_MATRIX.md); all clinical capabilities remain
`DISABLED_PENDING_GATE` under the hold.

## Domains and ownership

| Domain | Owns (routers) | Owns (services/adapters) |
| --- | --- | --- |
| identity | `auth`, `me`, `mfa`, `accounts` | `mfa` |
| organizations | `organisations`, `corporate` | — |
| credentialing | `credentials`, `verification_actions`, `verification_webhooks`, `compliance_review` | `credential_providers`, `credential_verification`, `pem_gateway` |
| consent | (consent records in patients/onboarding) | — |
| patients | `patients`, `family`, `caregiver` | — |
| triage | `triage` | `triage_engine` |
| scheduling | `doctors` (availability), `doctor_portal` (agenda) | `scheduler` |
| care-episodes | `consultations`, `teleconsulation`, `clinical_operations`, `nurse`, `clinician_workspace` | — |
| clinical-records | `prescriptions`, `prescription_requests`, `readings`, `medications` | `pdf_generator` |
| communications | `messages`, `notifications`, `chatbot`, `public_contact` | — |
| billing | `health_billing`, `payments` | `payments`, `cart`, `orders` |
| integrations | `shop_devices`, `readings` (device ingest), `ai` | `health_storage`, `storage`, `document_expiry` |
| operations | `admin`, `compliance`, `dashboard`, `health_dashboard`, `public_facilities` | `risk_engine` |

**GeoVision-legacy / removal candidates** (not in the app's included routers;
retained per [architecture index](KAYA_ARCHITECTURE_INDEX.md)): `contacts`,
`customer_accounts`, `datasets`, `employees`, `hardware`, `kpi`, `orders`
(drone), `products`, `projects`, `risk`, `services`, `shop`. Classification:
`removal candidate` — deferred to a later phase with usage/rollback evidence.

## Dependency rules

1. **Domain services own invariants.** Business rules live in services, not
   routers.
2. **Routers translate transport only.** A router must not import another router.
3. **Repositories own persistence.** Domain logic does not hand-write cross-table
   mutations outside its domain.
4. **Provider adapters never mutate unrelated domains** and never import routers
   (`app/services/*` must not import `app.routers` — enforced in
   `backend/phase7_tests`).
5. **Domain-pure modules** (`governance`, `phase1_policy`) import no app config,
   database, or routers, so new domain code is testable without importing the
   whole application or contacting a provider (enforced).
6. **Clients consume versioned contracts**, not internal models.

## Canonical account and database ownership

Two SQLAlchemy bases coexist: the main product base (`app/database.py`) and a
separate accounts base (`app/accounts/database.py`), with overlapping account
surfaces (`auth`/`me`/`accounts` vs legacy `customer_accounts`). The **canonical
identity is the main product `User`**; the accounts base is compatibility-only.
This phase does **not** merge or delete data — it records the ownership and the
convergence plan. Actual convergence and migration ownership are Phase 12
(identity model) and Phase 32 (canonical databases).

## Overlapping-path convergence plan (compatibility-only until converged)

| Overlap | Canonical | Compatibility-only | Converge in |
| --- | --- | --- | --- |
| Accounts | `auth`/`me`/`User` | `accounts`, `customer_accounts` | Phase 12 |
| Payments | `health_billing` + `services/payments` | `payments` router, `orders` | Phase 39 |
| Consultation | `consultations` + `teleconsultation` | — (split by transport) | Phase 24/25 |
| Doctor | `doctors` (profile) + `doctor_portal` (portal) | — | Phase 22 |
| Verification | `credentials` + `verification_actions` | `compliance_review` | Phase 17 |

## Capability states

Each active API/UI surface has exactly one owning domain (table above) and one
truthful capability state from the capability matrix: `NOT_BUILT`, `MOCK`,
`SYNTHETIC_ONLY`, `DISABLED_PENDING_GATE`, `PILOT`, or `LIVE`. Under the hold,
every clinical capability is `DISABLED_PENDING_GATE` and unreachable by default
(the informational entry cannot be enabled by client-side navigation); no surface
is `PILOT` or `LIVE`.
