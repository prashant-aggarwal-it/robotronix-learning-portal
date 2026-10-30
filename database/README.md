# Robotronix database — CURRENT SQL ONLY

**Authoritative guide for the QA branch.** All SQL in this directory has a defined purpose. **No archived migrations, superseded seeds or post-install patches are retained.** Production database data must never be reset using DEV scripts.

## Two-stage DEV rebuild

**Stage A — install production-equivalent database structure and master reference data**

1. **Optional destructive DEV reset:** `99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` — ONLY after backup and checking the exact DEV project. This drops `public` with CASCADE but retains Supabase `auth.users`. Not needed for a fresh project.
2. `npm ci`, then `npm run db:build-fresh-install` — builds `generated/ROBOTRONIX_FRESH_INSTALL.sql` from **11 ordered schema + 4 reference** source modules.
3. Run the **generated** SQL once in a fresh/empty DEV public schema. Never rerun against an installed database.
4. Run `03_verify/01_VERIFY_RELEASE.sql` (read-only).

**Stage B — create production-like synthetic DEV QA users and linked data**

5. In **Supabase DEV Authentication → Users**, create or reuse **8 confirmed Auth users** (two per role). See `02_qa/README.md` for exact emails. Auth accounts are NOT created by SQL.
6. Run `02_qa/01_PREPARE_DEV_QA_PROFILES.sql` — create/repair the eight Auth-linked role profiles. Skip if already correct.
7. Run `02_qa/02_RUN_DEV_QA_DATA.sql` — one transaction for all related synthetic business fixtures.
8. Run `02_qa/03_VERIFY_DEV_QA.sql` — read-only PASS/FAIL verification.

If the existing DEV setup has passed both verifications, **do not reset or rerun these files**. Proceed to application QA. No real client data or real Zoom/Razorpay provider records are fabricated.

## Folder map

| Folder | Purpose | Execute? |
| --- | --- | --- |
| `01_install/modules/schema/` | 11 canonical ordered schema modules (RLS, triggers, Zoom, billing, scheduling) | **No individually** — use generated installer |
| `01_install/modules/reference/` | 4 canonical ordered master-data modules | **No individually** — use generated installer |
| `01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` | Separate first real Admin bootstrap | Not for 8-user QA |
| `02_qa/` | Exactly 3 current DEV QA SQL scripts and instructions | Yes, in order, DEV only |
| `03_verify/` | Schema/release verification | Read-only |
| `security_qa/` | Separate authorized security/production QA fixtures and generator template | Not part of DEV setup |
| `99_dev_tools/` | Deliberately destructive DEV reset | Only when intentionally rebuilding |
| `generated/` | Locally generated full installer; ignored by Git | Fresh empty DB only |

## Safeguards

- Verify DEV Supabase project reference/URL before running any SQL. Never use DEV seeds on PROD.
- Never paste service-role keys, passwords or real customer data into SQL/Git.
- Never disable privilege triggers or RLS except the scoped trusted profile bootstrap transaction that restores its trigger before COMMIT.
- The installer and dataset have separate purposes. **Do not run both against a populated database.**
- These scripts are code-reviewed fixtures, not proof of successful execution on your specific Supabase project. Check both verification files and run authenticated application QA.

Read `02_qa/README.md` for the full eight-user checklist and test scenarios.
