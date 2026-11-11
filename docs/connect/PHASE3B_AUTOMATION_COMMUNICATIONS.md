# Robotronix Connect — Phase 3B Automation & Communications

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Environment: Development Supabase `fflejkqcspivnhsmkdtn` only.
Status: **Implemented and database-tested; Next.js build/browser regression not yet completed.**

## Scope delivered

1. **Automatic admissions ownership.** An insert into the canonical `connect.opportunities` automatically assigns an active counsellor (preferred over manager/admin/owner) with the smallest current open workload, unless staff explicitly selected an owner. No duplicate staff or lead tables.
2. **Initial follow-up task.** New opportunities create one follow-up task by default, assigned to the lead owner and due 24 hours later (configurable 1–168 hours). Task is linked to the original opportunity/contact.
3. **Per-institute automation rules.** Owner/admin can enable/disable assignment, initial follow-ups and reminders, and configure first-followup delay and alert advance time (5–1440 minutes). `connect.automation_settings` has one row per tenant.
4. **In-app due/overdue reminders.** A scheduled PostgreSQL job calls `public.connect_run_reminders` every five minutes in **Development**. Each member sees only their own alerts. `connect.staff_notifications` uniquely keys task/member/type; retries never make duplicates. Upcoming and overdue alerts are each generated at most once per assignment. Worker avoids scanning already-notified tasks in small batches. No notifications for disabled members or closed institutes.
5. **Staff reminder inbox.** View upcoming/overdue notifications and mark them read; requires verified Supabase Auth and active institute membership.
6. **Read-only consolidated conversation history.** Display inbound WhatsApp and email messages captured by Phase 3A as a chronological communication stream; institute-wide list and contact-level history. Uses existing canonical `conversations` and `messages` tables. Does **not** send outbound messages.
7. **Manager lead reassignment.** Authenticated manager/admin/owner can choose an active staff member in the lead-detail drawer. The existing `assign_opportunity` RPC and optimistic version check are reused.
8. **Call/counselling notes.** Staff can add notes through existing tenant-safe `log_activity` RPC in the lead-detail drawer.
9. **Manually captured admissions now support automatic assignment.** Phase 2C's capture path previously assigned the submitting member before the trigger could run. This was corrected for configured auto assignment.
10. **Reusable secure job endpoint** `POST /api/connect/jobs/reminders` accepts `Authorization: Bearer <CONNECT_REMINDER_JOB_SECRET>` for alternative scheduling. **The Dev database Cron job is already active; do not also configure the HTTP scheduler in Dev**, or duplicate work. The worker is idempotent but redundant scheduling should be avoided.

## Database files and migrations

- `database/connect/saas/15_workflow_automation.sql`: two new tenant-scoped RLS tables, one trigger, four service-only RPCs.
- `database/connect/saas/16_schedule_inapp_reminders_dev.sql`: installs `pg_cron` in Dev and activates `robotronix-connect-inapp-reminders`, every five minutes.
- `database/connect/tests/verify_phase3b_dev.sql`: complete rollback-only SQL test.
- Canonical `database/connect/saas/09_crm_commands.sql` updated so manual lead capture participates in automatic assignment.

## APIs

- `GET/PATCH /api/connect/workspaces/:tenantId/automation` — configured rules (owner/admin write).
- `GET/PATCH /api/connect/workspaces/:tenantId/inbox` — staff's own notifications and mark-read.
- `GET /api/connect/workspaces/:tenantId/conversations?personId=<uuid>&limit=40` — authorized message history.
- `GET /api/connect/workspaces/:tenantId/assignees` — manager-only active staff options.
- `POST /api/connect/jobs/reminders` — optional authenticated job endpoint. Do not expose the job secret to the browser.

## UI

- `features/connect/components/ConnectAutomationSettings.tsx`: simple owner/admin policy controls.
- `features/connect/components/ConnectCommunications.tsx`: in-app alerts and conversation history.
- `app/connect/page.tsx`: new Communications navigation, personal reminders under Follow-ups, per-contact history, staff-assignment selector, notes.
- `app/connect/connect.css`: scoped styling compatible with Portal UI foundations.

## Development tests actually run

- Service-role SQL: active counsellor received newly created opportunity and its assigned follow-up.
- Updated manual enquiry capture assigned to counsellor, without presetting the submitting owner's member ID.
- Upcoming alert generated within configured window; repeated worker call created zero duplicate alerts.
- Overdue state generated separately when task became overdue.
- Assignee sees own alerts; workspace owner does not see that other staff member's private alerts.
- Read acknowledgement persists.
- Disabling assignment/followups/reminders prevents new automatic activity.
- Inbound WhatsApp event appears in tenant-scoped contact history.
- Unknown contact ID rejected on history lookup; counsellor cannot change automation rules.
- All test records rolled back.
- `cron.job` entry verified active at `*/5 * * * *`.
- `cron.job_run_details` verified a **succeeded** execution at 2026-11-05 06:15 UTC.
- Database verified 39 Connect tables, all RLS enabled; 80 Portal tables unchanged; zero QA tenants, opportunities and notifications retained; no `anon`/`authenticated` EXECUTE on automation, inbox, conversation or reminder worker RPCs.
- Git branch remains ahead of, and not merged into, `main`.

## Release gates and known limitations

- **Next.js build/typecheck and authenticated browser E2E have NOT run** due unavailable local Git checkout/build environment. Verify before merge.
- Full Learning Portal admin/parent/trainer/student, Zoom, payroll, demos and billing regression still outstanding from Phase 2D.
- Test HTTPS routes with owner, admin, manager, counsellor, viewer, disabled user and two institutes, including rapid switching.
- Scheduled in-app alerts are **not push notifications** and do not independently send SMS, email or WhatsApp. There is no outbound provider send/consent workflow in Phase 3B.
- Cron is installed and scheduled only in Development; separately review and deploy after Production release approval. Cron currently runs with no customer rows.
- Staff assignment currently balances **open opportunity counts**, not time zones, skills, capacity, holiday calendars, counsellor working hours or availability.
- Follow-up generation occurs when a **new admission opportunity** is created. An enquiry without a configured admissions pipeline is captured but cannot be assigned by this opportunity trigger.
- No additional automatic task is created for every subsequent message on an existing open opportunity; messages still appear in history and are captured as distinct enquiries.
- On large commercial workloads, add notification retention/cleanup, queue metrics, batch monitoring, role-specific privacy policies, and stronger rate limiting.
- Do not enable outbound marketing automation without verified consent, template approval and applicable provider requirements.

## Status guarantee
No Production Supabase migration, no Netlify deployment, no merge to `main`. This phase is a functioning Development database workflow with new unbuilt UI code, **not a production-certified release**.
