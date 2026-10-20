# QA and production release acceptance

## Test environments

**Full automated workflows run against DEV** with dedicated QA identities and seeded synthetic data. A successful local test does not prove Production OAuth, webhook, payment, DNS or permissions are deployed correctly.

## Basic release gate

```powershell
npm ci
npm run check:release
npm run build
npm run qa:auth-check
npm run qa:roles
npm run qa:workflow
```

Additional suites for deeper changes:

```powershell
npm run qa:prod-gate
```

Note: `qa:prod-gate` is a **DEV acceptance suite despite its name**; it can run many lifecycle/mobile/provider tests and requires suitable local QA configuration. Review its component scripts in `package.json` before running. `qa:razorpay` write tests require Test Mode only.

## DEV prerequisites

1. DEV Supabase with current installed schema and reference data.
2. Four dedicated DEV QA Auth users and profiles with expected Admin, Trainer, Parent and Student roles.
3. Run `database/02_qa/01_QA_SEED.sql` in DEV only when fixture data is needed.
4. `.env.local` contains only DEV Supabase keys and QA credentials; never Production service-role keys.
5. `QA_BASE_URL` points at the local server, or explicitly approved preview Dev environment.

## Manual release acceptance checklist

- [ ] Login/logout, correct role navigation, cross-role access denied
- [ ] New family intake, sibling linking, Admin activation
- [ ] Trainer, student, course, one-to-one and cohort enrollment creation
- [ ] Time zones and scheduling conflicts, hold/resume, cancellations/makeups
- [ ] Class delivery/attendance/progress, Parent visibility, internal notes protected
- [ ] Opening migration balances and retained historical finance values
- [ ] Invoices/receipts/Trainer payroll, duplicates and webhook retry guards
- [ ] Demo guest token, requests, rescheduling and privacy
- [ ] Zoom host OAuth, classroom, presence and protected recordings (controlled provider test)
- [ ] Alerts, messages, live-refresh recovery and mobile layouts
- [ ] Dev SQL verify and security/RLS checks, no real data in QA
- [ ] Netlify deployment commit, production env and Supabase project correctness
- [ ] Production real Admin **read-only** smoke test

## Current candidate evidence

Repository owner reported `check:release`, `build`, `qa:auth-check`, `qa:roles` and `qa:workflow` all passing locally on 2026-10-19. GitHub Actions and Netlify PR preview also passed on the current candidate. This evidence does **not** replace Production smoke/integration acceptance.

## Release safety

- Check `git status --short` and `git rev-parse HEAD` to tie tests to an exact commit.
- `next-env.d.ts` can become locally modified after a Next.js build; review it rather than blindly committing generated changes.
- Only document a suite as passed after an actual test execution; treat skipped provider tests separately.
- Do not run `database/02_qa/01_QA_SEED.sql` in Production.
- Production QA users are optional and should not be provisioned solely to make local tests pass.

## P1 action-notification DEV acceptance (unmerged)

Follow the [Priority 1 event matrix and two-browser manual QA](PRIORITY1_ACTION_NOTIFICATIONS.md), covering trainer finance requests/decisions, messaging, progress alerts, scheduling, onboarding regression, offline recovery, RLS and idempotency. This set is **not yet test-executed** and must not be marked passed based only on source inspection.
