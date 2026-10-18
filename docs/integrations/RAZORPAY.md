# Razorpay — invoice and payment operations

## What it does

The portal links enrollments/fee packages with invoice management and Razorpay provider synchronization. Admin can view and manage invoices via `/admin/invoices`; underlying APIs: `app/api/admin/invoices/route.ts` and `app/api/razorpay/webhook/route.ts`.

**Mode matters:** the invoice page explicitly shows **TEST**, **LIVE**, or **not configured**. Live write operations can affect real customers.

## Setup

1. In Razorpay use **Test Mode** for DEV and Live Mode only for approved Production billing.
2. Configure the matching server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in local Dev or Netlify Production environment. Never expose private keys via `NEXT_PUBLIC_` or commit them.
3. Create the appropriate Razorpay webhook endpoint in provider dashboard; production path is `https://portal.robotronixstemlab.com/api/razorpay/webhook`. Select event subscriptions matching the actual webhook handler and use the identical webhook signing secret.
4. Confirm the learner's identity, billing contact, currency, fees, due date and package terms. Verify required business tax/export configuration outside the portal with your accounting advisor.
5. Deploy and first run **read-only** provider/portal checks. Perform all invoice issue/payment/webhook testing using Test Mode and synthetic families.

## Operational workflow

1. Admin reviews enrolled student's fee package and launches invoice creation from the enrollment billing panel.
2. Review invoice draft/reference, customer, currency, amount, due date and linked fee package.
3. In `/admin/invoices`, issue/send as permitted, copy payment link, sync provider state and investigate exceptions.
4. Webhook handler receives signed events; event records support retries/diagnostics.
5. Reconcile `issued`, `partially_paid`, `paid` and overdue status. Verify payment IDs, invoice IDs and received amounts.
6. Export invoice data as needed; keep Trainer earnings/payroll in separate records from student receipts.
7. For duplicates or discrepancies, investigate original provider ID and webhook processing error before editing any business data. Never manually mark an unpaid real transaction paid.

## Security and acceptance

- `npm run check:finance`, `npm run check:razorpay-ops` are static/domain checks, not proof of live provider connectivity.
- `npm run qa:razorpay` is a Playwright suite; **never** activate test-mode writes while pointing to live keys.
- `QA_RAZORPAY_WRITE=0` by default; only enable in isolated Test Mode with documented fixtures.
- Verify invalid webhook signatures are rejected, retries don't double-post a receipt, partial payments are reflected correctly and provider failures are surfaced.
- Do not make live payment tests against a real family merely to validate the integration.

**Source code:** `lib/server/razorpay.ts`, `lib/server/razorpay-invoices.ts`, `app/admin/invoices/page.tsx`, `app/api/razorpay/`, consolidated DB schema.
