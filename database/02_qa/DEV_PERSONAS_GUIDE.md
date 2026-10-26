# Robotronix DEV Persona Dataset (synthetic / non-production)

## Purpose
Use **representative, interconnected fictitious data** to test the actual role-based Robotronix application against the **DEV Supabase** project. No actual client details, payments, provider invoices or Zoom meetings are generated. This data is deliberately **not exhaustive** for every integration or negative test.

## Preconditions
1. Confirm the Supabase dashboard is showing your **DEV project ID**.
2. Run `npm run db:build-fresh-install` and apply `database/generated/ROBOTRONIX_FRESH_INSTALL.sql` **only if the DEV database is new and empty**. Do not reinstall over an existing dataset.
3. Run `database/03_verify/01_VERIFY_RELEASE.sql` and inspect all result sets.
4. Create **eight Auth users** with unique passwords in Supabase DEV → Authentication → Users. Set email confirmed; these are manual Auth accounts, **not** created by the SQL. Use unique DEV-only passwords; never put passwords in SQL.
5. Execute `database/02_qa/01_QA_SEED.sql`, then `database/02_qa/03_DEV_PERSONAS.sql`, then `database/02_qa/04_VERIFY_DEV_PERSONAS.sql`. Read ALL errors and verification rows. Do **not** run QA cleanup before the extended seed.

## Auth user checklist

| Email | Role | Persona |
| --- | --- | --- |
| qa-admin@robotronix.local | Admin | Baseline admin |
| qa-admin-2@robotronix.local | Admin | Second admin |
| qa-trainer@robotronix.local | Trainer | Delhi robotics mentor |
| qa-trainer-2@robotronix.local | Trainer | Bengaluru Python / cohort mentor |
| qa-parent@robotronix.local | Parent | Delhi family with multiple children |
| qa-parent-us@robotronix.local | Parent | New York family with multiple children |
| qa-student@robotronix.local | Student | Baseline login-enabled learner |
| qa-student-us@robotronix.local | Student | New York login-enabled learner |

**Student login is optional.** The dataset also contains three child profiles without personal Auth accounts, visible through the appropriate parent's linked family account. No emails or phone numbers correspond to actual customers; test-domain addresses may not accept delivered mail. For real invitation/email delivery QA, use test inboxes you own and review privacy/security requirements separately.

## Core scenarios

| Persona | Student | Case |
| --- | --- | --- |
| Delhi baseline | QA Student | Active 1:1, previous attended lesson, upcoming class |
| US family | Mia Patel (QA USA) | Active Python, New York timezone, late attendance, trainer feedback, submitted project, upcoming class, USD fee package |
| Delhi family | Aarav Sharma (QA India) | Enrollment paused for exams, no session consumption, cancelled class |
| US family | Noah Patel (QA USA) | Cohort learner, attended session, finished project, no student Auth login |
| Delhi family | Anaya Sharma (QA Cohort) | Same cohort, absent session, no false learning signal |
| Onboarding | Ishaan | New submission pending Admin review |
| Onboarding | Sophia | Setup pending with assigned course/trainer but not activated |
| Onboarding | Mia | Activated record linked to student and enrollment |
| Trainer operations | Meera / QA Trainer | Different availability slots, assigned students, upcoming and previous sessions |
| Finance | Mia | USD fee package, no real invoice/payment attempt |
| Zoom | All | Scheduled JIT setup is tested in application; no fictitious Zoom credentials or meetings |

All synthetic fixed IDs are in the `*0000000-0000-4000-8000-0000000000*` QA namespace and do not touch other clients.

## Safe, repeatable usage
- **Each SQL script is independently transactional where it writes data.** The extended persona seed uses `BEGIN/COMMIT`, upserts existing fixed fixtures, and validates all eight Auth accounts before writes. If a mandatory user is missing, the transaction fails.
- Existing standard QA seed may restore its baseline learner records and training outcomes upon rerun.
- Never run scripts in Production or a DEV project that holds real customer records; these are intentionally fake scenarios.
- The extended seed creates representative state, **not every real system workflow**. You must still test genuine class completion, Parent/Trainer/Student row permissions, Zoom JIT integrations, invoicing with *test* provider credentials, cross-midnight/DST cases, demo flows and notifications.
- Some app workflows derive aggregates from attendance: **never manually overwrite hours, progress or trainer earnings** to make the screen appear populated.
- No external AI service or fake recording is invoked.
- To inspect failures, run the separate verification file; the SQL Editor can display only the result of the final statement.

## Using it in local VS Code
1. `git switch fix/qa-onboarding-save-feedback-20261025`
2. `git pull --ff-only origin fix/qa-onboarding-save-feedback-20261025`
3. Configure `.env.local` with **all** Supabase credentials from the DEV project (including server-only `SUPABASE_SERVICE_ROLE_KEY`).
4. `npm ci`
5. `npm run dev`
6. Sign in with the eight DEV QA accounts to inspect role-specific pages.

## Troubleshooting
- **Missing Auth user:** Create the eight users manually in DEV Authentication before running either QA seed.
- **Role mismatch:** The SQL upserts `public.profiles` to match the corresponding `auth.users.id`; each matching identity needs an Auth record.
- **Already contains business data:** Stop; do not run the seed.
- **Timezone display confusion:** Store New York sessions under `America/New_York`; verify both pre/post DST dates in the actual calendar.
- **A verification row reads FAIL:** Do not assume the seed succeeded. Capture the failed check and the first SQL error.
