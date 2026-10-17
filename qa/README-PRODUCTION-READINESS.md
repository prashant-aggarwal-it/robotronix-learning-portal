# Production Readiness QA

## One-time prerequisites

1. Use Development / QA Supabase only for the full automated suite.
2. Create the four QA auth users and run `database/02_qa/01_QA_SEED.sql`.
3. Run DB patches through `24_onboarding_admin_notification.sql`.
4. Put QA credentials and the Supabase service-role key in `.env.local` or `.env.qa.local`.

Required variables:

```env
QA_ADMIN_EMAIL=
QA_ADMIN_PASSWORD=
QA_TRAINER_EMAIL=
QA_TRAINER_PASSWORD=
QA_PARENT_EMAIL=
QA_PARENT_PASSWORD=
QA_STUDENT_EMAIL=
QA_STUDENT_PASSWORD=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional Razorpay Test Mode write test:

```env
QA_RAZORPAY_WRITE=1
RAZORPAY_WEBHOOK_SECRET=
QA_RAZORPAY_WEBHOOK_INVOICE_ID=
```

Never enable `QA_RAZORPAY_WRITE=1` against live Razorpay credentials.

## Commands

```bash
npm run typecheck
npm run qa:auth-check
npm run qa:roles
npm run qa:workflow
npm run qa:production-readiness
npm run qa:razorpay
npm run qa:prod-gate
npm run qa:report
```

`qa:prod-gate` is the consolidated deterministic gate. Visual/manual rows remain in `PRODUCTION_READINESS_37_POINT_MATRIX.md` and in the Excel checklist.

## Reports

Playwright stores HTML output in `playwright-report/`, and retains trace/screenshots/video on failure as configured in `playwright.config.ts`.
