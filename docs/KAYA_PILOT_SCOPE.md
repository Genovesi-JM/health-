# Kaya draft pilot scope

Recorded 14 September 2026. **Planning market: Angola — Luanda. Launch: HOLD. Only synthetic execution is authorized.** The user's market choice is recorded in the [jurisdiction decision](KAYA_JURISDICTION_DECISION.md); every operational value below is a proposed hypothesis pending named clinical, privacy, security, clinic, and operations review.

## One workflow

An invited adult requests a routine primary-care appointment at one named Luanda clinic. Authorized clinic staff check eligibility, consent status, professional authority, staffing, and an available slot; a human confirms or declines the request. The participant can view or cancel the confirmed appointment. Staff record only an administrative attendance/closure outcome and handle scheduling support. A request is never a confirmed booking, a clinical assessment, or a promise of treatment.

The clinical visit takes place under the clinic's separately approved care arrangements. Diagnosis, treatment, clinical notes, prescribing, referrals, and urgent care are outside this Kaya software pilot. Kaya does not assess urgency, produce self-care advice, dispatch transport, notify a hospital, or promise that someone has reviewed symptoms. No symptom narrative, image, vital sign, health document, or device feed is needed for this coordination workflow.

Phase 1 defines and tests the perimeter. It does not enable enrollment, the booking runtime, communications, or clinical operations. Existing clinical source remains held under the Phase 0 controls.

## Draft operating envelope

The [canonical policy](../policy/kaya_phase1_policy.json) owns these exact fields; the [generated capability matrix](KAYA_CAPABILITY_MATRIX.md) exposes capability/route/copy/flag bindings. Clients/backend consume generated copies, and cannot independently approve or broaden this scope.

These values describe a single candidate pilot, not approved service availability or clinical capacity.

| Canonical field | Proposed value / condition |
| --- | --- |
| `pilot.pilot_id` | `ao-luanda-primary-care-coordination-v1` |
| `planning.decision_status` / `planning.approval_scope` | `SELECTED_BY_USER` / `planning_only`; selected market only |
| `planning.formal_jurisdiction_status` | `BLOCKED_EXTERNAL`; scoped signed adoption not supplied |
| `pilot.planning_status` | `DRAFT_OPERATIONAL_HYPOTHESIS`; the operating envelope has not been approved |
| `release.status` / `pilot.launch_status` | Both `HOLD`; `release.approved_jurisdictions=[]` |
| `pilot.execution_mode` / real-participant permissions | `synthetic_only`; both `release.real_participants_enabled` and `pilot.real_participants_enabled` are `false` |
| `pilot.country_code` / `pilot.city` | `AO` / `Luanda`; no cross-jurisdiction service |
| `pilot.clinic_count` / `pilot.clinic_id` | Exactly 1 clinic; identifier `null` until verified and approved |
| `pilot.operator_id` / `pilot.clinical_owner_id` / `pilot.data_controller_id` | All `null`; no appointed operator, clinical owner or controller |
| `pilot.owners` | Every `assigned_person=null`, every `status=BLOCKED_EXTERNAL`; role labels are proposed responsibilities, not assignments |
| `pilot.age_min` / `pilot.invited_only` | 18 / `true`; personal participation under reviewed eligibility/consent rules; no public self-enrollment |
| `pilot.capacity.max_invited_adults` | 25 proposed invited adults; synthetic identities only during current work |
| `pilot.interface_locale` / `pilot.angolan_portuguese_review` | `pt` / `BLOCKED_EXTERNAL`; other translations are not supported pilot languages |
| `pilot.timezone` | `Africa/Luanda`; calendar arithmetic uses the named zone, never the developer machine's timezone |
| `pilot.schedule.weekdays` | `MON`, `TUE`, `WED`, `THU`, `FRI`; no weekend or 24/7 service |
| `pilot.schedule.start_local` / `pilot.schedule.end_local_exclusive` | `09:00` / `13:00`; no evening service |
| `pilot.schedule.holiday_calendar` / `staffed_dates` / `approval_status` | `null` / `[]` / `BLOCKED_EXTERNAL`; no dates are open until explicit clinic coverage approval |
| `pilot.duration_days` / `pilot.start_date` / `pilot.end_date` | 14 calendar days / `null` / `null`; no recurring or open-ended operation |
| `pilot.capacity.max_confirmed_appointments_per_day` | 5 proposed confirmed appointments per day |
| `pilot.capacity.max_pending_requests` | 5 proposed pending requests |
| `pilot.capacity.proposed_appointment_minutes` | 30 proposed minutes per appointment; no clinical capacity approval |
| `pilot.coordination_target_staffed_minutes` | 30 proposed staffed minutes for acknowledgement/human disposition; no emergency-response promise |
| `pilot.schedule.staffing_requirements` | `authorized_coordinator_count=1`, `verified_primary_care_clinician_count=1`, `approval_status=BLOCKED_EXTERNAL`; named staff/substitutes and each opened window remain unapproved |
| `pilot.commercial_hypothesis` | No Kaya charges during proposed evaluation; clinic care arrangements need separate approval and are not represented as free treatment; all payment/commercial feature flags remain false |
| `pilot.platform` | `responsive_web_pwa_only`; native iOS and Expo patient operation/store release are outside this pilot approval scope |
| `release.external_communications_enabled` / `release.provider_calls_enabled` | Both `false`; no external contact, message, payment or provider activation |

The age threshold is a product eligibility hypothesis, not a determination of the jurisdiction's age-of-consent or capacity law. The clinical/privacy reviewers must approve the actual eligibility and consent rules. Being in a country list, selecting Portuguese, or owning an invitation does not establish eligibility, identity, authority, or permission to process health data.

An unset clinic, schedule, required approval, professional status, consent state, or scope field prevents admission. Unknown, malformed, contradictory, stale, or unsupported values fail closed. An invitation cannot override a denied rule. The duration and capacity values must not be advertised as available until the named clinic and operations owners approve them.

## Workflow states and permitted data

| Step | Permitted coordination action | Required boundary |
| --- | --- | --- |
| Invitation and eligibility | Validate a scoped invitation and the reviewed adult/location/language criteria | No public signup, role self-assignment, cross-clinic access, minor/proxy enrollment, or inferred consent |
| Information and consent | Present the approved purpose, limitations, privacy information, and server-owned consent state | Missing/withdrawn/outdated consent blocks processing; access to the informational exit and support instructions must remain possible |
| Request | Request one eligible routine appointment within an explicitly staffed date/window | No clinical triage; no request after capacity/queue limits or outside approved dates/hours; no automatic confirmation |
| Human confirmation | Authorized clinic staff confirm one valid, nonoverlapping slot and assigned professional | Current credentials/privileges, clinic membership, availability and consent checked at confirmation; audit the decision |
| View or cancellation | Participant views their own appointment or requests cancellation | Default-deny identity, organization, assignment, purpose and resource checks; no unrelated patient records |
| Administrative closure | Staff record attended, cancelled, declined, or not attended for coordination analysis | No diagnosis, clinical note, prescription, referral, clinical outcome, or automated care recommendation |
| Scheduling support | Handle only access/booking administration during approved coverage | No care advice; no externally sent message or live support channel is enabled by Phase 1 |

The eventual data map must minimize identifiers, scoped invitation, reviewed eligibility status, appointment/clinic/staff references, consent version/status, timestamps, administrative state and auditable access/decision events. Exact field definitions, retention, lawful basis and access controls remain open external/design gates. Synthetic fixtures and aggregate counts are the only data used now. Operational metrics must not retain health narratives, tokens, names, emails, or unrelated individual data; privacy/clinical owners must approve any later telemetry specification.

## Explicit exclusions

- Emergency or urgent triage, reassurance/self-care scoring, hospital pre-alerts, transport/dispatch, emergency SLAs, and every Kaya Response workflow.
- Condition-specific urgent, maternity/pregnancy, mental-health crisis, post-discharge/procedure, and complex chronic-care pathways. Their eligibility and escalation rules require separate clinical approval; Kaya does not classify a person's condition or certify that a routine request is safe.
- Minors, family accounts, representatives/proxies, employer enrollment, and persons whose eligibility or consent authority is uncertain.
- Diagnosis, treatment advice, clinical decision support, clinical notes, prescribing, prescription renewal, referrals, chronic-care programmes, and clinical follow-up monitoring.
- AI/chatbot/model calls, photos/uploads, video or teleconsultation rooms, device/HealthKit/Health Connect ingestion, measurement tracking, and automated professional-verification providers.
- Public doctor/clinic marketplace, cross-clinic bookings, cross-jurisdiction care, unlimited specialties, public self-enrollment, or public clinical deployment.
- Payments, subscriptions, settlements, refunds, financing, commercial outcome claims, and external email/SMS/push/chat/contact submissions.

Exclusion messages must say that Kaya cannot accept or assess the request and must not imply that it is safe to wait. A local emergency pathway and wording must be independently approved before any real participant sees the flow. No local number or emergency partner is invented here. Existing Response/emergency copy is a contradiction to remove, not an accepted feature.

## Measurement and stop contract

The canonical `pilot.metrics` array contains the ten identifiers below with `operator`, `threshold`, `breach_action` and descriptive `owner_role` fields; sample/window/evidence requirements apply where present. `pilot.metric_status=DRAFT_REQUIRES_HUMAN_APPROVAL`. Values are hypotheses for review, not claims of measured performance. `pilot.metric_owner_labels` explicitly marks combined roles as descriptive accountability only; they do not identify or appoint a person, and all `pilot.owners` assignments remain null. Phase 1 synthetic tests can verify counting and stop behavior. They cannot establish clinical safety, real staffing performance, or human comprehension.

| Metric identifier | Definition and proposed threshold | Required response / owner |
| --- | --- | --- |
| `safety_boundary_violation_count` | Count of excluded admissions or outputs implying assessment, reassurance, dispatch, hospital notification, or guaranteed clinical response; maximum 0 | Any event: immediate HOLD and incident review; clinical safety owner |
| `failed_escalation_count` | Failures to present the approved exclusion/stop pathway or carry out an approved human incident/escalation handoff; maximum 0; no dispatch or hospital notification is implied | Any failure or unapproved pathway: HOLD and clinical/operations review; scenario tests only until humans approve the local process |
| `privacy_unauthorized_disclosure_count` | Count of unauthorized or wrong-person/clinic data disclosures; maximum 0 | Any event: immediate HOLD, preserve restricted audit evidence, invoke approved incident process; privacy/security owners |
| `credential_invalid_confirmation_count` | Confirmations by, or assigned to, a professional/staff actor with absent, invalid, stale, revoked or out-of-scope authority; maximum 0 | Any event: HOLD and revoke affected workflow access pending review; credentialing/clinic owners |
| `booking_conflict_count` | Duplicate confirmation, overlapping assignment, or confirmation outside the approved clinic, schedule, or capacity; maximum 0 | Any event: immediate HOLD and human reconciliation; clinic/engineering owners |
| `staffed_coverage_ratio` | Staffed approved minutes divided by opened service minutes; required 1.00 | Missing staff or unknown coverage closes the affected booking window; operations owner |
| `pending_request_count` | Open requests awaiting human disposition; maximum 5 | At capacity reject new requests; above cap pause admission and review queue; clinic/operations owners |
| `support_unacknowledged_staffed_minutes` | Oldest pending scheduling-support/request acknowledgement age counted only within approved staffed windows; maximum 30 | Breach pauses new invitations/requests and requires human review; operations owner; no emergency response promise |
| `booking_completion_ratio` | Eligible appointment requests reaching valid human confirmation, decline, or participant cancellation within the reviewed coordination target, divided by eligible requests; proposed minimum 0.90, at least 10 evaluable scenarios, rolling 7-day window | Below threshold or insufficient evidence prevents expansion; during an authorized pilot pause admission until reviewed; clinic/product owners |
| `critical_boundary_comprehension_ratio` | Evaluated people who correctly explain the non-emergency boundary, request-versus-confirmation distinction, hours, and absence of clinical advice, divided by evaluated people; proposed minimum 0.90 and sample at least 10 | Below threshold: HOLD; absent study evidence blocks real admission/expansion; human language/accessibility reviewer and clinical owner |

The booking target is proposed at 30 staffed minutes for acknowledgement/human disposition; its appropriateness and feasibility need clinic/operations approval. No denominator of zero is a pass: `pilot.missing_invalid_or_insufficient_evidence_action=INDETERMINATE_AND_BLOCK`. Count/rate definitions, time windows, exclusions, sample provenance and approved threshold versions must be recorded alongside results. Repeated or missing events, conflicting timestamps, and inability to calculate or enforce a stop condition fail closed. Do not reinterpret a low error count as clinical safety evidence.

Comprehension requires a future, appropriately consented human evaluation using scripted scenarios and no patient health data; generated or synthetic respondents cannot supply that evidence. No such study or result is claimed here. Synthetic validation can check metric definitions and declared stop actions; it does not prove live collection, monitoring, escalation execution, or clinical safety.

The aggregate comprehension threshold never overrides an individual's failed critical-boundary check: an individual who does not understand the limits is not eligible for admission until the approved clarification/reassessment process is completed.

The canonical `pilot.immediate_hold_events` list requires immediate HOLD for any real-data ingress during synthetic-only operation; attempted paid/live provider activation; emergency, minor/proxy or out-of-jurisdiction admission; missing required approval; bypass of a disabled capability; inability to verify identity/consent/credentials; loss of audit integrity; or an unavailable stop control. A hold pauses admission and the affected processing, preserves evidence, and routes recovery to the named accountable humans. `pilot.automatic_resume=false`: it never auto-resumes because a timer or metric recovers. Restoration needs a recorded human decision and the relevant negative tests; it cannot constitute release-board approval.

## Exit evidence and open gates

Phase 1 can close its engineering work when the selected planning market, scope, exclusions and failure behavior are represented consistently in the policy and documentation; policy tests reject invalid/unsupported states; maintained ledgers cite contradictions and open gates; and the Phase 0 launch hold remains intact. That is permission to continue isolated engineering work only.

Before any real participation, the release board must receive the named operator/clinic/clinical owner/controller evidence, lawful data and processor/hosting review, approved local emergency wording, current professional authority and consent model, fixed dates/rota/capacity, verified support/stop procedures, security and restore evidence, accessible Portuguese comprehension study, and the exact immutable artifact. All remain OPEN and unassigned unless separately recorded in [human gates](KAYA_HUMAN_GATES.md). No approval, start date, participant recruitment, invitation dispatch, or external communication is implied by this draft.

The broad source journeys and unsupported claims behind this reduced scope are catalogued with source links in [jurisdiction contradictions J01–J09](KAYA_JURISDICTION_DECISION.md#source-contradictions-and-their-planning-disposition). Existing [product-plan metrics](../PRODUCT_AND_LAUNCH_PLAN.md#L114), [Azure review blockers](AZURE_PILOT_STATUS.md#L42), and the [Phase 0 baseline](KAYA_EXECUTION_STATUS.md) remain evidence of work and limitations, not pilot approvals.
