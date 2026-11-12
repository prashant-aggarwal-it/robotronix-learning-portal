# Robotronix database — generated fresh-install packages

**Start here:** [canonical/README.md](canonical/README.md) for the single-file installation guide.

Run from the repository root:

```powershell
npm run db:build-installers
```

This creates **one complete, sequentially numbered SQL installer per customer package**, with no need to execute individual odd/even-numbered source SQL files. All generated files are in `database/generated/`:

| Package | SQL installer |
| --- | --- |
| Portal | `ROBOTRONIX_FRESH_INSTALL.sql` |
| Tasks | `ROBOTRONIX_TASKS_FRESH_INSTALL.sql` |
| CRM | `ROBOTRONIX_CRM_FRESH_INSTALL.sql` |
| CRM + Tasks | `ROBOTRONIX_CRM_TASKS_FRESH_INSTALL.sql` |
| Portal + CRM | `ROBOTRONIX_PORTAL_CRM_FRESH_INSTALL.sql` |
| Portal + Tasks | `ROBOTRONIX_PORTAL_TASKS_FRESH_INSTALL.sql` |
| Full suite | `ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql` |

**Use exactly one installer** for a fresh database. The full-suite file already contains all three products and their required optional integrations. Each installer contains numbered steps in execution order. The internal canonical SQL sources and integration modules are not user-facing installation steps.

Run read-only verification **after** installation: `03_verify/01_VERIFY_RELEASE.sql` for Portal, `canonical/08_verify_tasks.sql` for Tasks and `canonical/09_verify_crm.sql` for CRM.

## Authoritative source files

- `canonical/01_portal_manifest.json` and `01_install/modules/`: authoritative Portal schema and reference data.
- `canonical/`: final Tasks and CRM schema, function, and security definitions.
- `packages.json`: authoritative ordered customer package combinations and generated output names.
- `integrations/`: optional cross-product functions and triggers, selected by package.
- `02_qa/`, `security_qa/`, `99_dev_tools/`: DEV-only QA, fixtures and tools.

**Do not run** historical `connect/saas/`, `tasks/`, or `04_existing_db_migrations/` scripts for fresh installs. The `generated/` directory is Git-ignored and must be rebuilt after pulling source changes.

## Safety and remaining verification

These are **fresh installers, not incremental migrations**. Never execute them against an already installed module, partially installed module or the production database. For a partly installed DEV database, either complete the interrupted install from corrected source files or use a separate clean DEV database for single-file testing.

The generator does not connect to Supabase, create Auth users, seed customers, schedule cron jobs, configure Netlify or deploy application code. Static checks pass independently of real SQL execution; every package still needs an isolated Supabase install, RLS verification and application tests.

See [scheduled jobs](../docs/operations/SCHEDULED_JOBS.md) before enabling workers. Do not register overlapping Netlify and pg_cron jobs.
