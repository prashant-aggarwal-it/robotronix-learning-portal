# Phase 7B — Hostinger SMTP invitation delivery (DEV)

## Implemented
- Existing secure invitation issuance, rotation, revoke, expiry and Super Admin UI are retained.
- Custom invitations use server-only Nodemailer over SMTP. Authentication messages remain with Supabase Auth SMTP.
- The transport reports **SMTP accepted**, not delivered to an inbox. The existing ledger's provider-accepted state is interpreted as SMTP acceptance only.
- Resend API calls and webhook endpoint are removed. Historical Resend-related DEV tables/functions are intentionally left in place to avoid destructive migrations; they are unused by the new adapter.

## Configuration (server-only)
```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=contact@robotronixstemlab.com
SMTP_PASSWORD=YOUR_HOSTINGER_MAILBOX_PASSWORD
SMTP_FROM_EMAIL=notifications@robotronixstemlab.com
SMTP_FROM_NAME=Robotronix Education Suite
SMTP_REPLY_TO=contact@robotronixstemlab.com
INVITATION_APP_URL=http://localhost:3000
```
Never commit real passwords. Hostinger must permit the mailbox to send as the notifications alias. For actual customers, INVITATION_APP_URL must be the public HTTPS origin; localhost links cannot be opened by customers.

## Not yet certified
- No actual Phase 7B SMTP email was sent in this implementation session; a successful Supabase Auth SMTP test is not proof of backend SMTP sending.
- No durable background worker or automatic retry is implemented. The one-time raw invitation token is intentionally not stored; it cannot be reconstructed for a retry. Operator-triggered resend rotates the token.
- The original ledger's optional Resend webhook schema remains for backward compatibility, but no SMTP delivery/bounce webhook is available. Do not mark SMTP acceptance as delivered.
- Tenant-configurable verified Reply-To, per-tenant queue/rate limits, academy-specific templates, and academy email settings are not yet implemented. Do not expose them as working features.
- DEV end-to-end academy activation and inbox delivery remain to be tested before production certification.

## Release constraints
DEV branch only; no production database or Netlify deployment. Configure the backend SMTP credentials in local DEV or secure deployment environment, not in Supabase Auth settings alone.
