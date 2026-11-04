# UAT-NOTIF-01 — Notification noise reduction across all roles

**Branch:** `fix/role-notifications-lifecycle-20261104`
**Deployment status:** Source changes only; **not merged to main, not deployed, migration not run**.

## Root cause
- Individual class inserts emitted per-class `class_scheduled` notifications without dedupe keys or useful schedule details.
- Legacy parent `class_scheduled` notifications were incorrectly priority `action`.
- The shared NotificationCenter and NotificationBell counted *all* unread historical rows, even routine older notices.
- Existing bulk schedule generators already suppress per-class trigger notifications and issue one summary; keep that behavior.

## Implementation
1. One consistent active inbox for Admin, Trainer, Parent and Student using the shared components.
2. Combine generic `class_scheduled` entries into one per role / learner / trainer / creation date. Keep every original underlying row in the database; marking a group read marks all its entries read.
3. Routine informational messages are visible in the active inbox for seven days, then remain in **All history**, regardless of read state. Important/action notifications stay active until manually handled/read; the UI does not falsely claim that reading resolves a business action.
4. Bell unread badge reflects active *groups* instead of raw rows. Action-required and important counters remain separate.
5. Schedule insert/cancel/reschedule database trigger now uses state-based dedupe keys and course/date/time text. Parent scheduled notices use `info`, while cancellation/reschedule use `important`.
6. Previously created class-scheduled parent records are categorized as `info` in the optional existing-DB migration; no historical notifications are deleted.
7. Existing per-recipient database RLS and role scoping remain unchanged.
8. Admin/trainer payment messages, onboarding, attendance, and reminder policy timings remain unchanged; notifications are not suppressed when a real action needs attention.

## Existing DB upgrade (DEV first)
- Review database backup and schema parity.
- Run `database/04_existing_db_migrations/20261104_notification_noise.sql` **once** on an isolated DEV clone, only after verifying `portal_notifications` and `schedule_events` schema parity.
- The script is data-preserving; it replaces the existing schedule notification function and reclassifies *only* `class_scheduled` notifications incorrectly marked `action`.
- Run the included read-only verification queries.
- **Do not** apply this script to Production without a separate approved change window and DEV signoff.
- For a **new** database, use the normal fresh installer only. The canonical `01_core_schema.sql` includes the same trigger changes; do not run the existing-DB migration afterward.

## UAT cases
- Create 12 future sessions in one bulk schedule operation: parent/trainer should receive one summary each, not 12 notices.
- Create one manual session: trainer, learner and parent (where linked) receive at most one accurate scheduling notice.
- Retry unrelated updates to a class: no extra scheduling notices.
- Cancel or reschedule a class: one important notification per recipient; no duplicate on repeated no-op save.
- Reminders: trainer 30/10 minutes and attendance-pending notifications still arrive according to enabled policies and dedupe keys.
- Repeat for Admin, Trainer, Parent and Student: check role isolation, active badge, action count, history availability and "mark all as read."
- Open a grouped notification: all underlying entries are marked read and navigation goes to the correct role schedule.
- Old routine info drops from active inbox at seven days, but appears under **All history**.
- An old unread action or important notification is still active.
- Test existing issue: opening schedule/attendance and making genuine business updates should not generate noisy class-scheduling notices.
- Verify no credentials or sensitive details appear in notification bodies.

## Explicitly not changed
- No deletion or archival DB job; seven-day expiry is an **inbox view policy**, not data retention.
- No new `resolved_at` workflow state. Reading an action is **not** equivalent to completing a class report or replying to a message. Adding a true resolution lifecycle needs workflow-specific hooks and separate data migration.
- No changes to notification email/push delivery or optional second Zoom host.
- No Netlify deployment, Supabase migration execution or production QA run.

## Automated regression
`npx playwright test qa/notification-policy.spec.ts --project=desktop-chromium`

Run `npm run typecheck` and relevant notifications / scheduling end-to-end UAT against a DEV instance prior to merging.
