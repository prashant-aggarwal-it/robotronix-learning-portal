# Database module boundaries

Canonical SQL lives inside `database/portal/`, `database/tasks/`, and `database/crm/`. The authoritative combinations are listed in `database/packages.json`, and `npm run db:build-installers` generates a single SQL file for every combination.

| Module | Core dependency | Optional bridges |
| --- | --- | --- |
| Portal | Supabase Auth | CRM admission/demos and Tasks notifications |
| Tasks | Supabase Auth, private `tasks` schema | CRM task status sync, Portal class links |
| CRM | Supabase Auth, private `connect` schema | Portal admissions/demos, Tasks links |

Full-suite installers execute core products together then only the required integrations in `database/shared/integrations/`. Link implementations `03_tasks_crm_links.sql`, `05_full_suite_task_links.sql` and `06_tasks_portal_links.sql` are alternatives; never manually combine them.

Tasks and CRM core SQL may be installed without Portal tables, though the full Next.js application still requires independent deployment and authenticated API testing before it can be advertised as standalone.

Fresh installers are **not upgrades** and must not be applied to existing Production, populated DEV or partially installed module schemas. Historical migrations are retained separately while upgrade consumers are audited. The DEV schema reset template in `database/shared/` is disabled by default and is not a full Supabase project reset.

See [the single installation guide](../README.md) and [scheduled jobs](../../docs/operations/SCHEDULED_JOBS.md).
