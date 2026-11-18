# Phase 7B — Automated invitation delivery

## Implemented
DEV migrations 83–84 add a service-role-only delivery ledger and verified, replay-aware webhook updates. The email provider adapter uses Resend's POST /emails with an idempotency key; a responsive branded HTML email and a plain-text counterpart are generated. An authorized Admin creates or rotates invitations through the existing Phase 7A RPC. If configured, delivery is attempted and the provider response is recorded. Provider acceptance is **not** inbox delivery.

The Super Admin New customer UI now defaults to automatic invitation delivery, exposes email delivery status and places manual secure URL sharing under Advanced recovery. The existing Owner acceptance flow remains unchanged.

## Required environment
- `RESEND_API_KEY`: server-only API key
- `INVITATION_FROM_EMAIL`: verified sender, e.g. notifications@robotronixstemlab.com
- `INVITATION_REPLY_TO`: optional reply-to
- `INVITATION_APP_URL`: exact HTTPS publicly reachable SaaS origin; use http://localhost:3000 only in local DEV
- `RESEND_WEBHOOK_SECRET`: server-only Resend webhook signing secret

Resend domain verification (SPF/DKIM, DMARC review), provider webhook registration for `email.delivered`, `email.bounced`, `email.complained`, and actual inbox tests are **not complete** without provider credentials and public URL. Set `INVITATION_APP_URL` before testing.

### Limitations
The current send is a synchronous dispatch, **not a durable background queue worker**. A network failure records failure if a provider response is received; interrupted requests may leave a sending record requiring operator intervention. Resend idempotency keys reduce duplicate sends. There is a maximum of three attempts in the ledger but no scheduled retry worker yet. Sending a fresh invitation rotates the token, invalidating the old link; failure requires a new resend or manual recovery.

Manual fallback remains available only to verified Super Admins; if provider credentials are absent, the API marks delivery as `not_configured` and returns the one-time link to the authorized Super Admin, never marking it sent.

## Release
DEV-only work; no PROD schema, Netlify deployment or main merge. Do not commercialize email onboarding until public HTTPS hosting, verified sender/domain, webhook config and actual delivery testing are complete.

## Follow-up engineering verification (18 November 2026)
- Super Admin invitation management is displayed in a structured table, with explicit invitation state, email-delivery state, expiry and resend/revoke actions.
- Manual-recovery clipboard operations now report success and failure.
- An interrupted recipient lookup is recorded as a failed dispatch instead of leaving its ledger row as `sending`.
- A fully automatic durable retry worker is **not implemented**. The one-time raw invitation token is deliberately not persisted, only its hash; a background worker cannot reconstruct the URL to resend it. Retrying without rotating requires a carefully designed encrypted, expiring secret escrow and worker authorization, or a different token issuance architecture. Do not weaken one-time invitation security by writing raw tokens into plaintext database columns.
- Domain verification, environment credentials, Resend webhook setup, real mailbox deliverability and end-to-end activation remain external certification prerequisites. The latest CI result alone does not prove these.
