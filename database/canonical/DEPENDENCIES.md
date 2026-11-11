# Module independence and customer-installation design

## Intended offerings

| Customer purchases | Deploy | Final target database ownership |
| --- | --- | --- |
| Portal | Learning Portal only | Portal `public` tables and its own Auth |
| CRM | Connect only | `connect` tables and Connect-owned Auth |
| Tasks | My Tasks only | `tasks` tables and Tasks-owned Auth |
| CRM + Tasks | Both applications/modules | `connect` + `tasks` schemas with shared tenant/user identity or a versioned API link |
| Full Robotronix suite | Portal, Connect, Tasks | All three with explicit integrations and isolated authorization |

These are **target product packages**, not a claim that the current SQL can already be run independently.

## Actual current dependencies (inspected 2026-11-11)

- Portal has an existing independent fresh-install generator (`database/01_install/modules/`) and master-data set.
- Connect's `connect` schema is separate, but some installed routines call Portal demo, enrollment and onboarding tables; `connect_contact_insights` also references Tasks.
- Two Connect staff display-name functions use the Portal `public.profiles` table, so Connect-only installations currently need a product-neutral identity directory or server-supplied staff labels.
- Tasks has its own 21 tables but some functions use `public.profiles`; `task_module_link`, `task_module_links_list`, `sync_crm_task_status`, and `sync_imported_from_crm` also reference Connect.
- The current Next.js auth and app-router implementations also need isolation review; splitting SQL alone cannot guarantee product independence.
- CRM tenant `connect.tenants`, CRM operational `connect.tasks` and personal `tasks.items` have different responsibilities. Do not merge these tables just because both products have a Tasks concept.

## Proposed clean boundaries

1. Keep core CRM/Tasks functions free of Portal and each other's physical tables. Move optional cross-product functionality into `integrations/` modules that install **only when both corresponding products are deployed**.
2. Use provider-neutral Auth identity in a core schema or a module-local account directory. Never require a Portal profile to run CRM-only or Tasks-only features.
3. Use versioned API/integration contracts for Portal ↔ CRM scheduling, admissions, lifecycle and contacts. Do not use cross-product foreign keys or direct SQL reads between independently deployed services.
4. Preserve security: membership checks, RLS, and service-only RPC access; never make the private schemas publicly available to simplify installation.
5. Produce separately executable, tested manifests for Portal, Connect, Tasks, Connect+Tasks and the complete suite. Each customer bundle must have its own full clean-install test and app-level smoke test.

## Current execution safety

Use `database/canonical/README.md` for the current final-state definitions. The source was assembled from the latest **development** database (87 tables, 150 functions) but **has not been run as a clean installation against an isolated empty database**. Do not promote this package to production or advertise module-level independence before resolving the dependencies above.

Development-only QA, old migration sources, and generated build outputs are not deliverables in a customer install package.
