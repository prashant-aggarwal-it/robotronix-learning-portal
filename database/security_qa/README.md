# Production security QA fixtures

These fixtures support explicitly authorized tests against the production portal.
They do not disable triggers or Row Level Security.

Before running the seed, create seven dedicated confirmed Supabase Auth users and
assign active `public.profiles` through the existing authorized admin process.
To do this automatically, use `scripts/create-prod-security-qa-users.mjs` with a
local (never committed) `.env.security-qa.local` file:

```env
SECURITY_QA_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SECURITY_QA_SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
SECURITY_QA_PRODUCTION_ACK=CREATE_SEVEN_SYNTHETIC_USERS
```

```bash
node scripts/create-prod-security-qa-users.mjs
```

The script refuses to change any existing identity. It generates a strong
individual password per account and prints each password **once**, so capture
them in your password manager (never send them in chat or commit them).
Use a private terminal; terminal output may contain credentials. If the run
fails partway, do not blindly rerun: inspect and resolve the partial setup.

The expected accounts are:

| Email | Role |
| --- | --- |
| qa-sec-admin@robotronixstemlab.com | admin |
| qa-sec-trainer-a@robotronixstemlab.com | trainer |
| qa-sec-trainer-b@robotronixstemlab.com | trainer |
| qa-sec-parent-a@robotronixstemlab.com | parent |
| qa-sec-parent-b@robotronixstemlab.com | parent |
| qa-sec-student-a@robotronixstemlab.com | student |
| qa-sec-student-b@robotronixstemlab.com | student |

Do not put credentials in the SQL file or Git. The seed deliberately does not
alter profile roles. It fails if any expected active profile is missing.

1. Execute `01_PROD_SECURITY_QA_SEED.sql` once in Supabase SQL Editor.
2. Check the six counts (expected 1,2,2,2,2,2).
3. Test role and family isolation using the seven dedicated logins.
4. Run `02_PROD_SECURITY_QA_CLEANUP.sql` when finished. Cleanup is blocked if
   scheduled classes exist for these test enrollments.
5. Retire the test Auth users via the authorized Auth admin process separately.

Neither SQL file deletes Auth users or changes RLS, triggers or privilege policy.
They are not an exhaustive functional QA data pack (no Zoom recordings,
attendance, payments or payroll). Never run the archived legacy QA seed in prod.

## Separate permanent QA template

`03_PERMANENT_PORTAL_QA_SEED_TEMPLATE.sql` is a maintained **template** for the separate four-account permanent portal QA workflow. Do not execute the template directly. The active `npm run qa:prod-permanent:generate-sql` command reads it and writes a local ignored file to `database/security_qa/generated/01_LOCAL_PROD_QA_SEED.sql` after configuring `.env.portal-qa.local`. This is **not** part of DEV setup and must never be run without explicit authorization and a reviewed target.
