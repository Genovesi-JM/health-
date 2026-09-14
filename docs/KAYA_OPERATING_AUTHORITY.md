# Kaya organization & clinical operating authority (Phase 18)

Evidence date 14 September 2026. Kaya cannot present a clinic, facility,
availability, or care service — or accept a booking — without a **verified
organization and an active operating relationship** for the chosen jurisdiction.
Enforced by [`backend/app/operating_authority.py`](../backend/app/operating_authority.py);
tested in [`backend/phase18_tests`](../backend/phase18_tests).

## Separate records

Organization / legal entity / licensed healthcare organization, facility/location,
department/service, practitioner membership, and granted privilege are distinct
records. A verification dossier covers registration, license/authorization,
address, facility type, responsible medical director, insurance, contacts,
data-processing roles, service hours, and jurisdiction.

## Human-verified organization

`org_can_operate` requires a **human** verification (an automated extraction or a
submitted registration number is not verification), an active (non-suspended/
closed/expired/terminated) status, a matching jurisdiction, a responsible medical
director, valid insurance, and a current effective window.

## Joint org + professional authority

`clinician_can_practice_here` / `booking_allowed` require the org to be able to
operate **and** the clinician's membership to be active, privilege-granted,
bound to **this exact facility and service**, and within effective dates. A
**global verified flag never authorizes practice everywhere** — a clinician bound
to one facility cannot practise at another, and location downtime blocks it.

## Public exposure

`can_appear_public` shows a clinic/facility only with an active verified
relationship; only approved public fields (`name, facility_type, address,
services, hours, contact`) are publishable — never private evidence (registration
number, license scan, insurance document, bank details) — and partner status is
never inferred.

## Status changes & cross-org

Suspension, closure, expired authorization, terminated agreement, changed medical
director, or location downtime invalidate schedules, new bookings, clinical
entry, and public listing without erasing records. Cross-organization staff and
data access are denied by policy (`cross_org_access_allowed`).

## Human / external gate

A real clinic agreement, operating authorization, medical director, insurance,
and data-governance allocation are **non-delegable launch gates**; the signed
pilot relationship is an external gate in the release record, not a code
checkbox. BLOCKED_EXTERNAL.
