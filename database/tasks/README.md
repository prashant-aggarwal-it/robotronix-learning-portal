# My Tasks database

Internal canonical source order:

1. `01_schema.sql`
2. `02_functions.sql`
3. `03_security.sql`
4. `04_verify.sql` (read-only)

Use `npm run db:build-installers` from the repository root and choose **one generated SQL installer** for Tasks-only or the desired combination. Do **not** manually run these individual sources as well.

The historical V2 phase scripts (10–25) have been preserved at `database/legacy/tasks/v2/` after checking that their final tables, fields, functions and recurrence trigger exist in the canonical installer. They are **not** additional installation steps. DEV-only samples and historical verification are in `qa/`. A static V2 object-coverage gate runs during `npm run db:check-canonical`; behavior must still be tested in a clean Supabase DEV database.

The Tasks schema is private and should not be exposed to the Supabase Data API. App APIs must authenticate the user and enforce ownership permissions.

See [database README](../README.md).
