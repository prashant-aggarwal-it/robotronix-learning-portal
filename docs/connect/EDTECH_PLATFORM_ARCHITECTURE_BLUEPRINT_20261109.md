# EdTech Platform Architecture Blueprint — Pre-implementation Baseline

Date: 2026-11-09  
Status: **Proposed design baseline; no schema, API, deployment or production changes authorized by this document**  
Scope: education and training providers only; subject-neutral (STEM, tutoring, languages, music, vocational, professional and school/NGO programmes).  
Repository branch: `feature/robotronix-connect-crm` (do not merge to `main` without owner approval).

## 1. Product direction and non-goals

- **Connect** is an independently usable, multi-institute CRM/admissions/growth SaaS. It must work without the Learning Portal.
- **Learning Portal** is the independently usable academic delivery and operations system. It must work without Connect.
- **Learning Experience** (curriculum, competencies, assessments, projects, credentials and engagement) is a **module of the Portal**, not a third application.
- **Integration adapter** is an optional, versioned, permission-scoped connection between the two. No direct cross-product foreign keys, shared service-role keys, or mandatory shared authentication.
- Robotronix is the first pilot tenant, not a hardcoded business model. Support one-to-one, group, cohort, school and blended learning without building separate products by subject.
- Non-goals for this phase: generic non-education CRM, enterprise HR, an independent accounting system, full SCORM/LRS implementation, a new Zoom provider, or replacing the already working Portal.

## 2. Single source of truth (write ownership)

| Domain / action | Authority | Other product's permitted role |
| --- | --- | --- |
| Lead sources, contacts, enquiry, consent, opportunity, pipeline, sales owner | Connect | Portal can reference verified identity/accepted offer; no independent sales pipeline |
| Campaigns, outbound sales communications, follow-up tasks | Connect | Portal emits selected renewal/retention signals |
| Sales calls and counselling appointments | Connect | No duplicate academic schedule |
| Demo booking intent and prospect-facing coordination | Connect when integrated | Portal also supports operational/admin-originated demo bookings |
| Actual demo booking, participant, trainer, availability, Zoom, reschedule, cancel, attendance and teaching feedback | Portal | Connect presents a linked read model and sends commands |
| Academic course, syllabus, version, skill, assessment, project and credential | Portal | Connect can display eligible commercial catalogue/approved recommendations |
| Offer, quote, accepted commercial terms before admission | Connect | Portal validates and snapshots agreed terms on enrolment |
| Learner, guardian access, onboarding, enrollment, cohort, session allowance, class schedule, attendance | Portal | Connect receives limited customer-lifecycle summaries |
| Invoice, receipt, payment allocation, outstanding balance, refunds and trainer payroll | Portal | Connect shows authorized summaries; no second financial ledger |
| Renewal conversation, referral, upsell opportunity | Connect | Portal provides academic eligibility/milestone signals |
| SaaS subscription and tenant entitlement for each product | Each product independently | No cross-product dependency |

**Invariant:** an operational object may appear in both apps, but only its authority may change its canonical state. A CRM calendar view of a Portal demo is a projection, not a second CRM appointment.

## 3. Core EdTech domain model (logical, not executable DDL)

### Connect bounded context

`workspace`, `membership`, `person`, `contact_method`, `household`, `guardian_learner_relation`, `organization`, `inquiry`, `opportunity`, `opportunity_learner`, `pipeline_stage`, `stage_history`, `activity`, `task`, `sales_appointment`, `conversation`, `consent_event`, `offer`, `campaign_attribution`, `external_record_link`.

- One adult may have several learners and commercial opportunities; contact identity is not a login.
- Separate immutable inquiry/source touchpoints from opportunities and their current stages.
- Store accepted offers as immutable commercial snapshots, not as mutable pointers to today's catalogue pricing.
- Shared family phone/email must not trigger automatic identity merges.

### Portal bounded context

`institution`, `trainer_profile`, `trainer_qualification`, `trainer_availability`, `person/guardian/learner_profile`, `programme`, `course_version`, `module`, `lesson`, `learning_objective`, `competency`, `resource`, `assessment_template`, `rubric`, `assessment_attempt`, `evidence`, `mastery_decision`, `project`, `credential_rule`, `credential_issuance`, `demo_session`, `demo_participant`, `enrollment`, `cohort`, `class_session`, `attendance`, `session_entitlement`, `invoice`, `payment`, `payroll`.

- `course_version` is immutable once used by active enrollments. Publish a new version for substantive curriculum changes; use explicit migration for learners who opt into a new version.
- A *class session* is a scheduled service/consumed entitlement; a *lesson* is curriculum content. One lesson can require multiple classes, and one class can cover several objectives.
- Skill mastery requires assessed evidence and a criterion/rubric, not attendance or a free-form percentage alone.
- Credentials reference issuer, recipient, course/competencies, criteria, issue date, verification identifier, revocation state, and optional consent-safe evidence.
- Separate operational `demo_session` from paid `class_session`; demos may be one-to-one or group, with multiple linked participants.
- Programmes and delivery models must be configurable, but avoid unrestricted EAV/JSON for core relationships.

### Cross-product linkage

Use `integration_connection` and `external_record_link` scoped by Connect tenant, Portal institution, object type and exact stable external ID. Verified links should cover CRM person/learner/guardian, opportunity, demo session and participant, accepted offer, enrollment and invoice summary as appropriate. Enforce unique active mappings per scoped relationship, and support manual resolution for ambiguous matches. Do not use email/phone as the external primary key.

## 4. End-to-end business journey

1. **Capture**: signed channel/website/manual enquiry enters Connect, deduplicated at message/event level; create/link contact and optional qualified opportunity. A parent can inquire before having a Portal account.
2. **Qualify**: salesperson records desired programme, learner's minimum necessary details, source, consent and next action.
3. **Request demo**: Connect retrieves *eligible, available* Portal trainers/slots, creates a booking request with a stable idempotency key, and receives authoritative Portal `demo_id`/participant references.
4. **Confirm**: Portal atomically validates trainer conflict, working hours, Zoom host availability, group capacity and permission before confirming. A provisional request is not a booking.
5. **Communicate**: Connect manages parent-facing sales conversation; Portal owns secure joining URLs, trainer notification, reschedules, no-shows and Zoom operational events. Never expose host secrets to Connect.
6. **Deliver**: trainer uses Portal only, sees learner-appropriate preparation (not CRM private conversation, sales price or family details), completes demo and structured academic feedback.
7. **Follow up**: Portal publishes `DemoOutcomeRecorded`; Connect stores a permitted summary, creates a deduplicated sales task, and keeps opportunity open until admission policy is met.
8. **Accept offer**: Connect sends accepted terms and verified identity links; Portal validates programme/version, package, eligibility, guardian consent and finance policy, then creates/reuses onboarding and enrollment handoff.
9. **Confirm admission**: only Portal's authoritative `EnrollmentConfirmed` event (under configurable fee/approval policy) closes opportunity as Won **once**; failure/pending does not mark Won.
10. **Deliver course**: Portal owns classes, attendance, progress, billing, trainer payouts and academic records; Connect receives minimal allowed lifecycle status.
11. **Retain**: Portal publishes relevant achievement/completion/renewal-eligibility signals; Connect starts a new commercial opportunity or task without changing academic history.

### Exception and branch coverage

- Customer changes demo time, trainer unavailable, Zoom host unavailable, participant no-show, trainer no-show, group participant added, cancellation/refund, duplicate request, provider timeout, booking created but response lost.
- Two learners sharing one guardian, multiple opportunities for one learner, demo delivered before CRM connection, Portal-only admissions, CRM-only institutes without the Portal.
- Parent declines: capture reason in Connect, close Lost; do not delete demo feedback. Parent postpones: opportunity remains open with a next action.
- Lead marked Won manually in CRM is **not** permitted to fabricate an enrollment; guard transitions in server/domain rules.
- An existing student's upsell is a new opportunity linked to the existing learner, not another person or enrollment by default.

## 5. Integration contracts (proposal, version `v1`)

### Commands: Connect -> Portal (scoped, authenticated API)

| Operation | Input essentials | Authoritative result |
| --- | --- | --- |
| `GET /v1/demo-capabilities` | connection + programme interest | supported demo models, duration and eligibility rules |
| `GET /v1/demo-availability` | course/programme, date range, mode, timezone, optional trainer | eligible trainer/slot references, short-lived availability snapshot |
| `POST /v1/demo-bookings` | request ID, contact/learner minimal profile, chosen slot, opportunity link, consent context | `pending` or confirmed `demoId`, participant ID and safe join-link metadata |
| `POST /v1/demo-bookings/{id}/reschedule` | request ID, new slot/trainer, expected version | validated revised booking/status |
| `POST /v1/demo-bookings/{id}/cancel` | request ID, reason, expected version | authoritative cancelled status |
| `POST /v1/enrollment-handoffs` | request ID, verified identity links, accepted immutable offer, intended course/version, guardian context | handoff ID and status; never assume enrolled synchronously |
| `GET /v1/customer-lifecycle/{link}` | limited scopes | permitted enrollment, dues-summary and completion status |

Exact URLs are placeholders; first implement them behind a Portal-owned adapter/service and review them against the existing admin demo API. Do **not** expose `/api/admin/demos` or an admin's service-role token directly to CRM users. Portal admin UI must reuse the same domain service, not a forked workflow.

### Events: Portal -> Connect

| Event type | CRM consequence |
| --- | --- |
| `DemoBookingConfirmed`, `DemoBookingRejected` | Show status; confirm or resolve sales action |
| `DemoRescheduled`, `DemoCancelled` | Update linked calendar projection; notify owner |
| `DemoAttendanceRecorded`, `DemoOutcomeRecorded` | Record permitted summary and generate one follow-up |
| `EnrollmentHandoffStatusChanged`, `EnrollmentConfirmed` | Update handoff state; mark Won once when confirmed |
| `EnrollmentPaused`, `EnrollmentEnded`, `CourseCompleted` | Update customer lifecycle; create policy-based retention work |
| `PaymentStatusChanged` | Update read-only financial summary, never ledger entries |
| `NextProgrammeRecommended` | Create reviewable upsell candidate, not automatic outbound promotion |

Each event needs `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `sourceInstitutionId`, `connectionId`, `subjectType`, `subjectId`, `subjectVersion`, `correlationId`, and least-privilege payload. Record event IDs durably, accept duplicates safely, handle out-of-order versions, acknowledge quickly, process asynchronously and reconcile gaps. Persist command idempotency keys with outcomes. Avoid network calls that hold a database transaction open while creating Zoom meetings.

**State model:** requested -> confirming -> confirmed -> in_progress -> completed; branches rejected, cancelled, no_show and failed/retryable. Demo completion comes from authorized Portal workflow, not merely the Zoom meeting-ended webhook. Bookings may change only through version-checked transitions.

## 6. Permissions and privacy

- **Connect roles**: owner/admin, sales manager, counsellor/agent, viewer; granular `crm.read`, `crm.write`, `demo.book`, `demo.reschedule`, `enrollment.handoff`, `finance.summary.read`. Do not require Portal admin role for a CRM staff member.
- **Portal roles**: admin/coordinator, trainer, parent, learner; role-specific academic and payment rights.
- **Integration account**: per-tenant/institution scoped installation with rotation/revocation, explicit purpose and audit. Use signed events or secure authenticated requests; no browser-side service tokens.
- Trainer sees minimum learner preparation, not guardian phone by default or sales notes. CRM sees approved demo feedback, not complete academic records.
- Minor/guardian consent, data minimization, opt-outs and retention apply independently to promotional messages, operational demo notifications, recordings, projects and public credential verification.
- Store raw Zoom/Meta credentials only in appropriate secret stores. Audit administrative overrides and sensitive reads.
- Ensure all tenant/institution lookups, event delivery and external link resolution enforce scope server-side; do not trust client-supplied tenant IDs.

## 7. Curriculum, assessment and credential foundation (design now, implement later)

### Curriculum hierarchy

`programme -> course version -> modules -> lessons -> objectives -> competency mappings -> learning activities/resources`.

Programme delivery can be `one_to_one`, `group`, `cohort`, `workshop`, `hybrid`, or `self_paced`; session billing can be pack, monthly, programme fee or installment. These are **orthogonal** to curriculum and academic progress.

### Assessment model

Support diagnostic, formative and summative assessments: quiz, written/oral exam, project, practical observation, performance and portfolio. Evidence links to an objective/competency and a versioned rubric. Trainer judgments can be reviewed/overridden with audit; automatic quiz grading cannot substitute for practical evidence. Course completion policies can require thresholds, mandatory projects and attendance criteria.

### Credentials and engagement

Skill badges, project achievements and course certificates derive from an immutable assessed outcome and policy version. Issue downloadable certificates with QR verification, revoke/reissue and privacy-aware public views; evaluate Open Badges 3.0 interoperability later. Gamification uses verified milestone events (not merely login time) and supports opt-in, age-appropriate visibility. No forced public leaderboard or penalty for different learning pace.

### Curriculum evolution and data migration

Introduce new content tables alongside existing `courses`, `learner_projects`, `learning_observations`, `class_attendance`, `trainer_feedback`, `enrollments` and session records. Audit exact live schema first; use additive mappings/backfills. Existing enrolled students keep their original curriculum version, entitlement counts and financial history. Do not delete or rename operational data to make the new model fit.

## 8. UX ownership by stakeholder

| Stakeholder | Primary application | Essential experience |
| --- | --- | --- |
| Owner | Both, with cross-product summary | growth, conversion, academic quality, revenue, retention, operational exceptions |
| Sales/marketing | Connect | enquiries, next action, demo booking, quotations, follow-ups and renewals |
| Trainer | Portal | today's classes, lesson plan, learner context, resource links, quick attendance/feedback, earnings |
| Learner | Portal | class access, lesson path, projects, mastery, challenges, credentials |
| Parent/guardian | Portal | upcoming classes, learner progress, teacher feedback, fees, secure communication and consent |
| Academic coordinator | Portal | trainer capacity, schedule conflicts, demo operations, completion exceptions and course quality |

Do not make a trainer work in CRM, nor give a salesperson unrestricted Portal access. Maintain one linked customer timeline but respect authorization on each fact.

## 9. Implementation plan and irreversible decisions

**Gate 0 — baseline audit (read-only):** verify latest branches, live DEV schema, installed migrations and ownership of current Portal demos/Zoom/onboarding/finance, and Connect appointments. Capture non-PII counts and regression baseline. Document conflicts against current deployed code. No production changes.

**Phase A — architecture contracts:** approve boundary matrix, interface OpenAPI/event schemas, mapping model, role scopes, states, command/event idempotency, error semantics, consent, retention, tenancy and integration install/uninstall. Write consumer-driven contract tests before integration code.

**Phase B — connected demo MVP:** Portal adapter backed by existing demo domain; eligibility/availability and conflict recheck; Connect booking UI and linked calendar projection; trainer and guest experience preserved; cancel/reschedule/no-show; trace/audit/reconciliation.

**Phase C — conversion:** safe feedback projection, follow-up automation, verified guardian/learner mapping, accepted-offer handoff, once-only Portal onboarding/enrollment confirmation, Won transition.

**Phase D — lifecycle:** read-only finance/learning summary and renewal events, with permissions and staff-friendly dashboards.

**Phase E — Learning Experience foundation:** course versioning, structured lessons/competencies, activity and resource mapping, tutor-led assessment/evidence, then projects, credentials, gamification and AI assistance in that dependency order.

**Delivery rule:** preserve existing Portal features; implement in one feature branch with reviewable commits, no merge to main, production DB migration or deployment without explicit authorization. Prefer vertical slices and reusable domain services over large simultaneous rewrites.

## 10. Acceptance scenarios and quality gates

1. A contact with two children books separate demos and keeps one guardian identity and two opportunities.
2. CRM agent books an available trainer without Portal admin access; Portal trainer sees session and guest link.
3. Concurrent booking for the last slot results in one confirmation and one clear conflict, never double booking.
4. API times out after booking succeeds; retry returns the same booking without a second Zoom meeting.
5. Trainer cancels/unavailable: authorized reschedule updates both UIs and one Zoom meeting lifecycle.
6. Group demo has one session and separate participant feedback/CRM opportunity links.
7. Demo completion triggers exactly one follow-up, regardless of duplicate or out-of-order events.
8. Accepted offer with incomplete enrolment remains pending; confirmed enrolment closes CRM Won exactly once.
9. Existing Portal-only demo/onboarding, live classes, recordings, payroll, Razorpay, attendance and reminders still work with integration disabled.
10. Connect-only customer can create and manage ordinary appointments without any Portal subscription.
11. Tenant A cannot access Tenant B's linked data, trainer roster, link tokens or finance summary.
12. Parent/learner privacy survives cross-product summaries; a trainer cannot inspect CRM notes or marketing consent.
13. Pausing/completing a programme emits one appropriate retention signal without altering paid-class entitlements.
14. A course revision does not mutate active students' lesson plans or assessments without explicit opt-in migration.
15. Quiz, practical, performance and project rubrics can all assess generic competencies without subject-specific database columns.

**Required verification before rollout:** TS/build and existing four-role Portal tests; CRM auth/tenant cross-access; SQL integration/migration tests; signed webhook replay, retries, dead-letter/reconciliation; Zoom guest/reviewer access; payment regression; full browser UAT incl mobile and accessibility; backup/restore rehearsal and signed-off cutover plan. No current source review establishes these as passed.

## 11. Open decisions to sign off before DDL/API code

1. **Recommended:** Connect and Portal independently sellable; integration optional, per institute.
2. **Recommended:** Connect is the normal sales entry for demo booking; Portal remains operational owner and supports independent admin-origin bookings.
3. **Recommended:** Won only on Portal-confirmed enrollment under a configurable payment/approval rule; a verbal acceptance is `accepted_pending_enrolment`.
4. Define commercial catalogue mapping: Portal course/version authority vs Connect sales-product/offering and immutable quote snapshots.
5. Define trainer-slot holds, duration, travel/buffer and capacity policy, and a deterministic Zoom host allocation policy.
6. Define minimum prospect data, minor/guardian consent, allowed demo summary, credential public visibility and retention periods.
7. Define one-to-one versus multi-learner/family conversion, school-sponsored cohorts, and partial payment/installment admission rules.
8. Confirm whether a standalone Connect customer can use an external demo provider adapter (recommended future extension; no Portal dependency).

## 12. Audit traceability

Source reviewed: `docs/connect/SAAS_ARCHITECTURE_DECISION.md`; `docs/connect/CANONICAL_DATA_MODEL.md` (marked superseded design); `docs/connect/ARCHITECTURE_AUDIT.md` (historical); `docs/connect/ROBOTRONIX_PRODUCTION_GO_LIVE_GATE.md`; `app/admin/demos/page.tsx`; `app/api/admin/demos/route.ts`; `features/connect/components/ConnectCalendar.tsx`; `database/connect/saas/39_calendar_management.sql`; Portal scheduling and enrollment schema modules.

**Evidence boundary:** this is a source-based architecture blueprint. It is not an audited ERD of the deployed DEV/Production databases, not an implementation, and not a statement that existing integration is already live. Exact schema migrations, API payload fields and operational ownership of edge cases require Gate 0 verification and owner sign-off.
