# Robotronix™ International Invoice Module — Go-live checklist

## What this release changes

- Adds **Admin → International Invoices**.
- Razorpay is restricted to **international parent invoices**; INR/Indian collections stay outside this workflow.
- Collects full family address for every onboarding: Address Line 1/2, Country, State/Province, City and Postal/ZIP.
- Keeps the final Country → State → City → automatic timezone behavior.
- Adds parent billing profiles and immutable invoice billing/GST snapshots.
- Uses financial-year invoice numbering such as `RTX/26-27/0001`; student/course identification is stored separately as an internal reference.
- Creates the Razorpay invoice as a **draft** with email/SMS disabled.
- Admin reviews export/LUT treatment before draft creation, then separately **Issues** and **Sends email**.
- Due date is issue date + 2 days.
- Fetches FX automatically server-side; freezes rate/source/time on the invoice.
- Stores GST/export fields: GSTIN 07AEIPA4473M1ZB, SAC 999293, IGST 0%, CGST/SGST N/A, reverse charge No, place of supply, LUT declaration and Purpose Code P1107.
- Webhook syncs invoice payment status and creates the matching fee-payment record when fully paid.

## Development database

Run your existing master pack first (01–08 as already validated), then:

1. `database/01_install/01_CREATE_SCHEMA.sql` (Razorpay tables/functions are already included in the consolidated V1 schema)
2. `database/03_verify/01_VERIFY_RELEASE.sql`
3. Existing `07_final_verification.sql`

Do not run QA/pre-production cleanup files simply as part of setup.

## Local secrets

Copy `.env.example` to `.env.local` and add your **Razorpay TEST** credentials yourself:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Also keep the existing server-side Supabase values:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Never commit `.env.local`. Never use `NEXT_PUBLIC_` for the Razorpay secret or Supabase service-role key.

## Local sanity test

Use `SANITY-` names. Recommended minimum:

1. Onboard `SANITY-Parent` / `SANITY-Student` with a complete overseas address.
2. Activate the learner and create an international fee package in USD or AED.
3. Open **Admin → International Invoices**.
4. Check customer address, course, amount, FX rate, INR equivalent and export/GST preview.
5. Confirm export/LUT eligibility.
6. Click **Create Razorpay draft**.
7. Inspect the draft in Razorpay/test link before issuing.
8. Click **Issue**.
9. Click **Send email** only after review.
10. Make a Razorpay TEST payment and verify the invoice becomes Paid and a fee payment is recorded.

## Webhook

Production webhook URL:

`https://portal.robotronixstemlab.com/api/razorpay/webhook`

Enable the invoice events needed for payment-state sync, including paid, partially paid and expired. Configure the same strong webhook secret in Razorpay and Netlify.

## Production

Only after local/Development testing passes:

1. Back up Production DB.
2. Run current master/config SQL as planned.
3. Run migration 12 and verification 13.
4. Add LIVE Razorpay credentials to Netlify environment variables.
5. Redeploy.
6. Create a `SANITY-` international production test family/package.
7. Create, review, issue and pay one small TEST/controlled invoice workflow as appropriate for your Razorpay mode.
8. Confirm webhook/payment reconciliation.
9. Remove only SANITY data with your dedicated cleanup workflow.
10. Re-run database verification and begin real billing.

## FX compliance checkpoint

The included FX route currently uses an automatic external reference-rate endpoint and stores the exact rate, source and timestamp. Before using it for live GST valuation, confirm with your CA/accountant that this is the exchange-rate basis they want. If they require a different notified/reference rate, replace only the server FX provider; historical invoice snapshots remain unchanged.
