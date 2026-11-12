# Shared database prerequisites, integrations and guarded DEV tools

- `preflight.sql`: Supabase Auth/service-role prerequisite check.
- `integrations/`: optional CRM ↔ Portal, Tasks ↔ CRM, and Tasks ↔ Portal integration SQL.
- `DEV_RESET_APP_SCHEMAS.sql`: intentionally disabled, destructive **DEV-only** application-schema reset template.

Run `npm run db:build-installers` and select one generated customer package. The generator includes the correct optional integrations; **do not run these integration scripts again**. Link variants `03`, `05` and `06` are mutually exclusive.

Full reset caution: a safe, fully fresh Supabase environment is created with a new DEV project. The guarded reset template only drops application schemas, leaving Supabase Auth, Storage and cron registrations alone. It requires an operator-created, independently verified DEV marker and a manually edited confirmation token. See [database README](../README.md) for restrictions.

Production database modifications and deployments are outside this workflow.
