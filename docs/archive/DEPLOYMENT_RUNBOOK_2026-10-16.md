# Robotronix™ Learning Portal — Deployment Runbook

Release intent: fresh DEV/Production database, consolidated schema only, no hotfix replay.

## A. Fresh DEV setup and full QA cycle

1. Create/use the DEV Supabase project. Never point DEV `.env.local` to production.
2. In Supabase SQL Editor run, in this order:
   - `database/99_dev_tools/00_DEV_ONLY_RESET_PUBLIC_SCHEMA.sql` — DEV only.
   - `database/01_install/01_CREATE_SCHEMA.sql`
   - `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. Create/verify the four QA Auth users. Preferred command:
   - `npm run qa:create-users`
4. Run:
   - `database/02_qa/01_QA_SEED.sql`
5. Run:
   - `database/03_verify/01_VERIFY_RELEASE.sql`
6. Install dependencies:
   - `npm ci` (preferred when `package-lock.json` is present)
7. Static/build verification:
   - `npm run check:release`
   - `npm run build`
8. Full DEV QA cycle:
   - `npm run qa:dev-cycle`
   This includes auth, roles/permissions, workflow, scheduling, attendance exceptions, finance, communications, active-student migration, pre-go-live features, payroll, readiness, Razorpay QA and mobile/responsive tests.
9. If one suite fails, fix/rerun that suite first; then rerun `npm run qa:dev-cycle` once the change is complete.

### DEV cleanup
Use `database/02_qa/02_QA_CLEANUP.sql` only when you intentionally want to remove deterministic QA business fixtures. Use `npm run qa:delete-users` only when you also want to remove the QA Auth accounts.

## B. Fresh Production database setup

Production is a clean database. Do NOT run DEV reset, QA seed, QA repair scripts, historical hotfixes or patch SQL.

Run only:
1. `database/01_install/01_CREATE_SCHEMA.sql`
2. `database/01_install/02_INSERT_MASTER_REFERENCE_DATA.sql`
3. `database/03_verify/01_VERIFY_RELEASE.sql`
4. Bootstrap the real first Admin using the documented production bootstrap process. `03_BOOTSTRAP_FIRST_ADMIN_EXAMPLE.sql` is an example and must not be run with its placeholder unchanged.

## C. Production environment and Netlify

Configure production-only environment variables in Netlify. Keep secrets server-side; never prefix secrets with `NEXT_PUBLIC_`.

Core groups to verify:
- Supabase public URL/anon key and server service-role key.
- Google OAuth values used by the portal.
- Razorpay values required by the configured invoice/payment flow.
- Zoom POC: `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_REDIRECT_URI=https://portal.robotronixstemlab.com/api/zoom/oauth/callback`, and `ZOOM_TOKEN_ENCRYPTION_KEY`.
- `NEXT_PUBLIC_APP_ENV=production`.

Before deploy from the exact release folder:
- `npm ci`
- `npm run check:deployment`

Push this exact tested code to GitHub and deploy that commit on Netlify.

## D. Temporary Production sanity cycle

Do this before entering any real learner data.

1. Copy `.env.sanity.example` to `.env.sanity.local` locally and fill only production-sanity credentials and production project values. Keep it uncommitted.
2. Set `QA_TARGET=production` and `QA_BASE_URL=https://portal.robotronixstemlab.com`.
3. Create temporary Auth users:
   - `npm run sanity:create-users`
4. In Production Supabase SQL Editor run:
   - `database/02_sanity/01_PROD_SANITY_SEED.sql`
5. Run:
   - `npm run qa:prod-sanity`
6. Manually smoke-check login, role routing, one class workflow, one finance view, communications, and the Zoom POC admin page.
7. Clean synthetic business data:
   - `database/02_sanity/02_PROD_SANITY_CLEANUP.sql`
8. Delete temporary Auth users:
   - `npm run sanity:delete-users`

Do not enter real customer data until production sanity is green and the Zoom POC is accepted for the next integration phase.

## E. Zoom POC sequence after Netlify deploy

The POC is intentionally isolated from real scheduling.

1. Confirm Zoom Marketplace redirect URI is exactly `https://portal.robotronixstemlab.com/api/zoom/oauth/callback`.
2. Confirm required Zoom scopes used by the POC are granted, including meeting read/write/delete/update and user/ZAK access.
3. Open `/admin/zoom-test` as Admin.
4. Connect/reconnect Zoom Host 1 and authorize it. The callback should now return to the portal instead of a 404.
5. Create one 30-minute test meeting.
6. Start as Trainer in one signed-in browser profile.
7. Join as Participant in another signed-in browser profile.
8. Verify camera, microphone, audio and leave flow inside the browser portal.
9. Only after Host 1 is proven, connect Host 2 and repeat.

Automatic host allocation, schedule-driven meeting creation, collision blocking, webhooks/presence and live operational alerts are the next phase; they are not claimed as complete in this release.

## F. Release rule

Treat this ZIP/commit as one immutable baseline. Do not overlay any older Robotronix patch ZIP or hotfix SQL on top of it.
