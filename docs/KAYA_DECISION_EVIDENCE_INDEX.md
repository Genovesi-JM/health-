# Kaya decision & evidence index (append-only)

This index ties each requirement to its code, test, build digest, environment,
reviewer, decision date, and supersession status. It is **append-only**: an
existing row is never edited or deleted — a change is recorded by appending a new
row whose `supersedes` names the prior id. The enforcement primitive is
`EvidenceIndex` / `verify_append_only` in
[`backend/app/governance.py`](../backend/app/governance.py), tested in
[`backend/governance_tests/`](../backend/governance_tests/).

Rows below carry **no secrets and no health data** (enforced by
`validate_evidence_record`). `reviewer_role` values are proposed accountable
roles; `engineering_preparer` denotes engineering preparation only and is not an
approval. No row here closes a launch gate or represents a clinical/legal/privacy
approval.

| id | requirement | code_ref | test_ref | build_digest | environment | reviewer_role | decision_date | status | supersedes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EV-P0-001 | Non-destructive baseline & synthetic-only clinical hold | `backend/app/main.py` (503/no-store default) | `phase0_tests/` | commit `d6d9995` | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |
| EV-P1-001 | Single-jurisdiction perimeter; jurisdiction not inferred from env | `backend/app/phase1_policy.py`, `backend/app/kaya_policy.json` | `phase1_tests/test_public_policy.py` | commit `7c49c1d` | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |
| EV-P1-002 | Informational-only public metadata endpoint; fail closed | `backend/app/main.py` (`GET /api/v1/public/pilot-scope`) | `phase1_tests/` | commit `7c49c1d` | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |
| EV-P2-001 | Release board fails closed; missing evidence never defaults to approval | `backend/app/governance.py::release_decision` | `governance_tests/test_governance.py` | *pending phase checkpoint* | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |
| EV-P2-002 | Risk acceptance explicit/expiring/attributable; P0 non-acceptable; no self-approval for high impact | `backend/app/governance.py::validate_risk_acceptance` | `governance_tests/test_governance.py` | *pending phase checkpoint* | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |
| EV-P2-003 | Change control requires a distinct human approver; unknown category fails closed | `backend/app/governance.py::required_reviewers`, `backend/app/kaya_governance.json` | `governance_tests/test_governance.py` | *pending phase checkpoint* | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |
| EV-P2-004 | Append-only evidence index; existing records immutable, superseded not rewritten | `backend/app/governance.py::EvidenceIndex,verify_append_only` | `governance_tests/test_governance.py` | *pending phase checkpoint* | local-synthetic | engineering_preparer | 2026-09-14 | prepared | — |

## Append rules

1. Never edit or delete an existing row. To change a decision, append a new row
   with a new `id` and set `supersedes` to the old id.
2. `build_digest` records the commit or artifact digest that carries the code and
   test; "*pending phase checkpoint*" is replaced by the commit hash once the
   phase checkpoint is created (a later append supersedes the placeholder row).
3. `reviewer_role` must be a role defined in the governance policy. A row marked
   `engineering_preparer` is preparation, never approval.
4. Rows must contain no secret or health-data content.
