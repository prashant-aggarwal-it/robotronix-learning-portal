# Robotronix Portal — Phases 2–4 delivery ledger
Started: 2026-10-24
Implementation branch: `feature/seamless-learner-journey-20261024`
Release branch: `main`
Status legend: [x] code committed; [ ] outstanding. Code committed is not QA passed.

## Design principle
Treat Onboarding → Enrollment → Class → Zoom as ONE end-to-end Admin workflow. Retain underlying Students/Enrollments/Schedule/Classes modules as authoritative records, but link contextual actions and never force a search for the next step.

## Phase 2 — Seamless learner journey
- [x] Activation confirmation links to exact newly created enrollment and student, provides booking count/warning and schedule shortcut; avoid claiming Zoom is provisioned.
- [ ] When revisiting an activated onboarding record, resolve existing student/enrollment links without duplication.
- [ ] Show course agreed sessions vs existing class count and remaining unscheduled sessions on enrollment detail, with safe contextual **Generate missing classes**.
- [ ] Display *Next class* (learner/course/trainer/date, IST and local zone), *All scheduled classes*, and meeting state on enrollment detail above billing.
- [ ] Make all Schedule views open a consistent class detail; keyboard-accessible, with accurate student/course/trainer and status.
- [ ] Classes list/detail: one authoritative class details view; Zoom meeting state **pending / ready / failed**, start/join only when allowed, exact source URL when provisioned.
- [ ] Confirm cohort generation shares one class event per cohort, not per child; cancellations and reschedules preserved.
- [ ] Regression tests for exactly-once full-course generation, schedule conflicts, DST and lifecycle navigation.

## Phase 3 — Daily operations
- [ ] Trainer weekly availability: copy/clear, overlap prevention, date overrides, approvals, notifications.
- [ ] Trainer daily workspace: next class, Zoom start, attendance, learning outcomes and earnings.
- [ ] Admin class actions: reschedule/cancel/makeup, policy enforcement, no-shows, notifications and overrides.
- [ ] Correct delivered-hour payroll, attended-hour progress, cancellations/penalties and paid-lock behavior.
- [ ] Zoom host allocation, concurrent bookings, meeting create/start/join/end, recording sync/stream/delete/retention and role permissions.
- [ ] Notification center action links, finance verification (#18), trainer portal invitation/first-login (#20), realtime refresh across roles.
- [ ] Parent/student next class and correct local timezone, permissions, progress and recordings.
- [ ] Demo Experience create/share/outcome/convert flow, without broader CRM scope.

## Phase 4 — UX consolidation
- [ ] Reduce duplicate primary actions on Enrollments; contextual actions on enrollment/class.
- [ ] Simplify onboarding KPI strip and remove misleading statuses.
- [ ] Clarify Student (permanent learner), Enrollment (specific course), Class (session) and Zoom (service).
- [ ] Fix trainer grammar, clipped tables, responsive horizontal scrolling and redundant summary cards.
- [ ] Harmonize action hierarchy, labels, cards, empty states, date/time display and themes.
- [ ] Test keyboard, mobile, Admin/Trainer/Parent/Student views.

## Quality/release gate
- [ ] `npm ci`, `npm run typecheck`, `npm run check:release`, `npm run build`.
- [ ] Playwright QA on full role workflows, scheduling, notifications, finance and security.
- [ ] Next.js critical dependency audit vulnerability fixed and security job green (separate dependency/security work).
- [ ] Test Zoom functionality against the real authorized app while approval review is pending.
- [ ] Review database schema changes and backup prior to reset; no reset without deliberate approval.
- [ ] Merge only verified increments; track specific commits and tests in PR.

Related tracking: GitHub issues #18, #20, #22; prior Zoom stabilization/security evidence backlog.
