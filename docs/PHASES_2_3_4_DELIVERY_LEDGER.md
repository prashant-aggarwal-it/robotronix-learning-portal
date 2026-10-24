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
- [x] Enrollment detail shows agreed session count, reconciled current class records and guarded full-course generation (DB test pending).
- [x] Next class and up to 12 upcoming class links appear above billing; timezone appears from schedule record. [ ] Add user-local conversion and meeting state directly in enrollment.
- [x] Day, Week Overview and Trainer Week booking controls open the same summary with link to authoritative ClassRecordEditor; keyboard-based button activation. Browser QA pending.
- [x] Reused existing ClassRecordEditor as the single session authority; added enrollment-return link. [ ] Verify Zoom meeting states, start/join and recorded access end-to-end.
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

## Execution notes — 24 October 2026
- Implemented first vertical slice: onboarding outcome → enrollment hub → schedule calendar → class editor → existing ZoomClassActions component.
- This does **not** mean all Phase 2/3/4 requirements are complete; billing, rescheduling, recordings, security and role testing require further validation.
- Shared prelaunch Supabase database was not modified. Existing code paths reused; no schema migration necessary for the above UI changes.
- GitHub Actions TypeScript regression discovered in first build and was fixed; final run must be checked before release.
