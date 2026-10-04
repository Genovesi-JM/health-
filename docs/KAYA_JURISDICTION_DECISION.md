# Kaya jurisdiction planning decision

## Current target markets

**Updated 4 October 2026. The user selected Angola and Portugal as launch markets, with Angola prioritised.** Luanda remains the initial Angola planning location; Portugal preparation proceeds alongside the first Angola journey. The user's instruction is the product-planning decision and does not require another market-selection confirmation.

The [product and launch plan](../PRODUCT_AND_LAUNCH_PLAN.md#launch-market-and-delivery-decision) records the work order, country-specific preparation and selected React Native/Expo standalone mobile application with the existing React web/PWA and FastAPI backend. Market preparation must cover separate provider eligibility, service locations, consent/privacy documents, operational contacts and commercial configuration. Each market's launch readiness is evaluated separately.

The canonical Phase 1 policy now includes explicit AO/PT planning metadata and generated web/mobile/backend copies. The existing Luanda pilot perimeter and release restrictions remain unchanged; target-market metadata does not activate care in Portugal. The historical evidence below records what was assessed on 14 September, not a current verification of the repository or live services.

## Historical decision from 14 September 2026

Recorded 14 September 2026. **Angola — Luanda was the user-selected planning market. Clinical launch was HOLD; execution was synthetic-only.**

The user explicitly selected “Angola — Luanda” in this task in response to a planning-only market question. This records that human product-planning choice. It is not a clinical, legal, privacy, security, professional-licensing, hosting, or operating approval. No clinic, legal entity, clinician, data controller, emergency partner, payment arrangement, or launch date was approved by that selection. The agent has not supplied a signature or approval on anyone's behalf.

The evidence reviewed below is repository source at Phase 1 starting HEAD `d6d99953846602ab411822cfa616e4c753f41ed7`. Historical documentation and configuration are evidence of prior assumptions, not evidence that services or contracts exist. No live service, provider, database, or deployment was inspected for this decision.

## Historical policy record

The [canonical policy](../policy/kaya_phase1_policy.json) is the machine-readable authority; the [generated capability matrix](KAYA_CAPABILITY_MATRIX.md) maps its states to routes, copy and flags. Generated web/mobile/backend copies are derived views, not independent jurisdiction decisions.

| Field | Current record |
| --- | --- |
| `planning.country_code` / `planning.country_name` / `planning.city` | `AO` / `Angola` / `Luanda` |
| `planning.decision_status` / `planning.approval_scope` / `planning.decision_date` | `SELECTED_BY_USER` / `planning_only` / `2026-09-14`; `planning.decision_quote` records the explicit task response above |
| `planning.formal_jurisdiction_status` | `BLOCKED_EXTERNAL`: a signed, scoped jurisdiction decision from the accountable operator/product decision maker has not been supplied; planning selection does not supply that signature |
| Alternative considered | Spain-first, suggested by the existing Azure foundation documentation; not selected for this pilot |
| Draft workflow | Invited adult routine primary-care appointment coordination at one clinic; see [pilot scope](KAYA_PILOT_SCOPE.md) |
| `release.status` / `release.approved_jurisdictions` | `HOLD` / `[]`; no jurisdiction is approved for clinical release |
| Release permissions | `release.real_participants_enabled=false`, `release.external_communications_enabled=false`, `release.provider_calls_enabled=false`; unknown jurisdiction uses `informational` profile |
| Required identities | `pilot.operator_id`, `pilot.clinic_id`, `pilot.clinical_owner_id`, `pilot.data_controller_id` are all `null`; each `pilot.owners` record has `assigned_person=null`, `status=BLOCKED_EXTERNAL` |
| Dates | Planning decision dated; pilot start, end, and release approval dates unset |
| Review trigger | Any change in care location, clinic, operator, workflow, language, host/processor, participant group, or commercial model |

The choice is based on the user's stated planning preference. Angola-focused product copy and defaults make that choice consistent with part of the existing source, but do not establish demand, lawful operation, professional authority, or clinical safety. This document does not rank the jurisdictions by legal difficulty or invent a regulatory conclusion.

The selected planning market must come from the explicit reviewed policy. Language, currency, IP address, device locale, translation availability, and Azure region must never infer or expand a supported jurisdiction. An unknown jurisdiction receives informational content only; all care workflows stay disabled.

## Historical Spain and Angola comparison

Each row identifies the decision and evidence still required. Both alternatives remain unapproved for patient use.

| Dimension | Spain-first alternative | Selected Angola/Luanda planning case | Accountable role and required evidence |
| --- | --- | --- | --- |
| Operator | No Spanish operating entity or operating authority is identified in the reviewed source. | No Angolan operating entity or operating authority is identified in the reviewed source. | Product owner and qualified local counsel: name the entity, place of operation, contractual role, liabilities, and jurisdiction-specific authorization requirements. The product plan already lists entity/controller identification as a gate. |
| Licensed clinic | No named Spanish clinic with signed participation and service capacity evidence. | One Luanda clinic is required; identity and participation remain TBD. Generic “partner clinic” copy does not identify a contracting clinic. | Clinic partner owner: named clinic, verified operating scope, agreement, exact site, accountable staff, coverage, and stop authority. |
| Clinical owner | No appointed clinical governance owner for a Spanish workflow. | No appointed clinical governance owner for the Luanda workflow. | Independent clinical safety lead: named qualified owner, workflow review, eligibility/exclusion rules, local escalation instructions, and signed scope. |
| Data controller | Controller/processor roles and applicable obligations have not been determined for this alternative. | Controller/processor roles and applicable obligations have not been determined for the selected case. | Privacy lead and qualified counsel: documented roles, purposes, lawful basis, consent/capacity rules, retention, access boundaries, data-rights handling, and agreements. |
| Emergency pathway | Existing English disclaimer mentions an EU number; that text is not an approved pathway for any pilot site. | Luanda-specific emergency instructions and the clinic's escalation responsibilities are unverified. No number, hospital, transport, dispatch, or notification partner is selected here. | Clinical and operations owners: authoritative local-source review plus clinic-approved user instructions and escalation handling. Emergency care stays outside Kaya's workflow. |
| Language | Spanish translations exist but have no recorded comprehension or local legal/clinical wording review. | Existing `pt` interface locale is the draft language; Angolan Portuguese wording and comprehension review are required. English/French/Spanish/Chinese availability does not extend market scope. | Language/accessibility reviewer plus clinical/privacy owners: approved wording, accessible presentation, comprehension evidence, and explicit language eligibility. |
| Payments | EUR-related code and commercial hypotheses do not prove a supported processor, settlement arrangement, or legal pricing model. | AOA defaults and Multicaixa/other payment copy do not prove contracts, refunds, taxes, payouts, or processing readiness. All payments are excluded from this pilot. | Commercial owner and qualified counsel: separately approved future commercial scope and provider evidence before any later payment phase. |
| Provider contracts | No agreement or approval is established by optional Azure, AI, video, email, storage, or payment configuration. | Same gap, assessed for the exact Luanda workflow and controller/operator roles. AI/video/payments/credential automation/external messaging remain disabled. | Privacy and integration owners: processor inventory, contractual role, data categories, purpose, subprocessors, access, retention, failure behavior, and dated approvals. |
| Hosting and transfers | Source defines an empty `spaincentral` foundation; no application runtime, approved data flow, recovery proof, or live readiness follows from it. | The same proposed Spanish hosting location may remain a technical hypothesis only. The effect of processing Luanda-related data there requires an explicit transfer/hosting decision; this task makes no legal finding. | Infrastructure and privacy owners with qualified counsel: exact hosting/backup/log/support locations, data-flow and transfer review, agreements, least privilege, restore evidence, and approved deployment digest. |

The product plan identifies these external launch gates in [section 6](../PRODUCT_AND_LAUNCH_PLAN.md#6-safety-privacy-and-operational-controls-required-before-public-launch). The Azure foundation describes its empty scope and `spaincentral` assumption at [lines 1–13](../infra/azure/README.md#L1), both database destinations at [lines 44–56](../infra/azure/README.md#L44), public authenticated endpoints at [lines 84–90](../infra/azure/README.md#L84), and Angola-specific review gates at [lines 124–128](../infra/azure/README.md#L124). No legal or medical factual determination has been substituted for those required reviews.

## Source contradictions and their planning disposition

| ID | Source evidence | Contradiction / disposition |
| --- | --- | --- |
| J01 | [Azure foundation title and region](../infra/azure/README.md#L1); [Angola landing copy, `lp.hero_badge`](../frontend/src/i18n/translations.ts#L2716); [Luanda map default](../frontend/src/pages/MapaPage.tsx#L41) | Spain-first infrastructure language and Angola/Luanda product targeting coexisted. User selection now fixes the planning market to Luanda; it does not authorize a region change, deployment, or transfer. |
| J02 | [Professional onboarding country options/default](../frontend/src/pages/ProfessionalOnboardingPage.tsx#L277); [mobile country choices](../mobile/src/screens/RegisterScreen.tsx#L13) | Country lists and defaults can imply multiple supported jurisdictions. The pilot permits only the selected planning perimeter; country selectors are not proof of professional authority or approved care location. |
| J03 | [Non-emergency product definition](../PRODUCT_AND_LAUNCH_PLAN.md#L12); [hospital/pre-alert and safety claims, `urg.title2` / `urg.subtitle_post`](../frontend/src/i18n/translations.ts#L2101); [guaranteed emergency SLA, `emp.f5_desc`](../frontend/src/i18n/translations.ts#L2152) | Public copy promises effects beyond a coordination service. Kaya Response, hospital pre-alerts, transport, guaranteed response, reduced waiting, and safety-outcome claims are outside the pilot. Source presence is not evidence of an integration. |
| J04 | [Commercial hypotheses](../PRODUCT_AND_LAUNCH_PLAN.md#L41); [payment-method claims, `price.a2`](../frontend/src/i18n/translations.ts#L2700); [AOA payment request default](../backend/app/routers/payments.py#L46) | Displayed methods and currency defaults can resemble an available commercial service. No payment, payout, subscription, device financing, or pricing claim is part of the selected pilot. |
| J05 | [Patient and clinician journeys](../PRODUCT_AND_LAUNCH_PLAN.md#L43); [family/prescription/readings copy, `pat.subtitle`](../frontend/src/i18n/translations.ts#L2508) | Broad journeys include triage, payment, prescribing, family profiles, measurements, and follow-up care. The selected wedge ends at appointment coordination and administrative closure; clinical delivery remains outside this software pilot. |
| J06 | [24/7 copy, `pat.trust3`](../frontend/src/i18n/translations.ts#L2583); [online booking 24/7, `clin.cb1_title`](../frontend/src/i18n/translations.ts#L2373) | No approved staffing or response rota supports a continuous-service promise. Proposed pilot windows are bounded and inactive until approved; outside them, the system cannot promise review or accept an unsupported queue. |
| J07 | [Video fallback](../frontend/src/utils/video.ts#L10); [unresolved cloud/workflow blockers](AZURE_PILOT_STATUS.md#L42) | A public video default and historical SDK tests are not provider contracts or launch evidence. Video is excluded and live providers stay disabled. |
| J08 | [One-database product description](../PRODUCT_AND_LAUNCH_PLAN.md#L9); [two configured database URLs](../backend/app/config.py#L50); [two destinations](../infra/azure/README.md#L46) | The source has distinct main and accounts stores. Privacy, migration, backup, and access review must cover both; no store is merged or migrated by the market selection. |
| J09 | [Historical startup instructions](../infra/azure/README.md#L115); [historical Azure status](AZURE_PILOT_STATUS.md#L57); [Phase 0 status](KAYA_EXECUTION_STATUS.md) | Older instructions predate the Phase 0 hold. They are historical preparation notes, not authority to select a runtime mode, seed, migrate, or launch the preserved application. |

These contradictions remain tracked work until the relevant source, copy, tests, and approved deployment evidence are reconciled. This decision document does not itself claim those surfaces have been remediated.

## External decisions recorded open on 14 September

| Gate | Status / approver | Evidence required before real participation |
| --- | --- | --- |
| Formal jurisdiction adoption | BLOCKED_EXTERNAL / OPEN; accountable operator/product decision maker unassigned | Dated signed decision for Angola/Luanda, exact workflow and scope; this remains separate from clinical/legal approval |
| Operator and clinic | OPEN; product/clinic owner and local counsel unassigned | Named legal operator and one verified Luanda clinic, agreed responsibilities and capacity |
| Clinical workflow / emergency exclusion | OPEN; independent clinical owner unassigned | Reviewed scope, exclusions, local emergency instructions, escalation handling, coverage, and stop decision |
| Privacy / hosting / transfers | OPEN; privacy lead and qualified counsel unassigned | Approved data map for both stores and every processor/location, purpose and access rules, retention, rights handling, contracts |
| Language / accessibility / comprehension | OPEN; reviewers unassigned | Angolan Portuguese and accessible-flow review; meaningful human comprehension evidence |
| Security / operations | OPEN; independent security reviewer and operations owner unassigned | Negative boundary tests, current exact-environment evidence, restore/incident exercises, support/availability rota |
| Pilot launch | OPEN; release board unassigned | Exact scope, participant cap, dates, hours, immutable artifact and approved residual-risk evidence |

All gates are due before real enrollment or provider activation. Evidence dates, approval signatures, and expiry dates remain unset. Safely isolated Phase 1 planning and synthetic policy checks can proceed while these gates are open; they cannot authorize a clinical launch.
