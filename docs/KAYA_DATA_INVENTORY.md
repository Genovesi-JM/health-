# Kaya data inventory, minimization, retention & transfer (Phase 9)

Evidence date 14 September 2026. Why Kaya holds each field, where it may travel,
and when it must be deleted or retained. **Lawful basis is a question for
counsel, not a Kaya decision** — every row's `lawful-basis` is a placeholder the
privacy/legal owner must resolve for the chosen jurisdiction. Cross-border and
third-party flows stay **disabled** until an approved processor record exists.

Redaction of secrets/tokens/MFA seeds/recovery codes/signed URLs/payment
details/provider payloads/raw clinical text from logs, errors and serialized
payloads is enforced in code by [`backend/app/redaction.py`](../backend/app/redaction.py)
and tested in [`backend/phase9_tests`](../backend/phase9_tests).

## Classification scale

`PUBLIC` · `INTERNAL` · `PII` · `SENSITIVE_PII` · `HEALTH` (special category) ·
`SECRET`. HEALTH and SECRET are never logged in the clear and never leave the
approved locality without an approved transfer record.

## Field inventory (by category)

Columns: **classification · purpose · lawful-basis (for counsel) · owner ·
recipients · locality · retention · deletion trigger · export rule · logging**.

| Category | Representative fields | Classification | Purpose | Retention / deletion | Logging |
| --- | --- | --- | --- | --- | --- |
| Identity | email, password_hash, role | PII / SECRET | Authenticate | Account lifetime; delete on erasure unless legal hold | Never log hash/token |
| Contact | phone, address | PII | Coordination | Account lifetime; minimize | Redact in logs |
| Demographic | dob, gender | SENSITIVE_PII | Care eligibility | Only if pilot-required; else optional | Never in logs |
| Health | conditions, allergies, readings | HEALTH | Care | Medical-record legal retention; legal hold | Never in the clear |
| Triage | answers, risk_level | HEALTH | Routing | Episode retention | Never in the clear |
| Image | photos, documents | HEALTH | Clinical context | Episode retention; AV-quarantined | Never (redact `photo`/`image_data`) |
| Device | readings, provenance | HEALTH | Monitoring | Episode retention | Never in the clear |
| Credential | licence, diploma, evidence | SENSITIVE_PII | Verify clinician | Per credentialing policy | Redact; signed-URL only |
| Employment | corporate membership | INTERNAL/PII | Corporate plan | Contract term; **no individual clinical to employer** | Aggregate only |
| Payment | tokenized ref, last4 | SENSITIVE_PII | Billing | Tokenized ref only; no PAN stored | Never log PAN/CVV |
| Support | tickets, messages | PII/HEALTH | Assistance | Support policy | Redact clinical content |
| Audit | actor, action, entity, time | INTERNAL | Accountability | Long retention (tamper-evident) | No health content in audit text |
| Telemetry | metrics, error class | INTERNAL | Reliability | Short | No PII/HEALTH/SECRET |

Full per-field rows are maintained alongside the models; a new sensitive field is
review-blocked until it appears here with all attributes (test-guarded).

## Minimization

- Collect only what the invited-adult primary-care pilot workflow needs.
- Fields not required for the pilot are optional and purpose-bound, or disabled.
- Employers and unrelated support never receive individual clinical data.

## Processors, residency, and transfer

| Processor | Data | Status | Gate |
| --- | --- | --- | --- |
| AI | (none — no clinical egress) | DISABLED / fail-closed | Approved processor + egress test (Phase 30) |
| Video | session media | DISABLED | BAA + residency (Phase 25) |
| Payments | tokenized refs | DISABLED | PCI + processor record (Phase 39) |
| Credential verifier | credential evidence | DISABLED | Processor record (Phase 17) |
| Email/SMS | contact | DISABLED | Processor record (Phase 28) |
| Object storage | photos/documents | signed-URL only | Residency + access record (Phase 29/33) |

**Data residency versus access** are distinct: where data is stored, and who may
reach it, are separately gated. No cross-border transfer is enabled until its
record is approved by the privacy/legal owner (APD-relevant for Angola).

## Logging prohibitions (enforced)

Never emit to a log, error body, metric, screenshot, or model prompt: passwords,
password hashes, tokens, authorization headers, API keys, MFA/TOTP seeds,
recovery codes, private keys, full card numbers/CVV, IBANs, signed URLs, provider
payloads, or raw clinical text (notes, symptoms, diagnoses, triage answers, photo
bytes). `redaction.py` redacts these by pattern and by key name.

## Human/external gate

A qualified privacy/legal owner must approve lawful bases, retention periods,
controller/processor roles, and transfer mechanisms for the chosen jurisdiction
before any real data is processed. This remains **BLOCKED_EXTERNAL**.
