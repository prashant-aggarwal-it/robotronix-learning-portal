# Robotronix modular database dependency boundaries

## Implemented SQL separation and generated installers

Use `npm run db:build-installers` to generate one SQL file for each selection. The generated SQL contains sequential `STEP 01`, `STEP 02`, ... sections. Canonical source filenames retain their internal identifiers; customers do not run those source files individually.

| Customer chooses | One generated SQL installer | Optional integrations included |
| --- | --- | --- |
| Learning Portal only | `ROBOTRONIX_FRESH_INSTALL.sql` | None |
| Connect CRM only | `ROBOTRONIX_CRM_FRESH_INSTALL.sql` | None |
| My Tasks only | `ROBOTRONIX_TASKS_FRESH_INSTALL.sql` | None |
| CRM + Tasks | `ROBOTRONIX_CRM_TASKS_FRESH_INSTALL.sql` | 02 + 03 |
| Portal + CRM | `ROBOTRONIX_PORTAL_CRM_FRESH_INSTALL.sql` | 01 |
| Portal + Tasks | `ROBOTRONIX_PORTAL_TASKS_FRESH_INSTALL.sql` | 04 + 06 |
| Full suite | `ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql` | 01 + 02 + 04 + 05 |

All outputs live in `database/generated/` and are **fresh-install only**. Choose exactly one for a new database; never combine generated installers or run them on an already-installed module. Read-only verification is run separately. See [README](README.md) for the exact procedure.

- Core schema FK relationships reference their own product tables and Supabase Auth, not another product's physical tables.
- Tasks core functions now use `tasks.accounts`, `tasks.user_preferences`, `tasks.notifications` rather than Portal profile and notification tables.
- CRM core functions now use CRM membership IDs/role labels instead of Portal profiles. Without a separate CRM user-display directory, team members appear with a generic/member-ID label, rather than their old Portal display name. The UI integration phase can provide richer names.
- Portal demo scheduling, admissions handoffs, lifecycle synchronization and enrollment-Won enforcement are optional CRM–Portal functionality.
- CRM–Tasks synchronization is optional integration 02. Product-specific linking is either 03 (CRM+Tasks without Portal) or 05 (full suite); install only one, never both.
- Portal task notification fan-out is a separate optional bridge. It does not run for Tasks-only customers.
- The independent SQL modules share *Supabase's* built-in Auth model, not a required Learning Portal profile. They can reside in separate Supabase projects, but the application still must reconcile identity and tenancy for combined customers.

## Remaining limits

**Core SQL separation is implemented and statically checked, not fully deployment-certified.** We still need an isolated fresh-install execution test for each customer combination and checks against actual application APIs before declaring products standalone.

Some existing Next.js routes, onboarding flows, navigation and environment configuration still assume Portal-linked identities or installed integration RPCs. Those issues belong to the separate **application modularisation** stage. We have not modified existing production database records.

The new canonical files are not historical patch chains. They define final objects from day one. Older migration source remains in Git history and some legacy QA-dependent files; do not combine those with the canonical installers.
