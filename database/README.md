# Database — START HERE

This folder contains the canonical SQL for Robotronix Education Suite.
**Never run every file in this folder.** Individual module SQL and historical SQL are not an installation checklist.

## Fresh DEV installation (current status: NOT CERTIFIED)

| Stage | What to use | How |
| --- | --- | --- |
| 0 — Reset (already done for current DEV) | `shared/DEV_RESET_EDUCATION_SUITE_REVIEW_FIRST.sql` | Only for disposable DEV, explicit guard, destructive |
| 1 — Build complete installer | `node scripts/build-education-suite-installer.mjs` | Run from repository root; does not touch database |
| 2 — Install complete suite | `generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql` | **Do not execute yet**: not clean-install certified |
| 3 — Verify schema | `portal/verify.sql`, `tasks/04_verify.sql`, `crm/04_verify.sql` | Read-only; run separately after successful install |
| 4 — Verify SaaS security | `../qa/sql/milestone-c-phase12-readiness.sql` and tenant-isolation rollback tests | Read-only/rollback QA after install |
| 5 — Create Auth test users | `npm run qa:create-users` | Supabase Admin API; set DEV QA passwords privately |
| 6 — Assign roles and create tenants | Signup → Organization → Applications → Invitations | Do not manually insert into `auth.users` |
| 7 — Optional sample records | `portal/qa/`, `crm/qa/`, SaaS tenant tests | DEV only; review prerequisites |
| 8 — External services | OAuth, Zoom, storage, payments, jobs | Configured separately, not by SQL |

### Other supported installers

`npm run db:build-installers` builds the older independent Portal / CRM / Tasks packages using `packages.json`. The output `generated/ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql` **does not include complete SaaS organization onboarding**. Do not use that older file as if it were the complete Education Suite installer.

### How the source is organized

- `portal/`: Academy schema, reference data, DEV QA and verification.
- `crm/`: Connect CRM canonical SQL and verification.
- `tasks/`: Tasks canonical SQL and verification.
- `saas/`: SaaS organization, membership and isolation SQL (currently numbered incremental sources).
- `shared/`: common checks, bridges and reset scripts.
- `generated/`: build outputs, **not** hand-maintained SQL.
- `platform/`: separate additive platform source. Not a standalone fresh installer.
- `audit/`, `04_existing_db_migrations/`, `legacy/`: historical checks/migrations. Do not execute for a fresh install.

**Important:** The new Education Suite installer is presently only an *ordered concatenation* of existing SQL. It is not certified for empty Supabase installation. Further refactoring, real DEV installation and security verification are required before it is marked executable. Do not run on PROD.

Project safeguards: DEV `uzzuquxeeqonxeqcuohh`; PROD `njyktzenybimykpqaegn`. Never use reset or sample fixtures in PROD.
