# Robotronix database

**Start here:** [canonical/README.md](canonical/README.md) — final-state SQL definitions for new module installations.

## What to use

| Purpose | Location | Intended use |
| --- | --- | --- |
| Portal clean installation | [01_install](01_install/) | Existing Portal installer generator and master reference data |
| Tasks + CRM final-state SQL | [canonical](canonical/) | Canonical schemas, final functions, triggers, security and verification; undergoing full clean-install certification |
| Portal release validation | [03_verify](03_verify/) | Read-only release verification |
| Development fixtures and security tests | `02_qa/`, `security_qa/`, `99_dev_tools/` | Internal development/QA only; never use in production |

**Not installation entrypoints:** `connect/saas/`, `tasks/` and `04_existing_db_migrations/` are historical development sources referenced by older QA gates. Do not run them or combine them with canonical SQL. They remain in the working tree only until dependent checks are migrated and canonical installation has been tested.

The `generated/` folder contains locally generated build output, is ignored by Git and may be regenerated. Do not version-control it.

## Product installation boundaries

The intended customer offerings are **Portal only**, **CRM + Tasks**, **Tasks only** and **the complete suite**. The current schemas are separate (`public`, `connect`, `tasks`), but **the application and database functions are not yet fully standalone**. Some CRM routines read Portal tables or Tasks; some Tasks routines read CRM or Portal tables; authentication is shared. Therefore do **not** advertise the current CRM or Tasks canonical scripts as independently installable without a dependency-decoupling pass and clean-install test.

See [canonical/README.md](canonical/README.md) for the current database ordering and safety gates. There is **no customer data, sample user, external credential or cron schedule** in the new module canonical installers.

## Existing production

Production Supabase project `njyktzenybimykpqaegn` already has genuine Portal tables and auth users. **Never rerun the Portal full installer, use dev resets, or drop populated data there.** Back up and validate a new module installation in an isolated database before manual production installation.

Database setup is separate from Netlify environment configuration, app deployment and Meta/Zoom integrations.
