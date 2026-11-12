# Robotronix canonical database — one generated installer per package

**Use generated installers for every fresh installation.** Do not run the internal schema/functions/security SQL files one by one. Each installer is assembled from the authoritative canonical source files in dependency order, with numbered `STEP 01`, `STEP 02`, ... sections. Canonical source files are now grouped by product and numbered **01–04** within each folder; generated installers also have sequential installation steps.

## Build all seven customer installers

From the repository root on the latest feature branch:

```powershell
npm run db:build-installers
```

The command runs canonical and package checks, validates the Portal source modules, regenerates the Portal installer and produces the other six SQL bundles. It **does not connect to Supabase or modify any database**.

| Install selection | Single generated SQL file |
| --- | --- |
| **Learning Portal only** | `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` |
| **My Tasks only** | `database/generated/ROBOTRONIX_TASKS_FRESH_INSTALL.sql` |
| **Connect CRM only** | `database/generated/ROBOTRONIX_CRM_FRESH_INSTALL.sql` |
| **CRM + Tasks** | `database/generated/ROBOTRONIX_CRM_TASKS_FRESH_INSTALL.sql` |
| **Portal + CRM** | `database/generated/ROBOTRONIX_PORTAL_CRM_FRESH_INSTALL.sql` |
| **Portal + Tasks** | `database/generated/ROBOTRONIX_PORTAL_TASKS_FRESH_INSTALL.sql` |
| **Complete Portal + CRM + Tasks** | `database/generated/ROBOTRONIX_FULL_SUITE_FRESH_INSTALL.sql` |

**Choose exactly one bundle for a fresh database.** For example, the full-suite installer already contains Portal, Tasks, CRM, and exactly the required integrations; do not run the three standalone installers as well. The combined installers embed the same canonical definitions and do not duplicate source code.

## How to install on a brand-new Supabase DEV project

1. Create a new Supabase project and confirm you are in its **DEV** SQL Editor.
2. Run `npm run db:build-installers` locally.
3. Choose **one** generated SQL file from the table above. Copy its entire contents into a new SQL Editor query and run it **once**. Stop at the first error; do not blindly rerun.
4. Run the appropriate **read-only** verification files **separately**:
   - Portal installed: `database/03_verify/01_VERIFY_RELEASE.sql`
   - Tasks installed: `database/canonical/tasks/04_verify.sql`
   - CRM installed: `database/canonical/crm/04_verify.sql`
5. Only after verification, set up DEV Auth users, application environment variables, optional provider credentials and background workers.

The generated SQL includes sequential `STEP 01`, `STEP 02`, etc. The non-Portal bundles start with a Supabase prerequisite check. The Portal-only installer retains its established manifest-driven format. The verification scripts are intentionally not embedded: installation failures and verification failures must remain distinguishable.

## Already partially installed a module?

**These are fresh-install scripts, not upgrades or resume scripts.** If Portal is installed and `tasks` schema creation succeeded but Tasks functions failed, do **not** run the generated Tasks or full-suite installer over that partially installed project: their schema guards will reject the existing schema. Either finish the in-progress installation using the corrected internal source files in the documented order, or start a separate clean DEV project to test the single-file installation. Never reset an existing project without explicit approval.

## Canonical source and architecture

- `database/canonical/portal/manifest.json` selects 13 Portal schema and 4 reference modules from `database/01_install/modules/`.
- `database/canonical/tasks/01_schema.sql` → `02_functions.sql` → `03_security.sql` → `04_verify.sql` are the **internal** Tasks sources.
- `database/canonical/crm/01_schema.sql` → `02_functions.sql` → `03_security.sql` → `04_verify.sql` are the **internal** CRM sources.
- `database/packages.json` is the canonical list of customer package combinations and ordered integrations.
- `database/integrations/` contains optional bridges. Link scripts `03`, `05`, and `06` are **mutually exclusive**. The builder selects only the appropriate one.

The private `tasks` and `connect` schemas remain independent of Portal tables at the database-core level. Supabase Auth and `service_role` are shared prerequisites. SQL packages do not create users, sample customers, credentials, cron schedules or Netlify deployments.

## Validation and release limits

```powershell
npm run db:check-canonical
npm run db:check-packages
npm run db:build-installers
```

Static checks and generation are **not** proof of successful SQL execution. Every selected package still needs a real isolated Supabase clean-install test, read-only verification and authenticated application QA. The Next.js application's standalone deployment behavior is a separate concern.

**Production safety:** Never run any fresh installer against the existing production database. Use reviewed incremental migrations for upgrades. Generated SQL in `database/generated/` is local, Git-ignored build output.
