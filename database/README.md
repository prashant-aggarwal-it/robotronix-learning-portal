# Robotronix database

**Start here:** [canonical/README.md](canonical/README.md) — final-state package definitions for new module installations (including the Portal source manifest).

## What to use

| Purpose | Location | Intended use |
| --- | --- | --- |
| Portal clean installation | [canonical/01_portal_manifest.json](canonical/01_portal_manifest.json) + [01_install](01_install/) | Explicit ordered canonical manifest and authoritative Portal SQL source modules; build one generated installer |
| CRM-only and Tasks-only SQL | [canonical](canonical/) | Separate core schemas, functions, security and read-only verification |
| Optional cross-product integrations | [integrations](integrations/) | Portal↔CRM demos/admissions, CRM↔Tasks synchronization, Portal notifications |
| Portal release validation | [03_verify](03_verify/) | Read-only release verification |
| Development fixtures and security tests | `02_qa/`, `security_qa/`, `99_dev_tools/` | Internal development/QA only; never use in production |

**Not installation entrypoints:** `connect/saas/`, `tasks/` and `04_existing_db_migrations/` are historical development sources referenced by older QA gates. Do not run them or combine them with canonical SQL. They remain in the working tree only until dependent checks are migrated and canonical installation has been tested.

**Scheduler setup:** Database SQL does not register cron jobs. The canonical per-product Netlify schedules, opt-in flags, and duplicate-scheduler cutover procedure are documented in [Scheduled jobs](../docs/operations/SCHEDULED_JOBS.md). Run `npm run check:schedules` before deploying module schedulers.

The `generated/` folder contains locally generated build output, is ignored by Git and may be regenerated. Do not version-control it.

## Product installation boundaries

The canonical **database core** now supports separate Portal, CRM and Tasks installations, with cross-module SQL in optional integration packages. All require Supabase Auth, not Portal tables. **The application remains coupled** in places, and no standalone deployment is certified until isolated SQL execution and API testing pass.

See [canonical/README.md](canonical/README.md) for the current database ordering and safety gates. There is **no customer data, sample user, external credential or cron schedule** in the new module canonical installers.

## Existing production

Production Supabase project `njyktzenybimykpqaegn` already has genuine Portal tables and auth users. **Never rerun the Portal full installer, use dev resets, or drop populated data there.** Back up and validate a new module installation in an isolated database before manual production installation.

Database setup is separate from Netlify environment configuration, app deployment and Meta/Zoom integrations.
