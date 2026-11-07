# KAYA — Product, Business and Launch Plan

## Launch market and delivery decision

**4 October 2026. Angola is the first launch market; Portugal is the second target market and must be prepared in parallel.** The user selected both markets and delegated the delivery-platform decision. Luanda remains the initial Angola planning location from the earlier decision. Portugal's initial city and partner network remain to be selected.

The chosen architecture is React/TypeScript web and PWA, React Native with Expo for standalone iOS and Android applications, and the shared FastAPI backend. The user agreed to proceed after clarifying that patients install Kaya itself and do not need Expo Go. Prioritise the responsive web/PWA pilot while completing mobile against the same API. Keep FlutterFlow as a design/prototype reference, with production source maintained in `health-`.

This choice preserves the existing web and mobile implementation, API contracts, backend controls and tests. Use development builds during implementation and standalone release builds for distribution. Expo supports custom native modules and optional hosted build services; see the [Expo documentation](https://docs.expo.dev/faq/). The mobile client still needs dependency compatibility review, completed account and consultation workflows, and physical-device validation. Existing source and passing type checks alone do not establish readiness.

### Preparation for both markets

Use one maintained product and backend codebase with explicit country configuration. Country-specific deployments and data boundaries must remain possible; sharing code does not require combining every country's records in one database.

| Area | Angola first | Portugal preparation |
| --- | --- | --- |
| Delivery order | First complete care journey, provider onboarding, pilot validation and launch preparation; initial focus Luanda | Build configuration and test coverage alongside Angola; activate services after Portugal-specific readiness is established |
| Language and formatting | Angolan Portuguese copy, local addresses and phone formats; AOA currency configuration | European Portuguese copy, local addresses and phone formats; EUR currency configuration |
| Availability | Explicit clinic location and timezone for slots and notifications | Explicit clinic timezone with daylight-saving handling where applicable; avoid a fixed countrywide UTC offset |
| Professionals and services | Angola-specific provider directory, credential workflow, service areas and operational contacts | Separate Portuguese directory, credential workflow, service areas and operational contacts |
| Consent and records | Versioned market-specific documents and access rules | Separate document versions and market-specific privacy, retention and data-rights review |
| Commercial setup | Prepare amount/currency/provider configuration; implement and activate payments in the final phase | Prepare EUR and provider configuration; implement and activate payments in the final phase |

The patient's chosen service country and the clinician's verified scope determine care eligibility. Language, currency, device location and interface country selectors do not by themselves grant care access. Cross-border consultations require an explicit supported workflow; preparing both markets does not automatically enable them.

Design the Angola pilot for usable mobile screens, modest data use and clear interrupted-connection recovery. Country configuration, consent versions, availability and permissions must be tested for both AO and PT from the start. Portugal preparation should not delay completion of the first Angola journey.

### Development order

1. Reconcile the local repository, remote branch and 4 October consultation changes into a verified development baseline. The development chat reports those changes as locally committed; integration and device testing must be checked before counting them as delivered.
2. Complete the Expo standalone application setup and explicit AO/PT market configuration, country-specific formatting, clinic timezones, service eligibility and automated coverage. Preserve release controls while adding preparation for Portugal.
3. Complete accounts, roles, recovery, consent, private document handling and professional verification for the Angola journey, using extensible country rules.
4. Complete availability, booking, acceptance, cancellation/rescheduling, consultation access, documented closeout and follow-up. Validate the web flow and native devices against the same backend contracts.
5. Finish provider/pharmacy discovery, GPS/directions, records and controlled family access. Live stock, dispatch and other partner services depend on confirmed integrations.
6. Complete payments, refunds and reconciliation in the final implementation phase, following the user's existing priority. Country/currency modelling belongs in the foundations so this phase does not require a redesign.

Launch readiness is assessed separately for each market. This decision settles product priorities and the delivery platform; it does not record a deployment, provider contract or completed clinical/privacy review. The Phase 1 machine-readable policy now records both target markets. Its current release restrictions remain in force; implementing configuration does not complete the operational journeys.

## 1. Product definition

KAYA is a digital-health coordination business for patients, clinicians, clinics and employers. The product surface is intentionally limited to:

- a responsive web platform and installable PWA;
- one React Native/Expo mobile application targeting iOS and Android;
- a shared API and data model, with explicit country boundaries and deployment/storage separation where required;
- an optional native Swift prototype, retained for reference but not required for the cross-platform launch.

KAYA is not an emergency service and does not replace a licensed clinician. Automated triage and AI features provide orientation only. Clinical decisions, diagnoses, prescriptions and referrals remain with verified healthcare professionals.

## 2. Customer segments and value proposition

### Patients

One account for triage, consultations, prescriptions, health measurements, chronic-care follow-up, notifications, family profiles and clinical history.

### Doctors and specialists

Patient acquisition, a verified public profile, agenda and queue management, teleconsultation workflow, SOAP notes, prescriptions, referrals, messaging and financial reporting.

### Clinics and hospitals

A digital intake and follow-up channel that extends existing clinical capacity without requiring a separate patient application.

### Employers

Employee enrolment and aggregated operational KPIs, with no inappropriate access to individual clinical records.

## 3. Revenue model

The software supports four revenue lines:

1. commission or service fee on paid consultations;
2. subscription plans for clinicians and clinics;
3. corporate plans priced per enrolled employee or active member;
4. optional chronic-care programmes and compatible monitoring kits.

Prices displayed in the product are commercial hypotheses until the legal entity, payment provider, taxes, refunds, clinician payout rules and local currency are confirmed. No production checkout should silently fall back to a simulated payment.

## 4. Core launch journeys

### Patient journey

Register → verify account → accept required consents → create patient profile → complete triage → select a verified clinician and slot → pay where required → attend consultation → receive follow-up, prescription or referral → manage readings and family members.

### Clinician journey

Apply → identity and licence verification → complete public profile → configure availability and pricing → accept consultation → review relevant patient context and consent → conduct consultation → record SOAP notes → issue signed documents where legally permitted → receive settlement.

### Admin journey

Verify clinicians → manage users and public contact channels → monitor safety, audit events, service performance and revenue → handle support, refunds, incidents and data-rights requests.

## 5. Implemented product scope

### Website and PWA

- public landing, service, pricing, doctor, clinic, employer, device, FAQ and contact pages;
- patient registration, login, OAuth callback, consent gating and role-based navigation;
- patient dashboard, profile, triage, self-care, consultations, prescription requests, family, readings and notifications;
- photo-assisted skin/injury triage with private guided capture, structured visual questions, fixed red-flag escalation and linked-clinician review (no image diagnosis);
- clinician registration, verification state, dashboard, profile, queue, agenda, patients, live consultations, prescriptions, messages, finance, reviews, security and support;
- admin dashboard, clinician verification and patient administration;
- installable PWA with API responses excluded from offline caching.

### Mobile application

The following capabilities exist in the preserved Expo source. The current default entry is informational; operational activation, native integration and real-device testing remain outstanding. These entries describe source coverage, not live service availability.

- one TypeScript/Expo codebase for iPhone and Android;
- secure token storage;
- onboarding, registration, login and consent gate;
- patient home, profile, measurements, notifications and settings;
- consultation booking, prescription requests and family management;
- shared API contracts with the website.

### Backend

- authentication, refresh/session support and role-based access control;
- patient, clinician, consultation, triage, prescription, referral, family, readings, notification, corporate and billing domains;
- audit/compliance endpoints, health checks and deployment configuration;
- PostgreSQL/Redis deployment path and object-storage abstraction.

## 6. Safety, privacy and operational controls required before public launch

These items cannot be completed by source code alone and are launch gates:

- incorporate or identify the operating legal entity and data controller;
- appoint the clinical governance owner and define supported jurisdictions;
- obtain legal review of terms, privacy notice, medical disclaimer, consent wording, retention periods, age rules and professional liability allocation;
- execute processor agreements with hosting, email, storage, analytics, support and payment providers;
- confirm health-data hosting location, backup policy, disaster recovery, breach response and data-rights workflow;
- define clinician identity/licence verification, prescribing rules, escalation protocols and malpractice/indemnity requirements;
- configure real payment credentials, webhook secrets, taxes, refunds, disputes and clinician settlements;
- configure a production email domain, sender authentication, support inbox and escalation rota;
- complete security review, dependency remediation, penetration testing and restore testing;
- prepare App Store and Play Store accounts, privacy disclosures, screenshots, support URL and review credentials.

## 7. Commercial launch sequence

### Private pilot

Prioritise Angola, initially Luanda, with a small verified clinician group and invited patients after the relevant pilot gates are met. Prepare Portugal configuration and workflows in parallel. Disable unconfigured payment providers and AI fallbacks that could be mistaken for clinical advice. Measure completion, safety escalations and support load.

### Paid beta

Start the paid beta in Angola after the final payments phase, using one verified settlement method and a narrow set of specialties. Introduce documented support hours, refunds and clinician service-level expectations. Portugal follows its own provider, operational and release-readiness assessment.

### General availability

Expand only after legal/clinical sign-off, stable payment reconciliation, tested incident response and acceptable pilot KPIs.

## 8. Operating metrics

- visitor-to-registration conversion;
- registration-to-profile and consent completion;
- triage completion and emergency-escalation rate;
- consultation search-to-booking conversion;
- clinician acceptance time, no-show rate and consultation completion;
- prescription/referral turnaround time;
- 30-day patient retention and chronic-care adherence;
- gross booking value, take rate, refunds and clinician payout accuracy;
- support response/resolution time;
- safety incidents, privacy incidents and failed access attempts.

## 9. Repository policy

`health-` is the single source of truth and should be renamed to `kaya` when convenient. The separate `kaya-ios` repository is an older, incomplete duplicate and may be archived after confirming the consolidated repository has been pushed and backed up.

## 10. Definition of launch-ready

KAYA is launch-ready only when the web build, mobile type checks/tests and platform release builds pass, backend tests pass against the production schema, the core journeys pass on physical iOS and Android devices, a staging end-to-end journey succeeds for every role, all external launch gates in section 6 have named owners, and production monitoring plus rollback procedures are active. Web/PWA pilot readiness can be assessed separately from the full mobile release.
