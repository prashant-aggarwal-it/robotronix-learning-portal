# Robotronix Portal — Phases 2–4 delivery ledger
Started: 2026-10-24
Implementation branch: `feature/seamless-learner-journey-20261024`
Release branch: `main`
Status legend: [x] code committed; [ ] outstanding. Code committed is not QA passed.

## Design principle
Treat Onboarding → Enrollment → Class → Zoom as ONE end-to-end Admin workflow. Retain underlying Students/Enrollments/Schedule/Classes modules as authoritative records, but link contextual actions and never force a search for the next step.

## Phase 2 — Seamless learner journey
- [x] Activation confirmation links to exact newly created enrollment and student, provides booking count/warning and schedule shortcut; avoid claiming Zoom is provisioned.
- [ ] When revisiting an activated onboarding record, resolve existing student/enrollment links without duplication; may require explicit persisted IDs/schema migration.
- [x] Enrollment detail shows agreed session count, reconciled current class records and guarded full-course generation (DB test pending).
- [x] Next class and up to 12 upcoming class links appear above billing; timezone appears from schedule record. [ ] Add user-local conversion and meeting state directly in enrollment.
- [x] Day, Week Overview and Trainer Week booking controls open the same summary with link to authoritative ClassRecordEditor; keyboard-based button activation. Browser QA pending.
- [x] Reused existing ClassRecordEditor as the single session authority; added enrollment-return link. [ ] Verify Zoom meeting states, start/join and recorded access end-to-end.
- [ ] Confirm cohort generation shares one class event per cohort, not per child; cancellations and reschedules preserved.
- [ ] Regression tests for exactly-once full-course generation, schedule conflicts, DST and lifecycle navigation.

## Phase 3 — Daily operations
- [x] Existing weekly availability editor validates overlaps; repository now surfaces deletion failure instead of false save success. [ ] Replace non-atomic delete+insert with transactional database RPC; verify copy/clear, date overrides, approvals and notifications in live QA.
- [x] Trainer weekly schedule class cards deep-link to the existing session editor; trainer week anchors to IST. [ ] Complete trainer dashboard next-class validation, attendance, learning observations and earnings E2E.
- [ ] Admin class actions: reschedule/cancel/makeup, policy enforcement, no-shows, notifications and overrides.
- [ ] Correct delivered-hour payroll, attended-hour progress, cancellations/penalties and paid-lock behavior.
- [x] Classroom control now shows unavailable and setup error state rather than hiding pending messages. [ ] Zoom host allocation, concurrent bookings, meeting create/start/join/end, recording sync/stream/delete/retention and role permissions require end-to-end proof.
- [ ] Notification center action links, finance verification (#18), trainer portal invitation/first-login (#20), realtime refresh across roles.
- [ ] Parent/student next class and correct local timezone, permissions, progress and recordings.
- [ ] Demo Experience create/share/outcome/convert flow, without broader CRM scope.

## Phase 4 — UX consolidation
- [x] Reduced competing Enrollments CTAs, contextual individual-class booking and cross-workspace shortcuts (browser UI acceptance pending).
- [ ] Simplify onboarding KPI strip and remove misleading statuses.
- [ ] Clarify Student (permanent learner), Enrollment (specific course), Class (session) and Zoom (service).
- [x] Corrected pluralization in trainer workload summary and neutral portal access language. [ ] Confirm table clipping, mobile horizontal scrolling and redundant summary cards with screenshot/browser review.
- [ ] Harmonize action hierarchy, labels, cards, empty states, date/time display and themes.
- [ ] Test keyboard, mobile, Admin/Trainer/Parent/Student views.

## Quality/release gate
- [ ] `npm ci`, `npm run typecheck`, `npm run check:release`, `npm run build`.
- [ ] Playwright QA on full role workflows, scheduling, notifications, finance and security.
- [x] Next.js dependency upgraded from vulnerable 16.3.8 to 16.4.3, updating package and lockfile together; one-time upgrade job passed npm audit, typecheck, release checks and build. [ ] Reconfirm checks on final branch head and role-based E2E before release.
- [ ] Test Zoom functionality against the real authorized app while approval review is pending.
- [ ] Review database schema changes and backup prior to reset; no reset without deliberate approval.
- [ ] Merge only verified increments; track specific commits and tests in PR.

Related tracking: GitHub issues #18, #20, #22; prior Zoom stabilization/security evidence backlog.

## Execution notes — 24 October 2026
- Implemented first vertical slice: onboarding outcome → enrollment hub → schedule calendar → class editor → existing ZoomClassActions component.
- This does **not** mean all Phase 2/3/4 requirements are complete; billing, rescheduling, recordings, security and role testing require further validation.
- Shared prelaunch Supabase database was not modified. Existing code paths reused; no schema migration necessary for the above UI changes.
- GitHub Actions TypeScript regression discovered in first build and was fixed; final run must be checked before release.

## Additional code improvements completed (subject to browser QA)
- Student Profile now offers a contextual Open Enrollment and Next Class shortcut.
- Classes list has an All Classes view and `?enrollment=...` filter for the entire course.
- Enrollment class list shows future booking times in IST and learner-local timezone and links to the filtered history.
- Enrollments list primary actions reduced from four to three; individual generation relocated into enrollment context.
- Trainer Classes "Today" filter now follows IST instead of UTC.
- Release candidate CI covers dedicated learner-journey navigation contract tests.
- Next.js patched upgrade committed; one-time upgrade automation removed after successful validation.

**Scope still outstanding:** Complete Phase 3 host/recording E2E, notifications and policy QA; Phase 4 full screen-by-screen UX pass and mobile/role regression. No production data or schema were changed by this work.

## Additional Phase 3 increment — 24 Oct 2026
- Trainer weekly event cards now link directly to the assigned class editor (no extra menu search).
- Trainer current week calculation anchors on IST date rather than browser current date.
- ZoomClassActions shows pending and error states consistently in compact mode, plus meeting provisioning error detail when returned.
- Navigation contract tests cover these improvements; the most recent CI run must pass before release.
- **Still outstanding:** concurrency-safe Zoom host reservation, actual recording playback/delete/expiry tests, detailed finance/late-cancellation policy verification, notifications, parent/learner access security and complete mobile UX.

## Further Phase 3/4 fixes
- Correctly detect Supabase deletion failure when replacing trainer availability; **atomic replacement is still required** to prevent losing slots if the next insert fails.
- Trainer workload statistics now pluralize students correctly, including highest load and running cohort summaries.
- Added availability save regression contract assertion.

## Further fixes committed in this round (QA pending)
- Trainer availability replacement now checks failed deletion, snapshots previous records, and attempts to restore original slots when replacement insertion fails. This is defensive recovery, **not** atomicity: transactional RPC #25 remains required.
- Admin Trainer KPI wording now uses correct singular/plural and clearer portal status copy.
- Schedule event dialog displays IST date and avoids routing demos/workshops to the class-only editor; Escape keyboard dismissal added.
- Added regression assertions for notification/availability and schedule UI contracts.
- No database reset, migration, or production merge performed in this round.
