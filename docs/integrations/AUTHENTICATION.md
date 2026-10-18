# Authentication, Google sign-in and role access

## What it does

Supabase Authentication establishes identity. Application profiles and linked business records determine whether a signed-in user may access Admin, Trainer, Parent or optional Student pages. Permissions must be validated by server-side logic/RLS as well as the user interface.

## Initial setup (repeat independently in DEV and PROD)

1. In Google Cloud create or select an OAuth project and configure its consent screen/client.
2. In Supabase Authentication → Providers, enable Google and configure that environment's Google OAuth client credentials.
3. In Supabase Auth URL settings, configure the correct Site URL and allowed redirect URLs for your local/dev or deployed hostname. Use the **exact** callback/redirect URI supplied by Supabase and the app provider screens; do not invent URI variants.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_URL` for that environment. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
5. Verify `/login` → Google sign-in → `/auth/callback` → correct role landing page.
6. Confirm an unlinked signed-in person cannot access Admin/Trainer/other families' records.

## Initial real Admin

- Production's existing real Admin is `robotronixstemlab@gmail.com`; its profile was previously verified `admin` and active.
- **Never overwrite, delete, repurpose or replace that identity for QA.**
- A new blank environment can use `database/01_install/03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql`, after editing the target email intentionally; do not rerun for an existing Admin.

## Role model and onboarding

- Admin provisions/reviews learners, trainers and enrollments.
- Parent account is linked to learners; siblings should share an existing family identity.
- Trainer portal is tied to the assigned Trainer record.
- Student access is optional and must be explicitly linked for a learner; Parent can access the child learning view without it.
- Portal access administration resides at `/admin/account` or associated admin access management flows; API reference: `app/api/admin/portal-access/route.ts`.

## QA and security

- DEV QA identities are `qa-admin@robotronix.local`, `qa-trainer@robotronix.local`, `qa-parent@robotronix.local`, `qa-student@robotronix.local`; seeded only in DEV.
- Use unique strong passwords and protected local environment files; never copy private Auth data into docs/commits.
- Test each role, cross-role denial, unlinked account behavior, parent isolation and optional Student linkage.
- Production QA identities are *optional* and are not needed for routine release smoke testing.

See [Database and QA](../FRESH_INSTALL_AND_QA.md) and [Testing](../TESTING.md).
