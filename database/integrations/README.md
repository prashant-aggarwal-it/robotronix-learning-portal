# Optional integration packages — final product-specific SQL

Each customer's core is installed from `database/canonical`. Cross-product functions, business synchronization and Portal notifications install **only when those products coexist**.

| File | Required modules | Installs |
| --- | --- | --- |
| [01_crm_portal.sql](01_crm_portal.sql) | CRM + Portal | Demo booking, admissions, lifecycle and guarded Won-stage logic |
| [02_tasks_crm.sql](02_tasks_crm.sql) | Tasks + CRM | Bidirectional task-status sync functions and triggers |
| [03_tasks_crm_links.sql](03_tasks_crm_links.sql) | Tasks + CRM, **without Portal** | Final CRM-only task-link RPCs |
| [04_tasks_portal_notifications.sql](04_tasks_portal_notifications.sql) | Tasks + Portal | Optional Portal notification fan-out |
| [05_full_suite_task_links.sql](05_full_suite_task_links.sql) | Portal + CRM + Tasks | Final full-suite task-link RPCs supporting CRM records and Portal classes |

## Install the right combination

**CRM + Tasks only:** install independent CRM and Tasks core files, then **02 → 03**.

**CRM + Portal:** install Portal and independent CRM core, then **01**.

**Tasks + Portal:** install Portal and independent Tasks core, then **04**.

**Complete suite:** install Portal and both independent cores, then **01 → 02 → 04 → 05**.

**Important:** 03 and 05 are **mutually exclusive**. Each gives the final initial definition of the same `task_module_link` and `task_module_links_list` functions for a particular product combination. Never install one and then the other as a patch. This preserves the no-incremental-patches principle for a fresh customer deployment.

All scripts are transactional, reject missing dependencies and grant RPC usage only to `service_role`. They create no sample data, provider credentials or scheduled jobs.

## Limitations

SQL separation does not yet certify the standalone Next.js application, Auth experience, routing, navigation or billing entitlements. Those require the subsequent application modularisation phase.

**Do not execute on production yet.** An isolated clean-environment run of each installation combination and authenticated API tests is still required. Existing production Portal records are not to be reset or replaced.
