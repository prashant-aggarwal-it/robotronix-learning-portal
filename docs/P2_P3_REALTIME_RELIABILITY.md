# P2 + P3 — Cross-role refresh and Realtime recovery

**Branch:** `fix/p2-p3-live-sync-reliability-20261020`, based on P1 `fix/p1-action-notifications-20261020`.  
**Status:** Source changes committed. Not yet compiled/tested against authenticated DEV or deployed to Production. Do not call this Production-ready.

## Architecture

1. Critical business changes are committed to PostgreSQL first. P1 triggers persist targeted action notifications.
2. `useLiveRefresh` subscribes to table-change events as *invalidation hints*, not as permission to display event payloads. Refresh uses existing RLS-protected repository reads.
3. Visible screens reconcile on initial subscription, focus, online, visibility resume, and every 60 seconds. Debounced/in-flight serialization prevents event storms. Hidden/offline tabs do not poll until resumed.
4. `NotificationBell` and `NotificationCenter` retain their `portal_notifications` Realtime subscription and now reconcile on tab visibility and every 60 seconds even if websocket events were missed.
5. The additive SQL ensures Supabase `supabase_realtime` publishes the tables used by relevant live views. RLS still governs access. Financial fields are not used in notification messages.

## Views updated in this branch

| Role | View | Invalidation tables |
| --- | --- | --- |
| Trainer | Profile, payout approval status | `trainer_finance_change_requests`, `trainer_finance`, `trainer_compensation_plans` |
| Admin | Trainer detail and pending finance review | `trainer_finance_change_requests`, `trainer_finance`, `enrollments`, `schedule_events`, availability tables |
| Admin | Enrollments/Cohorts | `enrollments`, `cohorts`, `students`, `trainers` |
| Admin | Trainer payroll detail | `trainer_earnings`, `trainer_payouts`, `trainer_finance`, `trainer_compensation_plans` |
| Admin | Overview | learner/trainer/onboarding/enrollment/schedule/progress tables |
| Trainer | Home | enrollments, classes, attendance, project, progress and earning changes |
| Admin | Trainers list | trainers, enrollments, courses, cohorts and finance requests |
| Admin | Trainer finance list | trainers, earnings and payout changes |
| All roles | Notification bell / notification page | notifications Realtime + 60-second/focus recovery |

Existing live-refresh views for Parent and Student dashboard, calendar, attendance, course progress, Admin/Trainer schedule and demo records remain intact; verify their real event delivery as regression cases.

**Safe draft behavior:** Trainer Profile will not overwrite payout/profile drafts while the trainer is editing. Admin Trainer detail will not overwrite its sensitive-finance, profile or availability drafts while editing; Payroll detail avoids resets during plan save.

## Installation

**Empty DEV installation:** `database/01_install/01_CREATE_SCHEMA.sql` includes the P1 triggers and P2/P3 publication section, so apply canonical fresh-install procedures only.

**Existing DEV installation:** apply P1 `04_PRIORITY1_ACTION_NOTIFICATIONS.sql`, then `05_P2_P3_REALTIME_PUBLICATION.sql`. Both should be reviewed and run in the appropriate DB SQL editor. Existing-data migrations are separate from fresh-install scripts; **never rerun the whole schema on Production**.

**Production:** Requires separately approved deployment plan, backup, security/RLS review, database migration and acceptance testing. The GitHub branch itself does not update the deployed Supabase project.

## QA acceptance with independent Admin / Trainer / Parent sessions

Use synthetic DEV accounts and data. Keep tabs open simultaneously. For each case verify immediate update where the Realtime table is published; if disconnected, verify within 60 seconds when the tab is visible or immediately on refocus. Verify no role sees another role's restricted rows.

| ID | Action | Expected |
| --- | --- | --- |
| SYNC-01 | Trainer sends payout change while Admin detail open | Admin pending queue refreshes and P1 Admin notification arrives |
| SYNC-02 | Admin approves payout while Trainer Profile open | Trainer Profile pending state and approved record refresh; Trainer decision notification arrives |
| SYNC-03 | Admin requests correction | Trainer receives notification and sees correction state |
| SYNC-04 | Admin changes enrollment/trainer assignment | Open Admin enrollments and Trainer Home refresh after data changes |
| SYNC-05 | Admin reschedules/cancels class | Trainer schedule/Today and Parent/Student views refresh; correct P1 notifications |
| SYNC-06 | Trainer records attendance/progress | Admin summary, Parent and Student dashboards update as permitted |
| SYNC-07 | Finance records are updated | Admin payroll views and Trainer earnings reflect authorized changes |
| SYNC-08 | User is editing bank/profile/availability draft | Incoming refresh does not wipe unsaved inputs |
| REL-01 | Realtime disconnected; tab stays visible | Periodic 60s recovery refetches current state |
| REL-02 | Tab hidden 5 minutes; data changes | No needless hidden refresh; returning to tab reconciles |
| REL-03 | Offline during a new notification | Once online and page resumes, persisted notification appears |
| REL-04 | Rapid repeated writes | No overlapping refresh storm or UI crash |
| REL-05 | Unauthorized Parent tries Admin/Trainer finance | RLS denies restricted data; no sensitive row leakage |
| REL-06 | Bell count/read state across tabs | Unread counts recover after updates or reconnect |
| REG-01 | New parent onboarding | Existing onboarding trigger and Admin page update still work |
| REG-02 | Messages | Inbox/thread Realtime and P1 notification routing still work |
| REG-03 | Class schedule / invoice / demo screens | Existing live-refresh regression pass |

## Read-only DB verification

```sql
select tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
  and tablename in ('portal_notifications','trainer_finance_change_requests',
   'trainer_finance','trainer_earnings','trainer_payouts','enrollments',
   'schedule_events','class_attendance','onboarding_submissions',
   'communication_messages','progress_alert_actions')
order by tablename;

select tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('portal_notifications','trainer_finance_change_requests',
   'trainer_finance','trainer_earnings','trainer_payouts','enrollments');
```

**Release gate:** run `npm ci`, `npm run check:release`, `npm run build`, `npm run qa:auth-check`, `npm run qa:roles`, `npm run qa:workflow`, plus DEV SQL and cross-browser QA above. Only claim PASS with captured result, commit SHA and DEV environment confirmation.

## Remaining investigation

- Verify Realtime replication and RLS policies empirically across all roles; source inspection alone cannot prove security.
- Some detail pages and provider-driven Zoom/Razorpay data may still require targeted event mapping and QA.
- Realtime is an eventual update mechanism, not a payroll cutoff or approval rule; payout cycle policy remains a separate feature.
- Admin and Trainer dashboards must not interrupt actively edited forms; expand edit-state guards if regressions are observed.
