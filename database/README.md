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

## A fresh start / resetting DEV

**Preferred:** Create another brand-new Supabase DEV project. That is the only clean way to reset Supabase Auth, application objects, Storage and operational configuration together without complex cleanup.

For a **dedicated disposable DEV project only**, `shared/DEV_RESET_APP_SCHEMAS.sql` is a guarded, destructive application-schema reset for `public`, `tasks`, and `connect`. It **does not reset Auth users, Storage files or separately scheduled cron jobs**, and it may remove other objects in `public`. Never use it on Production or shared instances.

Reset is deliberately **disabled by default**. It requires both:
1. An existing dedicated DEV marker in `public.robotronix_dev_reset_marker` holding `environment='development'` and the independently verified non-production project reference. A marker must be intentionally provisioned by an operator; normal installers never create it.
2. Replacing the explicit placeholder in the reset SQL with `DELETE_DEV_APP_DATA` after manually checking the selected Supabase project, backing up any DEV data and disabling its workers.

**These controls reduce accidents but cannot prove the Supabase project identity or make the operation intrinsically safe.** Do not create a DEV marker in Production. The reset script must never be an automatic install prerequisite. For most clean-install tests, use a new DEV project instead.

## Existing data / future changes

These are **fresh-install installers**, not migrations. The install will refuse existing module schemas. Production and populated DEV projects need reviewed **incremental, non-destructive upgrades**, not resets or fresh installers.

Historical `database/04_existing_db_migrations/`, `database/connect/`, `database/release_install/`, `database/security_qa/` and `database/legacy/` contain migration and development sources excluded from current installers. To keep VS Code uncluttered, `.vscode/settings.json` hides these preserved folders from the Explorer and normal search; they still exist in Git. You can override the exclusions in VS Code settings when auditing older upgrades. Do not delete or execute them as clean-install prerequisites; their consumers must be audited before archival. The active installer source of truth is `database/packages.json`.

For Netlify/pg_cron ownership, see `docs/operations/SCHEDULED_JOBS.md`. Static checks or generated output are **not equivalent** to a successful isolated Supabase SQL execution and application QA.
