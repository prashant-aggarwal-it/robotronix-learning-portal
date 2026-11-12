# My Tasks database

Internal canonical source order:

1. `01_schema.sql`
2. `02_functions.sql`
3. `03_security.sql`
4. `04_verify.sql` (read-only)

Use `npm run db:build-installers` from the repository root and choose **one generated SQL installer** for Tasks-only or the desired combination. Do **not** manually run these individual sources as well.

The Tasks schema is private and should not be exposed to the Supabase Data API. App APIs must authenticate the user and enforce ownership permissions.

See [database README](../README.md).
