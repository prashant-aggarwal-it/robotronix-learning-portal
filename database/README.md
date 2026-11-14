# Robotronix database — simple, application-based layout

This is the **only current installation guide**. The authoritative SQL is grouped by product:

```text
database/
  portal/       schema/, reference/, qa/, manifest.json, verify.sql, first_admin_example.sql
  tasks/        01_schema.sql, 02_functions.sql, 03_security.sql, 04_verify.sql
  crm/          01_schema.sql, 02_functions.sql, 03_security.sql, 04_verify.sql, qa/
  shared/       preflight.sql, integrations/, DEV_RESET_APP_SCHEMAS.sql
  generated/    seven generated fresh installers (gitignored)
  packages.json
  README.md
```

## One command to build, one SQL file to install

From the repo root:

```powershell
npm run db:build-installers
```

Pick **exactly one** generated installer for a new, empty Supabase DEV project:

| Installed apps | Use one file in `database/generated/` |
| --- | --- |
| Portal | `ROBOTRONIX_FRESH_INSTALL.sql` |
| Tasks | `ROBOTRONIX_TASKS_FRESH_INSTALL.sql` |
| CRM | `ROBOTRONIX_CRM_FRESH_INSTALL.sql` |
| CRM + Tasks | `ROBOTRONIX_CRM_TASKS_FRESH_INSTALL.sql` |
| Portal + CRM | `ROBOTRONIX_PORTAL_CRM_FRESH_INSTALL.sql` |
| Portal + Tasks | `ROBOTRONIX_PORTAL_TASKS_FRESH_INSTALL.sql` |
| All three | `ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql` |

Do **not** execute the internal source SQL files, integration files or old migrations in addition to a generated installer. Each package automatically selects the correct module order and optional bridges. CRM and Tasks core SQL are each grouped as 01 → 02 → 03.

After the install finishes, run applicable **read-only** verification SQL separately:

- Portal: `portal/verify.sql`
- Tasks: `tasks/04_verify.sql`
- CRM: `crm/04_verify.sql`

Then create DEV Auth users and optional synthetic data (`portal/qa/`, `crm/qa/`) and test login, role boundaries, notifications and integrations. Production credentials, Netlify workers, external provider webhooks and schedulers are **not** installed by SQL.

## Reset and reinstall the same DEV project

You **do not need a new Supabase project every time**. For a dedicated, disposable Robotronix DEV project, use **one file**: `shared/DEV_RESET_ROBOTRONIX.sql`.

1. Verify you are in the correct **DEV** SQL Editor, back up anything important and temporarily stop Netlify / external workers.
2. Open `shared/DEV_RESET_ROBOTRONIX.sql`. Change `REPLACE_TO_CONFIRM_DEV_RESET` to `RESET_ROBOTRONIX_DEV` (the file refuses to run otherwise).
3. Execute the entire file once. It unschedules **all database pg_cron jobs** and drops/recreates `public`, `tasks`, and `connect`. It permanently destroys all application data in those schemas, including unrelated `public` objects.
4. Run `npm run db:build-installers` locally and execute **one** generated SQL installer for the chosen products on that reset DEV database, followed by the applicable read-only verification SQL.

This resets Robotronix's **application database objects and database scheduled jobs**, not the whole Supabase service. Supabase Auth users, Storage files/buckets, Edge Functions, external Netlify schedules and API settings are **not removed**. Storage objects must be deleted via the Storage API, never via direct SQL. Do **not** run the reset on Production or shared databases. The separate `shared/DEV_RESET_APP_SCHEMAS.sql` is an older marker-gated reset variant retained for compatibility; it does not remove cron jobs.

## Existing data / future changes

These are **fresh-install installers**, not migrations. The install will refuse existing module schemas. Production and populated DEV projects need reviewed **incremental, non-destructive upgrades**, not resets or fresh installers.

Historical `database/04_existing_db_migrations/`, `database/connect/`, `database/release_install/`, `database/security_qa/` and `database/legacy/` contain migration and development sources excluded from current installers. To keep VS Code uncluttered, `.vscode/settings.json` hides these preserved folders from the Explorer and normal search; they still exist in Git. You can override the exclusions in VS Code settings when auditing older upgrades. Do not delete or execute them as clean-install prerequisites; their consumers must be audited before archival. The active installer source of truth is `database/packages.json`.

For Netlify/pg_cron ownership, see `docs/operations/SCHEDULED_JOBS.md`. Static checks or generated output are **not equivalent** to a successful isolated Supabase SQL execution and application QA.
