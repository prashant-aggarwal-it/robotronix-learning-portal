> **Current fresh-install procedure:** Run `npm run db:build-fresh-install` and execute its generated SQL once in a new empty Supabase project. Legacy incremental SQL guidance below is historical; never run the canonical fresh installer on an existing database. See [database installation](DATABASE_MIGRATION_ORDER.md).

# Priority 1: action-required notifications — implementation and acceptance

**Branch:** `fix/p1-action-notifications-20261020`  
**Status:** Implemented in source; **not executed against Supabase or verified in Production**.  
**Scope:** Payout change requests, payout decisions, actionable messages, open learner progress alerts, and non-Admin changes to class schedules. Existing parent onboarding and class notification triggers are preserved.

## Source of truth / installation

- **Fresh DEV database:** `database/01_install/01_CREATE_SCHEMA.sql` already contains this P1 block at its end; follow the normal ordered fresh-install instructions. **Do not run the P1 patch a second time.**
- **Existing DEV database:** **do not run `01_CREATE_SCHEMA.sql`** against an existing database. This file is the consolidated fresh-install schema, not an incremental patch. Review the baseline-to-current schema diff and prepare a separate, backed-up, data-preserving migration; test it on a DEV clone before applying. Notification changes do not backfill historical events.
- **Production:** do not execute anything until the database migration is reviewed, DEV automated/manual QA passes, and a backup/change window is approved.
- **No client secrets or financial identifiers in notification bodies.** Notification links point to role-appropriate pages.
- **Realtime delivery:** Supabase `portal_notifications` must be included in the `supabase_realtime` publication and per-user RLS must permit recipients to read the row. The shared `NotificationBell` and `NotificationCenter` already subscribe to this table. New triggers persist notifications even if the intended user is offline.

## Trigger-to-consumer matrix

| Source event | Target | Type | Priority | Destination |
| --- | --- | --- | --- | --- |
| New trainer payout request | Admin | `trainer_payout_review` | action | `/admin/trainers/:id` |
| Payout approved | Trainer who owns record | `trainer_payout_decision` | important | `/trainer/profile` |
| Payout rejected / correction requested | Owning trainer | `trainer_payout_decision` | important/action | `/trainer/profile` |
| Progress alert opens or reopens | Admin | `progress_alert_open` | action | `/admin/alerts` |
| Parent message | Admin, linked trainer if any | `message_received` | action | Corresponding messages thread |
| Trainer message | Admin, parent if included in thread | `message_received` | action | Corresponding messages thread |
| Admin message | Trainer and/or parent included in thread | `message_received` | action | Corresponding messages thread |
| Non-Admin class cancellation/time change | Admin | `class_change_review` | action | `/admin/schedule` |
| New onboarding / class updates | Existing triggers | Existing event types | existing | Existing destinations |

**No accidental duplicates:** finance and message notifications use per-event `dedupe_key`; progress alerts use per-opening keys. Class scheduling has an existing dedicated family/trainer notification trigger; the new one only adds Admin review alerts for non-Admin-originated changes.

## Manual QA — two browser sessions

Use an isolated **DEV** database with fictitious data. Run as Admin in Browser A and Trainer in Browser B. Use controlled Parent account in Browser C when needed. Never use real PAN, account numbers, financial details, contact messages or payroll in fixture data.

1. **FIN-01 — Trainer sends payout details:** submit a fictitious payout request. Admin NotificationBell count should increase without navigation or hard refresh (after database Realtime handshake); Notifications page shows one actionable request with a link to the correct trainer. No sensitive data in notification.
2. **FIN-02 — Admin approves:** Admin approves in the trainer's Admin & Finance screen. Trainer should receive one persistent notification (no login refresh required for the bell). Opening the trainer profile after navigating shows the newly approved data. **Auto-refresh of the already-open Trainer Profile is a separate P1 cross-role synchronization change, not included in this event-notification patch.**
3. **FIN-03 — Correction requested:** create a new request; Admin requests correction. Trainer receives actionable notification and can see status. Check no duplicate notification on unrelated row updates.
4. **FIN-04 — Rejected:** submit a new request, reject, verify trainer receives the decision and the existing approved payout record is unchanged.
5. **MSG-01 — Parent to Admin/Trainer:** send message in shared learner thread. Only Admin and addressed trainer receive notifications and unread counters increment; Parent must not receive their own.
6. **MSG-02 — Trainer to Admin/Parent:** verify Admin notified; Parent notified only when the thread has a linked parent. Sending to Admin-only must not fabricate a parent notification.
7. **MSG-03 — Admin to recipients:** verify trainer and/or parent notifications match actual thread participants, with no message-body preview in notification.
8. **SCH-01 — Non-Admin class edit:** change a scheduled class time/cancel through a permitted flow. Admin sees one actionable review notification. Verify existing trainer/family schedule notifications still appear.
9. **SCH-02 — Admin class edit:** Admin edits class. No unnecessary Admin-self-notification. Existing trainer/family notifications still work.
10. **ALERT-01 — Progress alert:** create a new open `progress_alert_actions` record through the supported workflow. Admin receives review notification. Updating note or marking reviewed does not create another open notification. Reopen creates new action.
11. **ONB-01 — Family onboarding regression:** submit new family intake. Admin still receives existing `onboarding_submitted` notification, linked to the specific submission.
12. **OFF-01 — Offline recovery:** close Admin tab, submit a new action, then sign in again. Notification is retained, counted and linked; mark as read and verify unread count updates.
13. **SEC-01 — Access control:** Parent cannot view Admin/trainer notifications. Another trainer cannot view a trainer-specific finance decision. No banking numbers or PAN in alerts. Examine Supabase policies and API errors.
14. **RETRY-01 — No spamming:** retry page refresh or non-status updates; no second notification for the same finance/message action.

**Pass criteria:** every event creates exactly the intended notification record; real recipients see it live when open and after reopening the app; no unauthorized recipient can see it; links work; notifications survive temporary disconnection. Failed Realtime delivery must not destroy persisted notifications.

## Known follow-on items, not claimed fixed

- Open-screen **Trainer Profile**/Admin finance auto-refresh and full real-time synchronization.
- More precise notification targeting per Admin account (currently Admin-role queue follows existing platform design).
- Full before/after payout review UI, bank verification, payout cutoff/effective-cycle logic.
- Notification resolution state independent of read/unread; detailed lifecycle, escalation and reminders.
- Full database/Playwright integration test execution and Production validation.
- Cases where a Zoom/provider event changes state without a corresponding database event must be assessed separately.

## Read-only DB verification after applying to DEV

```sql
select event_object_table,trigger_name
from information_schema.triggers
where trigger_schema='public'
  and trigger_name in (
    'trainer_payout_action_insert_trg','trainer_payout_action_update_trg',
    'progress_action_insert_trg','progress_action_update_trg',
    'schedule_admin_action_update_trg','communication_message_after_insert',
    'onboarding_submission_admin_notification_trg'
  )
order by event_object_table,trigger_name;

select type,recipient_role,priority,title,href,created_at
from public.portal_notifications
where type in (
  'trainer_payout_review','trainer_payout_decision',
  'progress_alert_open','class_change_review',
  'message_received','onboarding_submitted'
)
order by created_at desc limit 50;

select tablename from pg_publication_tables
where pubname='supabase_realtime' and schemaname='public'
and tablename='portal_notifications';
```

**Deployment gating:** Do not apply the migration to Production, merge the working branch, or enable automatic deploy until owner approval and DEV validation.
