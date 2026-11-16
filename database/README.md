# Robotronix Education Suite — Database

**Start with these numbered stages.** Only the numbered folders are operator workflows; the remaining folders hold canonical SQL sources needed by code, generators and tests.

| Order | Folder | Purpose |
| --- | --- | --- |
| 01 | [Reset](01_reset/README.md) | DEV-only reset; already completed for current DEV |
| 02 | [Install](02_install/README.md) | Generate six bounded, ordered SQL Editor files for **new installs**; current DEV already installed |
| 03 | [Reference](03_reference/README.md) | Master data (included in installer) |
| 04 | [Users](04_users/README.md) | Auth users and organization roles |
| 05 | [Seed](05_seed/README.md) | Optional DEV test data |
| 06 | [Verify](06_verify/README.md) | **Actual runnable SQL: Academy, Tasks, CRM, SaaS membership** |
| 07 | [Operations](07_operations/README.md) | OAuth, Zoom, payments, scheduled tasks |

## What is a source folder?

`portal/`, `crm/`, `tasks/`, `saas/`, `shared/`, `platform/`, and `packages.json` are **implementation sources**, not separate installation steps. Do not run them blindly or delete them: application tests and installers refer to them by path.

`generated/` contains build outputs. Different packages are for different deployments; **do not run them all**. To build SQL Editor-friendly chunks, run `npm run db:build-editor` and read `02_install/sql_editor/ORDER.md`.

Historical standalone migrations are under `src/migrations/` and are not fresh-install steps.\n\nOlder folders (`connect/`, `legacy/`, `src/audit/`, `security_qa/`, `src/migrations/`) still contain referenced functionality or release checks. They should not be manually executed as part of the numbered fresh-install flow. They have not been deleted because dependency auditing found references.

## Current DEV state

The consolidated Education Suite installer was executed on DEV, and Academy, Tasks and CRM module verification completed. SaaS tenant isolation and role-based onboarding tests are still outstanding. No additional reset or installer execution is required.

**DEV:** `uzzuquxeeqonxeqcuohh` · **PROD — never reset:** `njyktzenybimykpqaegn`.

Run `node scripts/check-db-operator-layout.mjs` to validate that the operator-facing verification SQL matches canonical source SQL.
