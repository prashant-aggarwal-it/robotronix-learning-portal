# Phase D — Portal lifecycle projections and renewal conversations

## Ownership and access

- The Learning Portal remains authoritative for enrolments, course progress, attendance, schedules, fee packages and invoices. CRM cannot mutate any of those records.
- The `connect` private schema holds **only reduced operational snapshots** for verified, confirmed enrolment handoffs whose Portal integration remains active.
- The public RPCs run exclusively under service-role credentials and independently validate the authenticated actor's active tenant membership.
- Owner/admin/manager can view CRM payment-attention flags, but not invoice amounts, financial ledger details or individual payment transactions. Counsellors can view **only opportunities assigned to them** and cannot see payment-attention indicators. Viewers receive no learner records.
- No automatic WhatsApp, email or SMS is sent as a side effect of renewal detection.

## Lifecycle and renewals

- `connect_sync_portal_lifecycle`: periodically projects status, course, session progress, attendance count, newest fee package and overdue invoice **boolean** for a confirmed handoff. Portal IDs are internal identifiers, not separate CRM learners.
- `portal_renewal_signals` uniquely keys each signal by tenant + enrolment + package cycle. Candidate conditions: completion, pause, session balance at most two, package within fourteen days of end, or course end approaching.
- Sales staff record `Open`, `Contacted` or `Dismissed` as a CRM-only conversation state. Recording an actual renewal, payment or new package remains a Portal responsibility.
- Renewals resolve when the condition is no longer met; historical conversations remain recorded. A new package ID starts a new renewal cycle.
- CRM sidebar has **Learner lifecycle**, with learner/session progress, renewal action buttons and permission-scoped payment attention. Only confirmed, linked Portal enrolments appear; legacy or manually created Portal learners are intentionally not exposed until linked.

## Delivery and verification

- DEV migrations: `58_portal_lifecycle_renewals.sql`, `59_schedule_portal_lifecycle_dev.sql` (five-minute cron).
- No production DB migrations, code merges or deployments are authorized here.
- Run `node scripts/check-connect-phase-d.mjs`, `npm run typecheck`, `NEXT_PUBLIC_APP_ENV=demo npm run build`.
- Dev integration smoke: `select public.connect_sync_portal_lifecycle(100);` (zero results when there are no confirmed handoffs). Full role-by-role UI/Zoom/finance UAT requires representative connected test admissions and authenticated role accounts.

## Operational notes

- The scheduler processes up to 500 confirmed handoffs per run; before exceeding this size, add fair cursor pagination and stale-projection cleanup for uninstall/revocation. A separate reactivation policy is required if a tenant uninstalls and later reinstalls.
- Payment attention is **not** an account balance. It is a boolean derived from an overdue, unpaid invoice; consult Portal finance for amounts and reconciliation.
- Progress percentage is educational completion, not a billing entitlement; package session balance is displayed separately.
