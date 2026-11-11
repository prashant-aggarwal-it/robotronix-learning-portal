# Robotronix canonical database — final-state, modular SQL

The canonical source contains complete initial definitions of each table, foreign key, index, function, trigger and permission. **It does not contain historical patch chains.** Core CRM and My Tasks installations are independent from each other and from the Learning Portal *at the database-definition level*.

## Manual Supabase installation packages

Run [00_preflight.sql](00_preflight.sql) once before selecting a package. It checks the shared Supabase Auth prerequisite; neither CRM nor Tasks requires Portal tables.

| Package | Required SQL files in order |
| --- | --- |
| **My Tasks only** | [02_tasks_schema.sql](02_tasks_schema.sql) → [04_tasks_functions.sql](04_tasks_functions.sql) → [06_tasks_security.sql](06_tasks_security.sql) → [08_verify_tasks.sql](08_verify_tasks.sql) |
| **Connect CRM only** | [03_crm_schema.sql](03_crm_schema.sql) → [05_crm_functions.sql](05_crm_functions.sql) → [07_crm_security.sql](07_crm_security.sql) → [09_verify_crm.sql](09_verify_crm.sql) |
| **CRM + Tasks** | Both core packages, then integration [02 sync](../integrations/02_tasks_crm.sql) and [03 CRM-only task links](../integrations/03_tasks_crm_links.sql) |
| **Learning Portal only** | Use the separate `database/01_install/` Portal fresh-install generator and master reference data |
| **Complete suite** | Portal foundation, both core packages, then integrations [01](../integrations/01_crm_portal.sql), [02](../integrations/02_tasks_crm.sql), [04](../integrations/04_tasks_portal_notifications.sql), [05](../integrations/05_full_suite_task_links.sql) |

For **Portal + CRM**, install Portal + CRM plus integration 01. For **Portal + Tasks**, install Portal + Tasks plus integration 04. See [integrations/README.md](../integrations/README.md).

### Execution conditions

- These are **fresh-module installers**, not upgrades. Never rerun a schema file after its module is installed.
- They assume a normal Supabase project with `auth.users` and `service_role` available. Each module can use its own Supabase project; a full suite may use one shared project, but the application must reconcile authentication.
- The private `connect` and `tasks` schemas are not exposed to anonymous or client-authenticated Data API roles. Server-only RPCs perform tenant/user permission checks.
- **Do not execute anything on current production yet.** The installers have passed static structural checks, but have **not passed a complete isolated clean-database installation**.
- No destructive resets, background cron scheduling, Meta/Zoom secrets, sample customers or demo data are included. The necessary per-module Netlify workers and activation flags are documented in [Scheduled jobs](../../docs/operations/SCHEDULED_JOBS.md); deploy those separately after the SQL package is installed and tested.

## What's canonical

| Product | Tables | Core functions | Core triggers | RLS policies |
| --- | ---: | ---: | ---: | ---: |
| Tasks | 21 | 60 | 3 | 15 |
| Connect CRM | 66 | 76 | 5 | 0 |

CRM's tables have RLS enabled but are accessed through trusted, authorization-enforcing server RPCs. Zero CRM policies means direct client table access is intentionally not granted.

Integrations introduce Portal admission and demo functions, CRM–Tasks synchronization and Portal notification fan-out. Task-link files 03 and 05 are mutually exclusive final implementations (CRM+Tasks vs full suite), not sequential patches. All historical capabilities are retained as optional modules or in Git history; nothing is silently deleted from the product.

## Application boundary

The *SQL packages* are independently scoped. **The Next.js frontend, routing, authentication setup and feature flags still require a separate application-modularization phase** before they can be sold as independently deployed applications. Do not claim end-to-end standalone functionality until that work and its tests pass.

The old `database/connect/saas`, `database/tasks` and `database/04_existing_db_migrations` scripts were development-stage sources. They remain only for legacy QA references; do **not** run them during a new installation. `database/generated/` is local Git-ignored Portal build output.

## Quality gate

Run `npm run db:check-canonical` for static counts, forbidden dependencies and patch detection. Then run every customer package on a disposable Supabase/Postgres environment, verify RLS and SQL objects, and test authenticated CRM/Tasks API flows. Only then use the manual production SQL Editor process.
