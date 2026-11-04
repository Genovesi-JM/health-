# Kaya emergency claims and KAYA Response deferral (Phase 3)

Evidence date 14 September 2026. This record governs emergency/outcome copy and
the deferral of the KAYA Response ambulance workstream. It closes the code-
controlled part of risk **R02**; remote/deployed reachability remains a
separate, still-open gate.

## 1. What was quarantined

Kaya has **no hospital-notification, pre-alert, dispatch, or ambulance
integration**. The prior public copy claimed hospital pre-alert, pre-arrival
preparation, reduced waiting, greater safety, priority access, ETA, and
guaranteed medical-response SLAs across all four locales. Those claims were
false relative to the actual system and are now removed from source and replaced
with truthful, non-promissory emergency **guidance**: *Kaya is not an emergency
service; in an emergency, contact your local emergency services directly.*

Enforcement: [`backend/phase3_tests/test_copy_contract.py`](../backend/phase3_tests/test_copy_contract.py)
scans `translations.ts` (all locales) and the component tree on every run and
fails if any forbidden claim or hardcoded emergency number reappears. No
jurisdiction is assumed, so no emergency number (112/911/999) is hardcoded; the
guidance points to "your local emergency services".

Reachability is further bounded by the Phase 1 hold: the default backend denies
all clinical routes (503) and the clinical frontend is not mounted, so these
surfaces are not user-reachable regardless. Server-owned flags (`release: HOLD`,
all feature flags off) prevent a stale client build from re-activating any
removed capability.

## 2. KAYA Response is a separate, deferred product

KAYA Response (ambulance/dispatch) is **not part of Kaya core readiness** and is
**not** unlocked by any core phase. In this repository it has:

- no live routes, navigation entries, or public copy;
- no pricing, API, dispatch state machine, fleet/crew/vehicle domain, GPS/ETA
  pipeline, or hospital-acknowledgement flow;
- no counting toward Kaya's pilot readiness or release verdict.

It proceeds, if at all, only as the isolated synthetic R0–R14 workstream, and a
valid `LIMITED_GO` there still requires a separate two-person human activation
for one exact approved scope. Nothing in Kaya core may imply that Response
exists as a live capability.

## 3. Evidence required before ANY future emergency or hospital claim

A hospital-integration, pre-alert, reduced-wait, priority, or emergency-
coordination claim may be re-introduced **only** when every item below is
supplied, reviewed by the accountable human owner (see
[governance model](KAYA_GOVERNANCE_MODEL.md)), and current at release time.
Code and marketing approval alone are never sufficient.

| # | Required evidence | Accountable owner |
| --- | --- | --- |
| 1 | Signed authority/partnership agreement with each named hospital or operator | product_owner + legal counsel |
| 2 | Licensed operator and 24/7 medical control for the claimed pathway | medical_director |
| 3 | Interface/integration test against the real hospital/operator system | security_lead + operations_owner |
| 4 | Availability evidence (uptime, coverage hours) for the claim as worded | operations_owner |
| 5 | Exact geography the claim applies to; no nationwide implication | product_owner |
| 6 | Network/connectivity testing under real field conditions | operations_owner |
| 7 | Incident and failure process for the pathway | incident_commander |
| 8 | Clinically and legally approved copy, per locale | clinical_safety_lead + privacy_dpo |

Until all eight are satisfied and the relevant release-board gate is `APPROVED`
with unexpired, environment-matched evidence, the claim stays out of every
locale and surface, and the copy-contract test keeps it out.
