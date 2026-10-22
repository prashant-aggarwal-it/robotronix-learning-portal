# Production security QA fixtures

These fixtures support explicitly authorized tests against the production portal.
They do not disable triggers or Row Level Security.

Before running the seed, create seven dedicated confirmed Supabase Auth users and
assign active `public.profiles` through the existing authorized admin process:

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

1. Execute `03_PROD_SECURITY_QA_SEED.sql` once in Supabase SQL Editor.
2. Check the six counts (expected 1,2,2,2,2,2).
3. Test role and family isolation using the seven dedicated logins.
4. Run `04_PROD_SECURITY_QA_CLEANUP.sql` when finished. Cleanup is blocked if
   scheduled classes exist for these test enrollments.
5. Retire the test Auth users via the authorized Auth admin process separately.

Neither SQL file deletes Auth users or changes RLS, triggers or privilege policy.
They are not an exhaustive functional QA data pack (no Zoom recordings,
attendance, payments or payroll). Never run the archived legacy QA seed in prod.
