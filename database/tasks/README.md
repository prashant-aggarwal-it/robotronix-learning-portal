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
