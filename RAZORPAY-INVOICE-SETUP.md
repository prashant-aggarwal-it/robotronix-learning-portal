# Robotronix™ Razorpay International Invoices — Setup

## Scope implemented
- Razorpay invoice workflow is **international parents only**.
- Indian fee collections remain outside the Razorpay invoice workflow.
- Export invoice defaults: GSTIN `07AEIPA4473M1ZB`, SAC `999293`, IGST `0%` under LUT, Purpose Code `P1107`.
- Invoice number: `RTX/26-27/0001` style (financial-year sequential; <=16 chars).
- Separate internal reference keeps student/course recognition without overloading the statutory invoice number.
- Due date: issue date + 2 days.
- Automatic FX rate is fetched server-side and the exact rate, source and timestamp are frozen on the invoice record.
- Full address is collected for every family during onboarding.
- Admin review is mandatory before draft creation.
- Razorpay draft is created with email/SMS disabled. Admin separately clicks **Issue**, then **Send email**.
- Razorpay webhooks update paid/partially-paid/expired states and record a fee payment when fully paid.

## 1. Database
Run:

`database/01_install/01_CREATE_SCHEMA.sql` (Razorpay tables/functions are already included in the consolidated V1 schema)

Run on Development first. Then run `database/03_verify/01_VERIFY_RELEASE.sql` and the consolidated release verification before testing the invoice workflow.

## 2. Local environment
Copy `.env.example` to `.env.local` and add TEST credentials:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Never put `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` in client code, GitHub, or a `NEXT_PUBLIC_` variable.

## 3. Razorpay webhook
For deployed Production/Test site configure:

`https://portal.robotronixstemlab.com/api/razorpay/webhook`

Recommended invoice events:
- `invoice.paid`
- `invoice.partially_paid`
- `invoice.expired`

Use a strong webhook secret and put the same value in Netlify as `RAZORPAY_WEBHOOK_SECRET`.

## 4. Netlify environment
Add server-only values to the portal site environment:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- existing `SUPABASE_URL`
- existing `SUPABASE_SERVICE_ROLE_KEY`

Deploy again after changing environment variables.

## 5. Local test order
1. Run migration 12 on Development DB.
2. Start portal locally against Development Supabase.
3. Onboard a SANITY parent/student with complete billing address.
4. Activate learner and create a foreign-currency fee package (USD or AED recommended for first test).
5. Open **Admin → Finance → International Invoices**.
6. Confirm the automatic FX rate and INR equivalent.
7. Tick export/LUT eligibility review.
8. Create Razorpay draft.
9. Open/inspect draft; then click Issue.
10. Send email only when ready.
11. Pay a TEST invoice and confirm webhook changes it to Paid and creates a student fee payment.

## FX note
The module uses ExchangeRate-API's open endpoint for a daily market/reference rate and stores the rate + timestamp for audit. Before LIVE GST use, confirm with your CA that this is the exchange-rate basis they want for your export valuation. If they require another notified/reference rate, change only the server FX route; historical invoice snapshots remain unchanged.

## Compliance note
The portal calls the export treatment “export under LUT / IGST 0%”; it does not label international fees as generic “GST exempt.” The admin confirmation checkbox is intentionally retained because eligibility depends on the transaction facts.
