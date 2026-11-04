# Kaya authorization policy (Phase 14)

Evidence date 14 September 2026. Authorization is a **server-owned, default-deny**
policy enforced by one boundary — [`backend/app/authz.py`](../backend/app/authz.py),
`can_access(actor, resource, purpose)` — intended for REST routes, background
jobs, signed URLs, exports, search, dashboards, and mobile endpoints. Health
access is scoped by organization, assigned care team or episode, profession,
granted privilege, purpose, record type, status, and time. A role alone, or the
mere existence of a consultation, is never sufficient.

## Permission matrix

| Role | Allowed |
| --- | --- |
| patient / cliente | own record only (care / self-view / data-rights) |
| caregiver | authorized dependants only |
| doctor / nurse | clinical only when org-member **and** assigned to the episode/care-team **and** holding a granted clinical privilege **and** for a care/handoff/documentation purpose |
| pharmacist | assigned-episode **prescriptions only** |
| compliance_reviewer | credentialing only — never clinical records |
| corporate_admin / employer | **aggregate** occupational-health report only (min cohort 10); never an individual health record |
| support | never clinical content, never credential decisions; explicit non-clinical grants only |
| admin | platform config / audit / user-admin; **no clinical access without accepted break-glass** |
| service identity | default deny; explicit grants only |

## Separation of duties

Compliance, platform administration, support, finance, and clinical privileging
are distinct permission sets. Support has no clinical or credential access.
Admins have no default clinical access. Reviewers are limited to credentialing.
This mirrors the governance separation of duties.

## Default deny (measurable)

An unmapped role, resource, or route returns `Decision(False, "default deny…")` —
it cannot silently inherit admin or support access. Unknown/foreign resource
identifiers reveal no clinical data (the decision is the same DENY regardless of
whether the id exists), so there is no enumeration oracle.

## Auditing

Clinical reads, downloads, exports, shares, and break-glass events are auditable
(`is_auditable_access`), not only writes.

## Break-glass

Break-glass is available only if the accountable clinical owner has accepted it
(`break_glass_allowed(clinical_owner_accepted)`), and every use is auditable. It
is OFF until that acceptance exists.

## Revocation

Authorization changes (account disablement, credential suspension, organization
removal, high-risk security change) must revoke active capability promptly and
consistently across API, background jobs, cache, and file links — enforced by
re-evaluating `can_access` at use time and by session-family revocation
(Phase 13).

## Adoption gate

This is the canonical policy. Wiring every REST route, job, signed URL, export,
and mobile endpoint to this single boundary — and the end-to-end cross-tenant /
IDOR / suspended-user negative suite against the running app — is an engineering
adoption task tracked for the capability phases and re-verified in the disposable
harness. Until wired everywhere, the held default (503 on every clinical route)
is the operative control.
