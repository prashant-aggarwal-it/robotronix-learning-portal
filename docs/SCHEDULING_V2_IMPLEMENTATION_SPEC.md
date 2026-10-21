# Robotronix Learning Portal — Scheduling V2 Implementation Specification
Status: FEATURE CODE COMMITTED ON WORKING BRANCH / DEV DATABASE EXECUTION AND FULL ROLE E2E PENDING
Target branch: `release/consolidated-stabilization-20261020`
Scope: Admin, Trainer, Parent, Student, scheduling, notifications, finance and canonical SQL.
Do not modify `main`, production Netlify, or live Supabase during implementation.

## Approved business policy
1. Default schedule horizon: **entire course**; Admin may select N weeks or manual scheduling.
2. Late cancellation: **flag for review**, no automatic student-hour deduction or trainer earning.
3. Trainer may approve an enrollment pause **up to 14 calendar days**; longer pauses require Admin.
4. Zoom: **reusable trainer-owned meeting link**, configurable per trainer; no Zoom API dependency for V2.
5. Student consumed hours and trainer earnings: **verified delivered sessions only**; exceptional charges/payments require explicit separate authorization.
6. Routine single-session rescheduling: **trainer-authorized**, with audit trail and availability/conflict validation.
7. Parents may continue requesting changes over WhatsApp; trainers must record the agreed changes in the portal.
8. Admin handles exceptional cases rather than approving every routine schedule change.

## Core data model and invariants
- Enrollment: student, course, assigned trainer, delivery type, start date, course/planned session count, purchased package/paid balance, timezone, recurring rules, schedule horizon, enrollment status, pause metadata. Course curriculum count is NOT the purchased-session count.
- Class session: immutable identity, enrollment ID or cohort ID, actual start/end instants, local timezone, assigned trainer, source (generated/manual/makeup), status, Zoom-link reference, occurrence kind, attendance/completion references.
- Schedule exception: source session, old/new dates, reason, requested-by, actor, timestamp, status; never silently recreate cancelled/rescheduled occurrences.
- Trainer assignment history: effective dates and reason. Completed class attribution and historical payroll remain with original trainer.
- Enrollment pause intervals: inclusive start, exclusive resume date; reason, actor, authorization, handling strategy, audit.
- Class delivery verification and financial posting are separate from booking. Repeated completion must not double-pay or double-deduct.
- Reuse existing tables/constraints where possible. Extend **only** `database/01_install/01_CREATE_SCHEMA.sql` as canonical install SQL, rather than shipping disconnected migration patches. Maintain RLS and access policies.

## Generation algorithm
1. During Admin onboarding Learning Setup, select course, trainer, enrollment type, start date, IANA timezone, weekly days/time, and horizon (entire course / selected weeks / manual). For full course, derive count from an explicit agreed enrollment session count or confirmed course default; if unavailable, require Admin input.
2. Preview generated dates, total sessions, estimated end date, trainer availability, blocked dates and conflicts before activation. Explicitly resolve conflicts; do not silently double-book.
3. Activate learner and create enrollment + initial dated sessions in an atomic server-side transaction/RPC, or equivalent recoverable operation with idempotency keys. No orphan learner/enrollment or partial unreported class generation.
4. Count eligible class occurrences, not calendar weeks. Respect timezone/DST transitions and actual start/end instants. Honor fixed course count, planned end date and existing sessions. Avoid scheduling outside valid enrollment dates.
5. Use deterministic occurrence keys or unique constraints so retries and re-generation cannot duplicate classes. Preserve cancelled, rescheduled, delivered, paid, locked and makeup occurrences.
6. Regenerate only eligible future, uncompleted, unmodified occurrences after a permanent timetable change; show impact preview and explicit confirmation.
7. For group cohorts, create one shared class event per batch occurrence, not a duplicate per student. Each learner has linked attendance and enrollment; a learner pause must not cancel the cohort event.

## Day-to-day workflows
- Trainer Classes: upcoming, completed, cancelled, pending outcomes; join Zoom, reschedule, cancel, schedule makeup, complete with attendance/feedback.
- One-off reschedule: select original session, new date/time, reason/requester; validate trainer availability, learner/cohort conflicts, enrollment pause, and paid locks; retain history; notify impacted roles.
- Cancellation: record actor, initiator, notice time and reason. Late parent cancellation becomes `review_required` financial exception; no automatic deduction/earning. Admin resolves exceptional charge/compensation with auditable decision.
- Makeup: link replacement to original session; never increase entitled sessions or double-consume package; ensure cancelled original is not regenerated.
- Pause up to 14 calendar days: trainer may approve individual 1:1 learner pause. Longer pauses require Admin. Pause affects eligible future sessions; default to shift uncompleted 1:1 sessions to next available valid recurring slots after resume, with preview and conflict checks. Preserve total entitlement and previously customized sessions; unresolved conflicts remain visible for manual resolution.
- Group pause: one learner's vacation/exams changes their attendance/leave and optional makeup only; batch calendar continues. Whole-batch hold is Admin-only.
- Trainer reassignment: Admin changes assigned trainer effective date, optionally selected future sessions; preserve completed history/payroll; validate conflicts and replace future trainer Zoom links. Trainer may request temporary substitution, Admin authorizes cross-trainer reassignment.
- Permanent schedule change: Admin approval or configured delegation, with preview of future impact; do not overwrite completed or customized classes.
- End/withdrawal: stop generating new classes, cancel eligible future bookings with audit, preserve historic sessions and reconcile balances separately.

## Zoom and role visibility
- Store trainer reusable Zoom join URL securely with optional meeting ID/passcode metadata. Restrict modification to authorized roles; validate https URLs. Joining does not prove attendance.
- Trainer -> Classes: manage own class sessions and Join Zoom.
- Admin -> Schedule: create/modify dated sessions, view all trainer schedules, conflicts and exceptions.
- Admin -> Classes: upcoming/delivered/cancelled/missed session oversight and exports.
- Admin -> Enrollments: enrollment timetable, horizon, total generated, remaining, hold, change trainer, change weekly plan and view all classes.
- Parent -> Learner View: upcoming class date/time in local timezone, join Zoom and change history/notifications.
- Student -> Home: age-appropriate upcoming class and Join Zoom, if portal access enabled.
- Join button available within a configurable pre-class window (proposed default 15 minutes); do not imply a Zoom meeting was created by API.
- On reschedule, maintain trainer reusable link; on trainer reassignment, reference new trainer link for future sessions.

## Permissions and notifications
- Enforce server-side auth/RLS, not merely hidden UI controls.
- Trainer can edit only own eligible future sessions, approve <=14-day 1:1 pauses, and submit delivery outcomes. No ability to change fees, historic locked classes, another trainer's bookings, or payroll.
- Admin can perform/approve all changes with auditable override reason.
- Parent/student read only authorized learner classes; avoid exposing other group members' personal data.
- Notify trainer and affected parent/student on reschedule, cancellation, pause/resume, trainer reassignment and makeup. Admin receives high-value exceptions, not routine noise. Track notification failures/retries and avoid duplicate alerts.
- WhatsApp integration is future scope; current WhatsApp conversation is not assumed to update the portal automatically.

## Accounting and reconciliation
- Scheduled != delivered != billable != paid. Verify attendance/duration before applying hours and trainer earnings.
- Do not create earnings for scheduled, cancelled, paused or no-show events by default.
- Handle partial duration, multiple students in a cohort, migration opening balances and 1/1.5/2/2.5-hour class durations.
- Honor existing guard_schedule_delete, guard_paid_class_source and trainer earning sync safeguards; never bypass them to simplify rescheduling.
- A late cancellation exception is pending review and has zero automatic impact until a separate authorized decision.
- Keep audit trail of old/new trainer, timing, Zoom reference, reason, actor and financial resolution.

## Implementation sequence
1. Audit current schema, onboarding activation, schedule event creation, role screens, RLS, notifications and finance invariants; identify compatibility gaps.
2. Extend canonical SQL and typed repository/API methods; add transaction-safe/idempotent generation, preview and exception records.
3. Integrate Admin Learning Setup, preview and activation with selected horizon.
4. Build trainer Classes actions, one-off reschedule, cancellation, makeup, pause/resume and role-specific permissions.
5. Implement trainer reassignment, future-session reconciliation and group safeguards.
6. Add trainer Zoom settings, Join buttons and notification fan-out.
7. Validate finance, payroll, attendance and reports; reconcile historic and migrated records.
8. Run TypeScript/build, auth/roles/workflow Playwright tests, SQL install verification and edge-case tests; consolidate every successful change into the branch.

## Acceptance tests (minimum)
- Full-course 24-session Tue/Thu 1:1 generation, correct count and no duplicates on retries.
- Admin chooses 4 weeks/manual; correct count or zero generated events.
- Parent-requested one-off move leaves future recurrence unchanged.
- Cancelled/rescheduled occurrence is not recreated on re-generation.
- Same trainer cannot be double-booked; timezone/DST changes handled.
- Pause <=14 days trainer succeeds; >14 requires Admin; exam break shifts eligible 1:1 sessions without losing entitlements.
- Group learner pause does not cancel group class; one cohort session with separate attendance.
- Trainer replacement preserves historic attendance and earnings; future class links follow replacement trainer.
- Completed/paid class cannot be silently deleted or rewritten.
- Late cancellation remains review-required and uncharged/unpaid pending explicit resolution.
- Delivered class posts hours and earnings exactly once; undelivered does not.
- Parent/student cannot see other students' private data; trainer cannot edit other trainers' classes.
- Notifications delivered once per meaningful change; failure is visible/retriable.
- Existing onboarding, role QA and consolidated production SQL verification still pass.

## Open implementation defaults requiring explicit validation (not blockers for starting design)
- Full-course count source: course catalog planned sessions versus individual enrollment override; never infer paid entitlement.
- 14-day threshold: calendar days; group and trainer-wide pauses always require Admin.
- Cancelled sessions: preserve class record and offer replacement; no automatic charge.
- Time conflict policy: hard-block double bookings unless Admin has an auditable permitted override.
- Zoom waiting-room/passcode/access controls to be configured on Zoom account; portal does not promise host privileges merely by opening join URL.
- Scheduling generation for course changes must be transactional, conflict-aware and preserve one-off exceptions.


## Implementation handoff (October 2026)
The working branch now includes class horizon previews, atomic database generation for new one-to-one enrollments and cohort calendars, idempotent occurrence keys, conflict/availability checks, linked one-off reschedule and makeups, trainer/Admin 14-day individual pauses, cohort learner leave, forward-only trainer/batch reassignment, trainer reusable Zoom links, join links, notifications, and Admin cancellation review.

Admin entry points: `/admin/scheduling-v2`, `/admin/cohort-scheduling`, `/admin/cancellation-reviews`. Trainer class breaks: `/trainer/holds`. Existing Classes and Enrollments pages link to new actions. Parent/Student Next Class cards use shared ZoomClassActions.

Current GitHub release workflow runs typecheck, structural checks, Scheduling V2 pure preview tests and Next.js build. The canonical SQL installation and `database/03_verify/01_VERIFY_RELEASE.sql` include Scheduling V2 objects/gates; they have **not** been executed on a separate Supabase DEV database from this GitHub-only environment. Complete the full role-based QA there before release.

Exceptional cases remain intentionally guarded rather than silently altered: sessions with individual Zoom meetings cannot be automatically reassigned/rescheduled by the reusable-link workflow; use supervised Admin Zoom reconciliation. Existing started/migrated courses are not backfilled with fabricated historical classes. One-off cohort learner makeup is a separate Admin-approved exception, not an automatic additional entitlement. The new DB operations must not be enabled on production before the DEV install/verification and role QA pass.
