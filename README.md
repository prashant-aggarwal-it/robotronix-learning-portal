# Start Here

For a brand-new database and release setup, follow **`FIRST-TIME-SETUP.md`** in order.

# Robotronix™ Learning Portal — Production V1

Clean first production release of the Robotronix Learning Portal.

## Stack
- Next.js 16 / React 19 / TypeScript
- Supabase Auth + PostgreSQL + Row Level Security
- Netlify deployment
- Playwright release QA

## Fresh installation
1. Create a new Supabase project.
2. Open Supabase SQL Editor and run **`supabase/production-v1-baseline.sql` once**.
   This is the complete initial database schema. No historical patch SQL files are required.
3. Configure Google Auth in Supabase/Google Cloud if Google sign-in will be used.
4. Copy `.env.example` to `.env.local` for local development and fill the required values.
5. Install dependencies with `npm ci`.
6. Run `npm run typecheck` and `npm run build`.
7. Start locally with `npm run dev`.
8. Bootstrap the first admin using `supabase/bootstrap-first-admin.example.sql` after that Auth user exists.

## Production environment
Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never commit `.env.local` or the Supabase service-role key.

## Database baseline
`supabase/production-v1-baseline.sql` includes the complete schema and all release fixes, including:
- non-recursive Student/Enrollment RLS
- Parent/Student access to linked Courses and Trainers
- audit trail with composite-key-safe entity IDs
- correction requests and protected-operation guards
- actual instructional duration and trainer earning synchronization
- student finance package/payment schema
- portal access and family/guardian model

For a fresh Production V1 project, run the baseline only. Do **not** run historical upgrade/hotfix scripts.

## QA
Automated QA is retained as release protection. QA data is optional and separate from production schema.
See `QA.md`.

## Deployment
See `DEPLOYMENT.md` and `RELEASE-CHECKLIST.md`.


## Release baseline

This V1.0.0 release pins Next.js 16.3.8 and includes the consolidated production database baseline plus all production fixes validated by the final 59-test production-server QA run.
