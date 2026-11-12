# Connect CRM database

Internal canonical source order:

1. `01_schema.sql`
2. `02_functions.sql`
3. `03_security.sql`
4. `04_verify.sql` (read-only)

Use `npm run db:build-installers` from the repository root and choose **one generated SQL installer** for CRM-only or a selected combination. Do **not** manually run these files in addition to a generated installer.

`qa/01_prepare_dev_roles.sql` is optional **DEV** integration QA and expects the Portal QA users and an existing Connect workspace. Never seed real customers through QA scripts.

See [database README](../README.md).
