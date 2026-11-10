# Universal My Tasks — Phase 1 foundation

Applies to the independent My Tasks module. It does not alter Connect CRM, Learning Portal data or user roles.

## Deployment boundary

- Confirmed Development project: `fflejkqcspivnhsmkdtn`.
- Production project: `njyktzenybimykpqaegn` — **not approved for this migration**.
- `01_foundation.sql` was applied to the Development database on 2026-11-09.
- Do not rerun the foundational SQL on an existing installation. Use reviewed incremental migrations.
- Do not add `tasks` to public Data API exposed schemas. It is a private schema.

## Authorization

- Next.js APIs verify an incoming bearer token with Supabase Auth, reject anonymous identities and require an active `public.profiles` record.
- The server uses the existing service-role credential, never the browser, for the narrowly granted `public.task_*` functions.
- Every RPC scopes reads and writes by `owner_user_id = p_actor_id`; cross-user mutations return no row.
- Public RPC `EXECUTE` grants are revoked from `PUBLIC`, `anon`, and `authenticated`; only `service_role` can execute them.
- Row Level Security remains enabled for all three private tables. Future sharing and workspaces require a new security review.

## Current scope

Phase 1 contains categories, personal task records, personal preferences, API validation and private CRUD procedures. No UI, delegation, recurrence or reminders are introduced yet; those belong to later phases.

API routes: `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]`, `GET/POST /api/tasks/categories`.

Run `node --test lib/server/tasks/validation.test.mjs` and `npm run typecheck` before committing. Cross-user database verification must use a transaction rolled back at the end and two active test identities.

## Phase 2 (Development only; 2026-11-10)

- Apply `02_personal_workspace.sql`, then `03_preferences_categories.sql` to the confirmed Development database only. Both have been applied to `fflejkqcspivnhsmkdtn`.
- `02` adds daily focus, subtasks, recurrence, reminder delivery tracking, and a restricted reminder processor. `03` adds preference and category management RPCs.
- The `process-task-reminders.mjs` Netlify scheduled function uses the service-role RPC every five minutes **when deployed**. It is not automatically active merely because SQL was installed.
- Task reminders use `portal_notifications` and its existing recipient roles; they do not expose personal task details to workspace admins.
- Task-only workspaces, delegation and cross-module CRM integration are out of scope until later phases.
- No production migration or Netlify production deployment is authorised yet.

### Smoke tests performed in rollback-only transactions

- Different users cannot read, update or archive one another's tasks or subtasks.
- Completing a daily recurrence creates exactly one next occurrence.
- Monthly recurrence on January 31 produces February 28.
- Reminder delivery is idempotent across repeated worker calls.
- Category rename/archive and preference operations use owner-scoped functions.

## Phase 3 (Development only; 2026-11-10)

- Apply in order: `04_collaboration_foundation.sql`, `05_collaboration_commands.sql`, `06_shared_subtasks.sql`. These have been applied to Development `fflejkqcspivnhsmkdtn` only.
- `04` creates team workspaces, memberships and email invitations; optional task sharing, assignees and collaborators; comments, activity log and attachment metadata; private Storage bucket and service-role-only access checks. It extends task list/update to handle explicitly shared tasks.
- `05` installs permission-checked RPC commands for membership, invitations, sharing, comments and attachments. Invitation acceptance requires a verified Auth email checked by the server.
- `06` makes subtask access compatible with restricted shared tasks; assignees may update checklist completion.
- RLS is enabled on the new private tables. Never expose the private `tasks` schema through the public Data API. Existing `service_role` HTTP handlers must verify the caller and pass only the authenticated user's ID, never a client-supplied actor ID.
- Rollback-only SQL test passed: nonmember isolation, verified invite flow, restricted visibility, assignee status-only changes, comments and immediate revocation on removal.
- No Production migration, main-branch merge, or deployment in this phase.

## Phase 4 — module adapters (Development only)

- `07_module_integrations.sql` links task records to Connect CRM tasks, contacts and opportunities, or Learning schedule events. Links are explicitly created per user; no bulk CRM migration runs automatically.
- CRM task imports are idempotent and keep their original CRM row. Status is synchronized both ways only for an explicitly imported CRM task while its owner retains active Connect membership. Cancelled CRM tasks are never reopened by task completion.
- Contact/opportunity links are personal follow-ups only; their completion does not change CRM pipeline stages. Learning links are review tasks only: completing them **never** marks a class as conducted or changes attendance or trainer payroll.
- Original module ACLs are checked at link creation, and linked tasks cannot be shared into a team workspace. Private `tasks.module_links` has RLS and service-role-only RPC access.
- The Development SQL validation initially executed the statements during a requested rollback check; subsequent idempotent migration-history registration succeeded on 2026-11-10. Read-only verification confirmed the CRM role guard, three triggers, RLS and no authenticated grants. No Production changes were made.

## Phase 5 — SaaS readiness and isolated task accounts (Development only)

- `08_saas_readiness.sql` was applied to Development `fflejkqcspivnhsmkdtn` on 2026-11-10; Production remains untouched.
- `tasks.accounts` allows a signed-in, verified-email user without a Learning Portal profile to activate a task-only account. A disabled Portal profile or suspended task account is denied. Task accounts remain service-role-only in the private schema with RLS.
- New service RPCs: `task_account_get`, `task_account_activate`, `task_bulk_import` (atomic 1–200 personal tasks, maximum 10,000 active owned records), and `task_account_metrics` (caller-scoped metrics only).
- Team spaces are separate membership/visibility boundaries; cross-workspace task access remains explicitly denied by `tasks.can_read`. No cross-organization data is exported or imported implicitly.
- Task-only onboarding uses existing Supabase Auth, with verified email required before activation. Import/export never grants CRM or Learning permissions.
- Manual gate before rollout: test verified and unverified task-only accounts, suspended task accounts, disabled Portal users, invited users across two workspaces, signed downloads, CSV import rollback, CRM role changes, and all four existing Portal roles.
- `09_saas_notifications.sql` applied to Development on 2026-11-10. It adds a private task-only notification inbox for reminders and assignments, while preserving Portal notification behavior for active role profiles. The scheduled reminder worker continues to call `task_reminder_process`.
