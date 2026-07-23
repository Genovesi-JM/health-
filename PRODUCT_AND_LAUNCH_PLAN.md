# KAYA — Product, Business and Launch Plan

## 1. Product definition

KAYA is a digital-health coordination business for patients, clinicians, clinics and employers. The product surface is intentionally limited to:

- a responsive web platform and installable PWA;
- one Expo mobile application distributed to iOS and Android;
- one shared API and database;
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
- clinician registration, verification state, dashboard, profile, queue, agenda, patients, live consultations, prescriptions, messages, finance, reviews, security and support;
- admin dashboard, clinician verification and patient administration;
- installable PWA with API responses excluded from offline caching.

### Mobile app

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

Use a small verified clinician group and invited patients. Disable unconfigured payment providers and AI fallbacks that could be mistaken for clinical advice. Measure completion, safety escalations and support load.

### Paid beta

Enable one jurisdiction, one settlement method and a narrow set of specialties. Introduce documented support hours, refunds and clinician service-level expectations.

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

KAYA is launch-ready only when the web build and mobile type checks pass, backend tests pass against the production schema, a staging end-to-end journey succeeds for every role, all external launch gates in section 6 have named owners, and production monitoring plus rollback procedures are active.
