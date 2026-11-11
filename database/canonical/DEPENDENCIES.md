# Robotronix modular database dependency boundaries

## Implemented SQL separation

All new-customer **core** database definitions are split by product:

| Customer chooses | Database installer | Optional integration |
| --- | --- | --- |
| Learning Portal only | `database/01_install/` | None |
| Connect CRM only | `canonical/03_crm_schema.sql` + `05_crm_functions.sql` + `07_crm_security.sql` | None |
| My Tasks only | `canonical/02_tasks_schema.sql` + `04_tasks_functions.sql` + `06_tasks_security.sql` | None |
| CRM + Tasks | Both independent cores | `integrations/02_tasks_crm.sql` |
| Portal + CRM | Portal + CRM | `integrations/01_crm_portal.sql` |
| Portal + Tasks | Portal + Tasks | `integrations/03_tasks_portal_notifications.sql` |
| Full suite | Portal + CRM + Tasks | `integrations/01`, `02`, `03`, `04_full_suite_task_links.sql` |

See [README](README.md) and [integration instructions](../integrations/README.md) for exact run order.

- Core schema FK relationships reference their own product tables and Supabase Auth, not another product's physical tables.
- Tasks core functions now use `tasks.accounts`, `tasks.user_preferences`, `tasks.notifications` rather than Portal profile and notification tables.
- CRM core functions now use CRM membership IDs/role labels instead of Portal profiles. Without a separate CRM user-display directory, team members appear with a generic/member-ID label, rather than their old Portal display name. The UI integration phase can provide richer names.
- Portal demo scheduling, admissions handoffs, lifecycle synchronization and enrollment-Won enforcement are optional CRM–Portal functionality.
- Tasks-to-CRM module linking and status synchronization are in the optional CRM + Tasks package. Full-suite linking to Portal schedule events is in its own optional package.
- Portal task notification fan-out is a separate optional bridge. It does not run for Tasks-only customers.
- The independent SQL modules share *Supabase's* built-in Auth model, not a required Learning Portal profile. They can reside in separate Supabase projects, but the application still must reconcile identity and tenancy for combined customers.

## Remaining limits

**Core SQL separation is implemented and statically checked, not fully deployment-certified.** We still need an isolated fresh-install execution test for each customer combination and checks against actual application APIs before declaring products standalone.

Some existing Next.js routes, onboarding flows, navigation and environment configuration still assume Portal-linked identities or installed integration RPCs. Those issues belong to the separate **application modularisation** stage. We have not modified existing production database records.

The new canonical files are not historical patch chains. They define final objects from day one. Older migration source remains in Git history and some legacy QA-dependent files; do not combine those with the canonical installers.
