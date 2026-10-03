# QA

The release includes Playwright coverage for Admin, Trainer, Parent and Student roles, protected routes, and critical end-to-end workflows.

The final pre-release run completed **59/59 desktop release tests successfully** before this source was consolidated.

## Optional QA environment
Do not put QA users/data into a live customer database unless intentionally performing a controlled pre-release validation.

1. Create these four Supabase Auth email/password users:
   - `qa-admin@robotronix.local`
   - `qa-trainer@robotronix.local`
   - `qa-parent@robotronix.local`
   - `qa-student@robotronix.local`
2. Run `supabase/qa-seed.sql`.
3. Put the four QA emails/passwords in `.env.local` using the `QA_*` variables from `.env.example`.
4. Run:
   - `npm run qa:auth-check`
   - `npm run qa:roles`
   - `npm run qa:workflow`
   - `npm run qa:release`

The QA seed uses fixed domain-record IDs but resolves Auth UUIDs by email, so it is portable across Supabase projects.
