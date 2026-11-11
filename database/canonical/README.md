# Robotronix canonical database installation

**Source of truth (in consolidation): FINAL database definitions, not historical migrations.**

This directory defines each module's tables, constraints, indexes, functions, triggers, and security **exactly as they should exist from the beginning**. Each object is defined once. No historical ALTER-by-ALTER patch chain, destructive cleanup, or sample account data is required.

## Install order

### Scenario A — completely fresh Robotronix environment

1. Provision Supabase Auth and a new empty database.
2. Install the Portal using the existing source modules in `database/01_install/modules/` via `npm run db:build-fresh-install`. Run the generated `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` **once**. It creates the Portal schema and master reference data.
3. Run the **Tasks + Connect steps** below, in their listed order.
4. Run the Portal release verification (`database/03_verify/01_VERIFY_RELEASE.sql`) and the final canonical verification below.

### Scenario B — existing Robotronix production Portal

Your production project is `njyktzenybimykpqaegn`. It already has the Portal public schema and real users; **do not run the Portal fresh-installer again**. After a restorable backup and clean-install validation, run only these scripts:

| Order | File | Purpose |
| --- | --- | --- |
| 00 | [00_preflight.sql](00_preflight.sql) | Existing Portal required, Tasks/Connect absent |
| 02 | [02_tasks_schema.sql](02_tasks_schema.sql) | Final Tasks table/constraint/index definitions |
| 03 | [03_tasks_functions.sql](03_tasks_functions.sql) | Final Tasks service RPCs, one definition per signature |
| 04 | [04_crm_schema.sql](04_crm_schema.sql) | Final Connect CRM table/constraint/index definitions |
| 05 | [05_crm_functions.sql](05_crm_functions.sql) | Final CRM, messaging, Portal integration RPCs |
| 06 | [06_triggers_security.sql](06_triggers_security.sql) | All final triggers, RLS policies, private ACL |
| 07 | [07_verify.sql](07_verify.sql) | Read-only module schema and security checks |

The deliberately unused number 01 denotes the Portal foundation, maintained by the existing fresh-install generator; a completely fresh environment installs that foundation once, while existing production does not. SQL Editor users: open each **entire raw** script, execute one file per query in order, and **stop if any script fails**. Do not continue after an error. Every DDL file is transactional.

## Status and provenance

- Draft canonical snapshot captured from Development project `fflejkqcspivnhsmkdtn`, 2026-11-11.
- **87 module tables:** 21 Tasks and 66 CRM.
- **150 functions:** 64 Tasks-related and 86 Connect/Portal-integration related; 11 module triggers and 15 existing RLS policies.
- The canonical schema scripts use complete `CREATE TABLE` definitions with all final columns/constraints. Foreign keys are declared *after* creating tables **within the same first-time installation**, solely to resolve inter-table references and cycles; this is not a historical patch migration.
- Final service functions are captured directly from the latest Development database. Two CRM list functions are adjusted to read `public.profiles.full_name` instead of attempting restricted `auth.users` reads. The verified guardian admission handoff RPC uses an email status checked by the server.
- The old `database/release_install/`, `database/tasks/`, and `database/connect/saas/` files are superseded historical source and **not** the canonical entrypoint. Retain until clean-install testing and CI reference migration are complete; later remove obsolete checked-in copies and rely on Git history.
- No `pg_cron` schedules, deployment credentials, Meta phone number registration, or sample production users are included.
- Database function/table access uses the private `tasks` and `connect` schemas. Do not expose them directly in Supabase Data API.
- **Not yet clean-install certified.** Object-count and SQL-source structural checks do not prove that all statements can execute in sequence on a truly empty database. Test in an isolated expendable database before applying to production. This directory is not approved for live execution yet.
- The Portal fresh-install generator currently remains the independent canonical source for the original Portal module; its own consolidation can be handled separately without changing production data.

## No incremental patch files in the canonical installer

Past migrations remain in Git history and may still be necessary to **upgrade an already-installed, older database**. They are not part of this clean-first-install directory. Don't rerun these fresh installers on an existing `tasks` or `connect` schema.
