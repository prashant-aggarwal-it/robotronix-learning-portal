# Robotronix Classroom V2 — reserved-host / just-in-time Zoom

**Branch:** `fix/qa-onboarding-save-feedback-20261025`
**Status:** Code and canonical schema committed for DEV acceptance. Not deployed to Production. Manual Zoom account, SDK, concurrency and recording tests remain operator-owned.

## Operational design

1. Full-course scheduling creates normal `schedule_events` immediately. The `zoom_class_reservation_sync_trg` database trigger attempts to reserve a connected enabled Zoom host for each eligible online class using `public.reserve_zoom_host_for_class`. An advisory transaction lock plus a GiST exclusion constraint prevent overlapping reservations for the same host. If capacity is exhausted, the class remains scheduled but its ledger status is `unallocated`; **Admin must resolve that exception** before the session.
2. The normal `syncZoomForScheduleEvent` entry point defers **new** Zoom meeting creation until 35 minutes before class. It preserves existing meeting IDs and updates already-provisioned meetings on a schedule change. Offline/cancelled events are excluded from Zoom provisioning.
3. Netlify's `zoom-auto-reconcile` function calls the authenticated reconciliation API every **five minutes**. It provisions missing meetings for classes starting within 35 minutes (with a short grace period), verifies timing of previously provisioned meetings, repairs stale cancellations, and gradually reassigns future `unallocated` reservations after a host becomes available.
4. Direct Trainer or authorized Learner classroom entry checks readiness and invokes the same provisioning service if required. Role checks and join windows apply **before** this fallback. The learner is never granted host permissions. Trainer/Admin host entry uses the Zoom Meeting SDK host signature plus that meeting host account's ZAK token; validate this behavior on the connected Zoom accounts.
5. All Zoom create/update operations for a class claim `zoom_class_provisioning_leases` using an atomic RPC, then release the lease in `finally`. This reduces race conditions between scheduler, Admin and classroom requests. A timed-out lease is reclaimable; the Zoom API is external so failure after Zoom accepted a POST but before the database commit can still require manual reconciliation.
6. The Admin Zoom workspace shows host reservations, upcoming readiness and capacity exceptions; the Admin can retry capacity assignment without creating a future Zoom room. Recording and attendance tables and learner access policies remain unchanged.
7. General Zoom meetings also consider reserved class host capacity, so they cannot quietly consume a host already booked for a class.

## Canonical SQL organization (no patches)

- `database/01_install/modules/schema/06_zoom_calendar_demo.sql`: existing Zoom baseline and overlapping active-meeting guard
- `database/01_install/modules/schema/10_zoom_jit_provisioning.sql`: claim/release leases and restricted RPCs
- `database/01_install/modules/schema/11_zoom_host_capacity.sql`: course-long reservations, exclusion, RLS and booking trigger

The single generated fresh installer includes these in order. **Do not run the fresh installer on a populated DEV or Production database.** Existing databases require an explicitly reviewed data-preserving migration, backups and deployment plan. A GitHub commit does **not** update either Supabase project.

## Automated checks

`npm run check:zoom-jit`, `npm run check:release`, `npm run build`, existing role and Zoom security contract tests. The static checks confirm required integration markers but do not substitute for SQL execution or actual Zoom meeting tests.

## Operator DEV manual acceptance — defer until ready

- With one authorized connected host: book a full multi-session course; verify all schedule events and the host ledger exist, while only near-term classes have Zoom meeting IDs.
- Book overlapping online classes on one host; verify the second appears as a visible capacity exception rather than being incorrectly assigned to the first host.
- With two separately authorized Zoom hosts: book overlapping classes and confirm they reserve different accounts and can both run.
- Test a class at **35, 30, 10 and 0 minutes before start**; verify automatic readiness, direct trainer launch, direct learner launch and the same underlying Zoom meeting ID.
- Reschedule classes before and after provisioning; confirm reservations and remote meeting times are updated without duplicate rooms.
- Cancel before provisioning, cancel after provisioning and cancel after a completed/recorded class; verify correct remote cleanup and preserved historical records.
- Disconnect/disable a host and retry assignment; check conflict flags and alternate-host selection.
- Inject mock Zoom API failure and timeouts in DEV; verify retries, error logs, lease expiry recovery, redacted responses and no accidental repeat POST after ambiguous provider responses.
- Verify Trainer ZAK, Zoom SDK host privileges, learner permissions, attendance capture, recording reconciliation and 60-day retention protections under the actual Zoom Marketplace app permissions.
- Verify Netlify scheduled functions and API credentials in the target production environment **without changing production data**.

## Deployment considerations

Netlify scheduled functions run according to deployment and account limits. The current QA branch deployment is not proof that the scheduled job has run. Before merging, review the production existing-schema upgrade approach and backup, plus Zoom Marketplace Beta approval and account licensing. Manual DEV signoff must precede production changes.
