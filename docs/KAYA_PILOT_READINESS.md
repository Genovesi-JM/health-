# Kaya pilot readiness board & named-owner roundup (Phase 41)

The single, structured register of every external gate produced across Phases
0–40, each mapped to the accountable owner role and a fail-closed status. Backed
by `backend/app/pilot_readiness.py`; nothing is `READY` until a **named non-agent
owner** signs the evidence.

## Overall status — **NOT READY (NO-GO)**

- Total gates: **20**  ·  READY: **0**  ·  BLOCKED_EXTERNAL: **6**  ·  OPEN: **14**
- `overall_ready`: **false** (fail-closed — every gate must be signed READY).
- Owner roles that must still act: **clinical_safety, privacy, security,
  infrastructure, finance, data_controller, release_board**.

This is the correct, honest state: enforceable policy and tests are prepared; the
named human release board must clear these gates and sign off before any
production release. The agent has not — and cannot — mark any gate READY.

## The register

| Gate | Phase | What a named owner must do | Owner role | Status |
| --- | --- | --- | --- | --- |
| G-JURISDICTION | P1 | Signed jurisdiction/operator adoption (Angola/Luanda) | release_board | OPEN |
| G-TRIAGE-VALIDATION | P20 | Independent clinical validation of triage rules + multilingual corpus | clinical_safety | OPEN |
| G-EMERGENCY | P21 | Emergency exclusion wording + failed-escalation drills | clinical_safety | OPEN |
| G-PG-CONCURRENCY | P23 | PostgreSQL booking concurrency evidence under replicas | infrastructure | BLOCKED_EXTERNAL |
| G-VIDEO-PROVIDER | P25 | Approved video provider: DPA, region, security, accessibility, retention, clinical fallback | privacy | BLOCKED_EXTERNAL |
| G-NOTE-ORM | P26 | Clinical-note sign/lock + amendment ORM adoption; retention schedule | clinical_safety | OPEN |
| G-DRUG-KB | P27 | Licensed, validated drug-safety knowledge base + jurisdiction mapping | clinical_safety | OPEN |
| G-MSG-REDFLAGS | P28 | Emergency red-flag review/localization + message retention | clinical_safety | OPEN |
| G-MALWARE-SCAN | P29 | Malware scanner integration; encryption-at-rest; EXIF/metadata policy | security | BLOCKED_EXTERNAL |
| G-AI-DPA | P30 | External-AI DPA + region/transfer + de-identification validation | privacy | BLOCKED_EXTERNAL |
| G-VITALS-RANGES | P31 | Validated physiological ranges + critical-alert policy | clinical_safety | OPEN |
| G-BACKUPS-DR | P32 | Encrypted offsite PITR backups + tested restore; clinical cascade migration | infrastructure | BLOCKED_EXTERNAL |
| G-INFRA-PRIVATE | P33 | Close ACR/Storage/Key Vault public access; network design; secret rotation | infrastructure | OPEN |
| G-DR-DRILL | P34 | Failover drill (RPO/RTO) + signed incident runbook + topology | infrastructure | OPEN |
| G-SUPPLY-CHAIN | P35 | SBOM + advisory triage + CI SHA-pinning + provenance | security | OPEN |
| G-AUDIT-STORE | P36 | Tamper-evident audit store adoption + PII-scrub verification + alerting | security | OPEN |
| G-CLIENT-CSP | P37 | R18 token-storage mitigation + strict CSP + comprehension study | security | OPEN |
| G-PAYMENTS | P38 | Payment provider DPA/PCI/settlement/refund/tax/currency | finance | BLOCKED_EXTERNAL |
| G-ROPA-DPA | P39 | Complete ROPA + signed sub-processor DPAs + DSAR/breach runbooks | data_controller | OPEN |
| G-STAGING | P40 | Isolated synthetic staging + gate clearance + six sign-offs | release_board | OPEN |

## How a gate becomes READY

1. The named owner completes the work and attaches dated evidence.
2. The Phase 2 governance release board records the sign-off (separation of
   duties; the coding agent's role is `approval_prohibited`).
3. `pilot_readiness` marks the gate READY **only** with a named non-agent signer.
4. When every gate is READY, `preflight` (Phase 40) can return GO — and only then,
   with the six role sign-offs, does clinical release move off HOLD.

## Tests — `backend/phase41_tests/test_pilot_readiness.py` (7, all passing)

Well-formed gates; unknown owner role rejected; READY requires a named non-agent
signer; the default register is complete and starts with nothing READY;
fail-closed summary; overall-ready only when all signed; owners-needed listing.

**Clinical release stays HOLD.**
