# Robotronix Learning Portal V1.0.0 — First-Time Setup

This package is the release-ready source of truth.

## Important

For a brand-new Supabase project there are **no historical database patches to run**.

All production database fixes are consolidated into:

`supabase/production-v1-baseline.sql`

The QA seed is separate and optional.

---

## 1. Install and verify the code

```bash
npm ci
npm run typecheck
npm run build
```

---

## 2. Create the fresh Supabase project

Recommended project name:

`Robotronix Learning Portal - Production`

In **Supabase → SQL Editor**, run:

`supabase/production-v1-baseline.sql`

This is the **only production schema SQL** required for a fresh database.

Do not run old migrations or previous hotfix files afterward.

---

## 3. Configure `.env.local`

Copy `.env.example` to `.env.local` and fill the new Supabase project values.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_ENV=local

SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

QA_ADMIN_EMAIL=qa-admin@robotronix.local
QA_ADMIN_PASSWORD=YOUR_PRIVATE_QA_PASSWORD
QA_TRAINER_EMAIL=qa-trainer@robotronix.local
QA_TRAINER_PASSWORD=YOUR_PRIVATE_QA_PASSWORD
QA_PARENT_EMAIL=qa-parent@robotronix.local
QA_PARENT_PASSWORD=YOUR_PRIVATE_QA_PASSWORD
QA_STUDENT_EMAIL=qa-student@robotronix.local
QA_STUDENT_PASSWORD=YOUR_PRIVATE_QA_PASSWORD
QA_BASE_URL=http://localhost:3000
```

Never commit `.env.local`.

---

## 4. Create the four QA Auth users

Run:

```bash
npm run qa:create-users
```

This uses the Supabase Auth Admin API.

Do **not** insert users directly into `auth.users` using SQL.

It creates/verifies:

- qa-admin@robotronix.local
- qa-trainer@robotronix.local
- qa-parent@robotronix.local
- qa-student@robotronix.local

---

## 5. Seed the QA records

In Supabase SQL Editor, run:

`supabase/qa-seed.sql`

The seed resolves all four Auth UUIDs by email, so it works on a completely new
Supabase project.

Expected verification:

- profiles = 4
- trainer = 1
- parent = 1
- student = 1
- course = 1
- enrollment = 1
- classes = 2

---

## 6. Run the final release rehearsal

Use the production build for the final QA gate.

```bash
npm run typecheck
npm run build
npm start
```

Leave `npm start` running.

Open a second terminal:

```bash
npm run qa:release
```

Expected result:

`59 passed`

Do not use `npm run dev` for the final release gate; Next.js dev mode can produce
cold-compilation timing failures that do not occur in the production build.

---

## 7. After 59/59 passes

### Safest production approach

Use the rehearsal Supabase project only to prove the baseline.

Then create the actual final production Supabase project and run only:

1. `supabase/production-v1-baseline.sql`
2. Create your real Admin account in Supabase Auth
3. Run `supabase/bootstrap-first-admin.example.sql` after replacing its placeholders

Do not run QA seed/users in that final project.

### If this same tested Supabase project will become production

Run:

`supabase/qa-cleanup.sql`

The cleanup is ordered deliberately: attendance is removed before payroll earnings because the attendance trigger can recalculate an earning for a conducted class.

Then:

```bash
npm run qa:delete-users
```

Now create your real Admin Auth user and use:

`supabase/bootstrap-first-admin.example.sql`

---

## 8. Google OAuth

Configure Google in Supabase Authentication and Google Cloud.

Local origin:

`http://localhost:3000`

Supabase callback URI:

`https://YOUR-PROJECT.supabase.co/auth/v1/callback`

Later add the final Netlify/custom-domain origin as well.

---

## Exact order summary

### Fresh rehearsal

1. `npm ci`
2. `production-v1-baseline.sql`
3. create `.env.local`
4. `npm run qa:create-users`
5. `qa-seed.sql`
6. `npm run typecheck`
7. `npm run build`
8. `npm start`
9. `npm run qa:release`
10. Expect `59 passed`

### Clean real production database

1. `production-v1-baseline.sql`
2. Create real Admin in Supabase Auth
3. `bootstrap-first-admin.example.sql`

No historical SQL patches are required.
