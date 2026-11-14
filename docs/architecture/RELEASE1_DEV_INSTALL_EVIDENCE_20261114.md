# Release 1 DEV clean installation evidence — 2026-11-14

Target DEV: `uzzuquxeeqonxeqcuohh`. Production `njyktzenybimykpqaegn` was not modified.

The user explicitly authorized resetting the DEV application schemas without a backup. The old `public`, `connect`, and `tasks` application schemas were reset after relocating the relocatable `btree_gist` extension into the existing `extensions` schema. The single Supabase Auth user was preserved.

## Applied canonical sources

- Portal manifest: all 13 `database/portal/schema/` modules, then all four `database/portal/reference/` modules.
- Tasks: `01_schema.sql`, `02_functions.sql`, `03_security.sql`.
- CRM: `01_schema.sql`, `02_functions.sql`, `03_security.sql`.
- Full-suite bridges: `01_crm_portal.sql`, `02_tasks_crm.sql`, `04_tasks_portal_notifications.sql`, `05_full_suite_task_links.sql`.
- Note: canonical constituent files were applied in package order via Supabase SQL execution, **not** a single generated installer file. The installer generator had earlier passed source CI.

All 27 SQL source modules returned successful execution, without a reported SQL error. Post-install read-only verification scripts executed without SQL error: `portal/verify.sql`, `tasks/04_verify.sql`, `crm/04_verify.sql`, and `audit/verify_release1_contracts_readonly.sql`.

## Observed installed catalog counts

| Schema | Tables | RLS-enabled | Indexes |
| --- | ---: | ---: | ---: |
| public | 80 | 69 | 190 |
| connect | 66 | 66 | 168 |
| tasks | 21 | 21 | 60 |
| **Total** | **167** | **156** | **418** |

Observed: 241 functions in the three application schemas, 143 RLS policies, 92 non-internal triggers, 302 foreign keys.

The eleven public tables without RLS had neither anon nor authenticated direct SELECT grants at the time of inspection. Tasks.items and connect.opportunities both had RLS enabled and no direct SELECT grants to anon/authenticated. The security advisor reported RLS-enabled tables lacking policies in service-only modules; do not assume these need broad client access.

## Status / remaining gates

**Database schema installation successful; not full Release 1 certification.** Runtime positive/negative persona tests, cross-tenant isolation, real CRM ↔ Academy ↔ Tasks workflows, finance/payroll idempotency, Zoom/Razorpay/WhatsApp callbacks, active worker configurations, backup/rollback rehearsal, and application E2E still require evidence. No live provider E2E occurred.

No changes to main, baseline branch, Netlify deployment, or PROD.
