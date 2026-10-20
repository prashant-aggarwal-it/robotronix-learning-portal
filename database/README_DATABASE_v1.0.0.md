# Robotronix™ Database — current reference

**Authoritative documentation:** [Database and QA](../docs/FRESH_INSTALL_AND_QA.md), [Environment setup](../docs/ENVIRONMENTS.md), [Testing](../docs/TESTING.md).

## SQL inventory

| File | Purpose | Environment |
| --- | --- | --- |
| `01_install/01_CREATE_SCHEMA.sql` | Full schema, consolidated integrations and RLS | **Brand new empty project only** |
| `01_install/02_INSERT_MASTER_REFERENCE_DATA.sql` | Configuration/reference data | New project |
| `01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` | Admin profile bootstrap example | Only if needed; edit email |
| `02_qa/01_QA_SEED.sql` | Synthetic profiles and workflow fixtures | **Dev only** |
| `02_qa/02_QA_CLEANUP.sql` | Remove synthetic fixture data | **Dev only** |
| `03_verify/01_VERIFY_RELEASE.sql` | Verify important schema features | Dev and Production |
| `99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` | Destructive public-schema reset | **Disposable Dev only** |

## Install from zero

1. Create a separate Supabase project for each environment.
2. In an **empty** project run `01_install/01_CREATE_SCHEMA.sql`, followed by `01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`.
3. Configure Auth/Google callbacks and create the first Admin account where required.
4. Run `03_verify/01_VERIFY_RELEASE.sql`.
5. For Dev only, create dedicated QA Auth users, then run `02_qa/01_QA_SEED.sql` and application test commands.

## Live environment rules

- Both Dev and Production installations have previously been performed in this project; **do not repeat** the fresh schema merely because a new frontend revision is deployed.
- Preserve the existing Production real Admin. Do not create Dev QA fixtures in Production.
- Superseded `database/04_upgrade` scripts were integrated into the canonical installer and removed.
- `database/archive/legacy` contains old sanity/QA SQL for history **only**. Never use those instructions to configure or reset a live environment.
- Future changes to an already installed database need independently reviewed migration SQL, backup awareness, and an explicit deployment plan.

See the docs hub for Zoom, Razorpay, Netlify and the application lifecycle.

## P1 action notifications change set (2026-10-20)

The canonical fresh-install `01_install/01_CREATE_SCHEMA.sql` **already includes** the action-required notification triggers. Existing installed DEV databases can instead apply `01_install/04_PRIORITY1_ACTION_NOTIFICATIONS.sql` **once after checking the existing baseline**. Do **not** run that additive file after a fresh schema installation; it is provided as the explicit upgrade path, not a new baseline step. Production application requires review, backup and approval. See [P1 event matrix and manual QA](../docs/PRIORITY1_ACTION_NOTIFICATIONS.md).
