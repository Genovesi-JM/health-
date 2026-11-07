# Kaya legal & regulatory issue matrix — Angola (Phase 10)

Evidence date 14 September 2026. Jurisdiction (planning-only): **Angola / Luanda**.

> **This is issue-spotting by an engineering agent. It is NOT legal advice and NOT
> an approval.** Every determination below must be made by qualified local
> healthcare and privacy counsel, the licensed care provider, and any required
> regulator. No item here authorizes any capability. All source citations must
> have their **currency and version re-verified at execution time**; nothing here
> asserts GDPR certification, medical-device status, regulator approval, or
> "jurisdiction supported".

## Primary official sources (verify currency at execution time)

APD (data-protection authority) and Lei n.º 22/11; MINSA and the Lei de Bases do
Sistema Nacional de Saúde; ARMED (medicines/health-technology regulation, Decreto
Presidencial 136/21); Decreto Presidencial 202/11 (clinical information /
confidentiality); the relevant professional Order (Ordem dos Médicos /
Enfermeiros); INACOM (telecom/electronic-communications) where applicable; and
primary legislation. A second jurisdiction (e.g. Spain: BOE/AEPD/EU/MDR/AI
Act/EHDS) stays **disabled** and cannot inherit Angola approvals.

## Issue matrix

| # | Issue area | Official source (verify) | Uncertainty (counsel question) | Evidence required | Affected feature flag |
| --- | --- | --- | --- | --- | --- |
| L01 | Operating entity / data controller | Company/APD | Who is the legal operator and controller in Angola? | Registered entity + controller determination | account_access / all |
| L02 | Licensed care provider | MINSA / Lei de Bases | Which licensed clinic provides the care; scope? | Licence + contract | booking / consultation |
| L03 | Medical director / record custodian | Professional Order / Decreto 202/11 | Named accountable clinical owner and record custody? | Appointment + custody agreement | clinical_records |
| L04 | Professional regulation | Ordem dos Médicos/Enfermeiros | Registration/scope rules for participating clinicians? | Verified registrations | credentialing |
| L05 | Health-service authorization | MINSA | Is authorization required to operate the service? | Authorization or confirmation not required | all clinical |
| L06 | Telemedicine rules | MINSA | Conditions/limits for teleconsultation? | Reviewed rules + approved workflow | video / teleconsult |
| L07 | Prescribing rules | ARMED / MINSA | Legality of digital prescription and dispensing path? | Counsel opinion; no own e-Rx until approved | prescribing |
| L08 | Medical-software classification | ARMED | Is any Kaya component a regulated medical device? | Classification determination | triage / AI |
| L09 | AI obligations | APD / MINSA | Constraints on any AI use in health? | Determination; AI stays disabled meanwhile | ai_assist |
| L10 | Privacy authority (APD) | APD / Lei 22/11 | Lawful basis, notification/authorization, transfers? | APD compliance record; residency decision | all (data) |
| L11 | Consumer / e-commerce | Primary law | Consumer-protection and distance-contract duties? | Reviewed terms | payments / marketing |
| L12 | Incident authority | APD / MINSA | Breach and clinical-incident reporting duties? | Reporting playbook + authority contacts | operations |
| L13 | Insurance | Lei de Bases | Professional indemnity for private practice? | Proof of insurance per clinician | credentialing |
| L14 | Emergency information | MINSA / local | Correct emergency number and non-emergency wording? | Authoritative local source + clinical review | emergency copy |

## Consent vs lawful basis (kept distinct)

Clinical informed consent (for care) is **separate** from the lawful basis for
personal-data processing. A consent checkbox is **not** the default answer to
every health-data use — see [data inventory](KAYA_DATA_INVENTORY.md) and the
versioned consent ledger (Phase 15). Counsel determines the lawful basis per
purpose.

## Legal documents are draft / launch-blocking

Terms of service, privacy policy, medical disclaimer, consent text, prescribing
copy, and emergency copy are **draft placeholders**. They are **launch-blocking**
until reviewed and versioned by counsel and must never be presented as approved
policy. Under the hold they are not mounted; when the app leaves hold, the
release board (governance) blocks any release whose legal-copy gate is not
`APPROVED` with a versioned document.

## Counsel questions (feature- and data-flow-specific)

Each row's "counsel question" is scoped to a specific feature and data flow (not
"approve the app"). Counsel answers become dated evidence bound to the affected
feature flag; until then the flag stays off.

## Human / external gate

Local healthcare and privacy counsel, the licensed care provider, and any
required regulator must provide the actual determinations and approvals. This is
**BLOCKED_EXTERNAL** for every row above.
