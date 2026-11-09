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
