# Robotronix database release installation (manual SQL Editor)

**Current target:** existing Robotronix Learning Portal Supabase Production project `njyktzenybimykpqaegn`. Existing Portal schema/data stay in place; this package adds the private `tasks` and `connect` modules. No sample records, production phone registration, Meta secrets, or recurring jobs are created.

## Run order — use the Supabase SQL Editor, one script at a time

| Order | Script | Functional scope |
| --- | --- | --- |
| 00 | [00_preflight.sql](./00_preflight.sql) | Read-only guard: correct Portal prerequisites and no previously installed feature schemas |
| 01 | [01_tasks_foundation.sql](./01_tasks_foundation.sql) | Personal tasks, preferences, collaboration, workspaces, notifications |
| 02 | [02_tasks_v2.sql](./02_tasks_v2.sql) | Tasks V2 boards, planner, focus, recurrence, priorities; corrected task capture permissions |
| 03 | [03_connect_foundation.sql](./03_connect_foundation.sql) | CRM tenants/workspaces, enquiry capture, pipelines, automation, reporting |
| 04 | [04_connect_contacts.sql](./04_connect_contacts.sql) | Contact 360, relationships, team contact assignments and insights |
| 05 | [05_connect_whatsapp.sql](./05_connect_whatsapp.sql) | WhatsApp conversations, incoming messages, history, status, coexistence data |
| 06 | [06_connect_calendar_imports.sql](./06_connect_calendar_imports.sql) | Calendar, bulk CSV contacts, contact profiles, deduplication and merge |
| 07 | [07_connect_portal_integrations.sql](./07_connect_portal_integrations.sql) | Demo bookings, admissions handoffs and Portal lifecycle sync functions |
| 08 | [08_connect_unified_channels.sql](./08_connect_unified_channels.sql) | Messenger/Instagram/email unified inbox tables and RPCs; final private-schema/RPC permission reconciliation |
| 09 | [09_verify.sql](./09_verify.sql) | Read-only structural, RLS and permissions checks |

Open each linked SQL file on GitHub **from `main`**, copy its **entire raw content** into a new SQL Editor query, run it, and confirm success before proceeding. Each installation script 01–08 has its own `BEGIN/COMMIT` boundary; if it errors, **stop**. Do not skip steps or rerun completed scripts. Paste the exact error and the file name for diagnosis.

## Scope and safeguards

1. **Make and verify a restorable production backup first.** Do not proceed without one.
2. Confirm you are in project `njyktzenybimykpqaegn`. Production already contains real accounts and Portal records. Do not drop or truncate existing public Portal data.
3. This is a **fresh-module install into an existing Portal database**, not a standalone Portal fresh install. For an empty brand-new Portal DB, run the existing `database/01_install/` process first.
4. **Do not run if either `tasks` or `connect` schema already exists.** The package is not a safe reentrant upgrade. For partial installs or future updates, use a reviewed incremental migration.
5. **Don't execute the historical folders as installers.** `database/tasks/` and `database/connect/saas/` contain per-phase definitions, development-only and historical corrections. They remain preserved for audit/reconciliation, but this directory is the active manual installation entrypoint.
6. **Do not run `database/connect/saas/02_retire_empty_prototype_dev_only.sql`, developer demo-data SQL, or development cron scripts on production.** The bundle deliberately excludes prototype drops and database job scheduling.
7. The 08 unified-channel functions and supporting tables were reconstructed from development database definitions because their applied migration source was absent from the historical folder. The new bundle was structurally cross-checked against development (66 CRM tables, 21 Tasks tables and all 133 named RPC functions).
8. A direct `auth.users` read by service-role code previously caused an Add Task `42501` failure. The generated 02 script contains that fix. Two CRM team-list functions in 04/05 use `public.profiles.full_name` instead of attempting to read restricted `auth.users.email`.
9. 08 also reconciles server-side private table and function grants. It does **not** create unrestricted client access, and `tasks`/`connect` must not be added to Supabase's exposed Data API schemas.

## What this does **not** automatically finish

- These eight large SQL bundles have **not yet been executed end-to-end against a blank isolated database**. A SQL Editor error must be investigated before continuing. The validation step was tested read-only against development after a rollback-only simulation of the final ACL block; it passed. This is not the same as full production installation or browser testing.
- No production records, Meta configuration or credentials have been inserted.
- No `pg_cron` jobs were enabled; reminders, lifecycle reconciliation and scheduled history processing need a separate operational plan for the active hosting platform.
- Netlify environment variables (especially Connect CRM, Meta webhook secrets, token configuration and email), app build/deployment and authorized end-to-end test messages need separate validation.
- Existing fixes in unrelated, diverged GitHub branches are not automatically included in these CRM/Tasks scripts; assess them independently when preparing the full Portal release.

## Expected post-install verification

After 09, verify **21** `tasks` tables and **66** `connect` tables with RLS; **at least 57** task functions and **76** Connect functions callable by `service_role` and not directly by anonymous or client-authenticated DB roles. Then test Tasks create/edit/board and CRM contact/import/inbox endpoints with a logged-in account. Successful SQL execution alone is not a production acceptance test.

**No action is required to create new users or a second Supabase project.** The Next.js backend uses the existing Supabase Auth and production service-role credentials, which must remain server-only.
