# Optional integrations — install only when both required products exist

The `database/canonical` core modules are installable independently at the **database** level. This directory restores cross-product behavior without making it a prerequisite for the core modules.

| Integration script | Requires | Functionality |
| --- | --- | --- |
| [01_crm_portal.sql](01_crm_portal.sql) | Connect CRM + Learning Portal | Demo booking, admission handoffs, Portal lifecycle, CRM follow-ups, guarded Won-stage trigger |
| [02_tasks_crm.sql](02_tasks_crm.sql) | Tasks + Connect CRM | CRM task/contact/opportunity links and bidirectional task-status synchronization |
| [03_tasks_portal_notifications.sql](03_tasks_portal_notifications.sql) | Tasks + Learning Portal | Forward Tasks reminders and assignment notifications into Portal notifications |
| [04_full_suite_task_links.sql](04_full_suite_task_links.sql) | Tasks + CRM + Portal | Extend the Tasks module-link RPCs to support Portal class events alongside CRM records |

## Installation sequence

Run the independent base installers first, including each module's security file. Then install the applicable integrations above in numbered order. Full suite: **01 → 02 → 03 → 04**.

The full-suite task-links file deliberately replaces only the two `task_module_link` and `task_module_links_list` RPC bodies from the CRM+Tasks integration. This is a product-specific optional implementation, *not* a chain of historical schema patches.

All SQL files are transactional, reject missing prerequisite schemas, enforce service-role-only RPC grants and do not create users, sample tenants, scheduled jobs or external credentials.

## Product isolation boundary

Core `tasks` and `connect` SQL **does not require Portal tables** or direct references to each other's tables. Both products still require a Supabase project's built-in `auth.users` for identity; that is not the Learning Portal itself.

Application decoupling is the **next separate phase**: some Next.js routes still assume Portal navigation, shared sessions and integrated RPCs. A standalone SQL install does not by itself make the current deployed UI standalone.

## Important validation limits

These scripts are grounded in development schema definitions, but **a clean isolated database installation has not yet been completed**. Do not apply to a real production project until schema execution, auth/RLS and API smoke tests have passed in a disposable environment.

Existing production Portal data must not be reset or replaced. Historical incremental SQL files are not included in any new customer installation.
