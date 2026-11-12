# Shared database prerequisites, integrations and guarded DEV tools

- `preflight.sql`: Supabase Auth/service-role prerequisite check.
- `integrations/`: optional CRM ↔ Portal, Tasks ↔ CRM, and Tasks ↔ Portal integration SQL.
- `DEV_RESET_ROBOTRONIX.sql`: **preferred** one-file DEV reset for the three app schemas and all database cron jobs; edit one explicit confirmation token before running.
- `DEV_RESET_APP_SCHEMAS.sql`: older marker-based, DEV-only reset retained for compatibility; does not remove cron.

Run `npm run db:build-installers` and select one generated customer package. The generator includes the correct optional integrations; **do not run these integration scripts again**. Link variants `03`, `05` and `06` are mutually exclusive.

Full reset caution: the new script removes all app schemas and unschedules all database pg_cron jobs. Both reset variants leave Supabase Auth users, Storage contents, externally deployed functions and Netlify schedules intact. A truly new Supabase configuration requires a separate project. It requires an operator-created, independently verified DEV marker and a manually edited confirmation token. See [database README](../README.md) for restrictions.

Production database modifications and deployments are outside this workflow.
