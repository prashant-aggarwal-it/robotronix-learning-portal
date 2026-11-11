# Robotronix Connect Phase 3A — Multi-Channel Lead Capture

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Scope: **Development Supabase only.** No changes to Production, main branch or live deployments.

## Status

**Ingestion backend, webhook routes, institute channel configuration UI and database tests implemented.**
**External provider connectivity, end-to-end signed delivery, Next.js build and browser QA NOT YET VERIFIED.**
The application is **not ready for external public use** until the release gates below pass.

## Architectural choices

- Use existing canonical `connect.people`, `contact_methods`, `inquiries`, `opportunities`, `conversations`, `messages`, `webhook_receipts` and `channel_accounts` rather than duplicating lead tables.
- All institute data stays inside private `connect` schema on existing Development Supabase.
- A new website-form-key table `connect.form_keys` stores only SHA-256 hashes of revocable keys.
- Each external event is ingested **transactionally** by `connect.ingest_event`; a unique `(tenant_id,channel_account_id,external_event_id)` prevents delivery retries from creating new enquiries.
- Provider account identifiers are globally unique across institutes to prevent an account being silently claimed by multiple tenants.
- An inbound email or WhatsApp message uses existing contact email/phone identifiers where possible. Different people sharing a household phone number require careful operator review; no automatic people merges.
- When a contact already has an active/open admissions opportunity in the default institute pipeline, new messages reuse it; fresh messages still become distinct enquiries and inbound conversations.
- If the institute has not configured a pipeline, capture works and produces an enquiry without an admission opportunity. Staff can qualify it later.
- Webhook receipts retain only minimal metadata, not provider's raw full payload or unneeded PII.
- Frontend never receives the Supabase service-role key or Meta/Resend/Turnstile secret.

## Provider adapters

### WhatsApp Cloud API

Callback: `GET/POST /api/connect/webhooks/meta`
- GET challenge validates `hub.verify_token`.
- POST validates `X-Hub-Signature-256` HMAC using `CONNECT_META_APP_SECRET` on the **raw request bytes**.
- Incoming WhatsApp text, button and interactive selections become enquires plus inbound conversation messages.
- Status receipts and unrecognized/non-text payloads are ignored; outbound messaging is NOT part of this phase.
- Register `provider=whatsapp`, `externalId=<Meta phone_number_id>` and activate the channel after provider setup.

### Meta Lead Ads

Same signed Meta callback: `POST /api/connect/webhooks/meta`
- Recognizes `leadgen` events, uses `leadgen_id` and `page_id`.
- Retrieves lead `field_data` through Meta Graph API using server-side `CONNECT_META_GRAPH_ACCESS_TOKEN`.
- Maps name, email, phone and safe question summary to a Connect enquiry; retries failed retrieval.
- Register `provider=meta_leads`, `externalId=<Facebook Page ID>`.
- This first adapter uses a **single server-side Graph access token**. For multi-institute commercial SaaS, implement per-institute/page OAuth credentials and token rotation before onboarding unrelated customers. The current implementation does **not** provide independent per-tenant Meta OAuth.

### Inbound email (Resend)

Callback: `POST /api/connect/webhooks/email`
- Supports `email.received` and `inbox.email.received`.
- Verifies raw event with the `svix-id`, `svix-timestamp`, `svix-signature` standard webhook signature and a 5-minute timestamp tolerance.
- Routes by registered recipient email address to one institute; saves sender and email subject as an enquiry and inbound message.
- **Resend webhook metadata does not include the full email body.** Full email/attachments fetching and storage are not implemented yet.
- Register `provider=email`, `externalId=<exact inbound recipient email>`.
- If existing organization email is already on Hostinger/Google/Microsoft mail, use a **dedicated receiving subdomain** or other provider-specific supported route; do not replace the root domain MX records or break current mail delivery.

### Website forms

Receiver: `POST /api/connect/public/forms/<revocable-form-key>`
- Requires `CONNECT_PUBLIC_FORMS_ENABLED=true` and `CONNECT_TURNSTILE_SECRET`; otherwise responds 503.
- Requires a successful Cloudflare Turnstile verification, explicit enquiry consent, name, at least one contact method and a stable request event UUID.
- Supports approved cross-origin school websites through `CONNECT_FORM_ALLOWED_ORIGINS` (comma-separated HTTPS origins). Unapproved browser origins are rejected.
- A bot honeypot rejects persistence; body payload limited; GET submission not supported.
- Register a `website` channel in Institute Settings, activate it, generate a form identifier, then embed a form following `docs/connect/examples/website-lead-form.html`.
- Revocation is available in the channel management UI; the form identifier cannot be redisplayed after initial generation.
- Public form identifiers are **not private API secrets**; Turnstile and other anti-abuse controls remain mandatory.

## Configuration reference (server-side environment variables)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Existing Development Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server-side service credential; NEVER expose to browser |
| `CONNECT_META_VERIFY_TOKEN` | Random token for Meta webhook GET verification |
| `CONNECT_META_APP_SECRET` | Meta app secret used to verify POST signature |
| `CONNECT_META_GRAPH_ACCESS_TOKEN` | Access token authorized to retrieve Lead Ads field data |
| `CONNECT_META_GRAPH_VERSION` | e.g. a currently supported `vXX.X` pinned version; update as Meta releases versions |
| `CONNECT_RESEND_WEBHOOK_SECRET` | Resend signed incoming email event secret, `whsec_...` |
| `CONNECT_PUBLIC_FORMS_ENABLED` | `true` after verification and release QA; default disabled |
| `CONNECT_TURNSTILE_SECRET` | Cloudflare Turnstile server verification secret |
| `CONNECT_FORM_ALLOWED_ORIGINS` | Exact school HTTPS origins, comma-separated; never `*` |

Never commit credentials to GitHub or put them in `NEXT_PUBLIC_...` variables.

## Client-side configuration

In Connect > Institute settings > Lead capture channels:

1. Register the provider and exact external account identifier.
2. Complete provider-side setup: app verification, phone/page subscription, receiving domain, callback registration as required.
3. Activate the Connect channel once credentials and events have been checked.
4. For website forms, generate and securely store the form identifier. Configure the Turnstile **public site key** in the sample frontend and the secret on the server.
5. Submit one real provider test event and check Contact, Enquiries, Admissions Pipeline, and audit logs.

## Files

- `database/connect/saas/12_multichannel_ingestion.sql`: first-install database schema, restricted channel and event RPCs
- `database/connect/tests/verify_multichannel_dev.sql`: transactional four-channel QA test
- `lib/server/connect-ingestion.ts`: raw signatures, bounded input, service-only ingestion client
- `app/api/connect/webhooks/meta/route.ts`: WhatsApp + Meta Lead Ads adapter
- `app/api/connect/webhooks/email/route.ts`: signed inbound email adapter
- `app/api/connect/public/forms/[formKey]/route.ts`: public website receiver, captcha, CORS and consent
- `app/api/connect/workspaces/[tenantId]/channels/route.ts`: authenticated channel management
- `app/api/connect/workspaces/[tenantId]/forms/route.ts`: form key create/list/revoke
- `features/connect/components/ChannelSettings.tsx`: institute management UI
- `docs/connect/examples/website-lead-form.html`: example website form with placeholder keys

## Development verification actually executed

Executed `database/connect/tests/verify_multichannel_dev.sql` successfully under the PostgreSQL `service_role`:
- Created all four provider registrations in a temporary institute.
- Ingested events and verified five enquiries, three people, three opportunities, three inbound messages and five processed receipts.
- Verified a repeated WhatsApp delivery was idempotent.
- Verified the same WhatsApp contact had a **single** open admissions opportunity across multiple messages.
- Verified matching the contact across email and WhatsApp where the contact method is known.
- Verified two-institute account identifier collision rejected and other-tenant user forbidden from changing channel status.
- Verified disabled website key refused further ingestion.
- All verification rows rolled back after execution.

## Remaining release gates / known limitations

- [ ] Run `npm ci`, `npm run typecheck`, Next.js production build and Portal regression on dedicated branch.
- [ ] Run **real HTTP tests** of valid/invalid Meta and Resend signatures, Meta verification GET, Graph Lead Ads retrieval and partial-failure retry.
- [ ] Test Cloudflare Turnstile verification and CORS on a hosted Development website. Confirm form honeypot, contact matching and consent behavior.
- [ ] Test on actual Meta phone ID/Page ID, authorized scopes/app review and Resend receiving domain. No external provider credentials were installed in this phase.
- [ ] Review 360° contact UI and conversation timeline presentation; current event storage is available but full conversation/inbox UI is a later phase.
- [ ] Provider rate limits/retry worker/monitoring, bounce handling, PII retention rules, consent history and OAuth per-institute before production SaaS launch.
- [ ] Consider canonical E.164 normalization and duplicate-candidate review across country/format variations.
- [ ] Improve resilience to webhook batches under serverless execution time limits; use durable queue/background workers for production workloads.
- [ ] **Do not merge to main or deploy to Production until these gates pass.**

## Official references

- Meta WhatsApp Cloud webhook verification: https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/
- Resend receiving email (metadata only): https://github.com/resend/resend-skills/blob/main/skills/resend/references/receiving.md
- Resend signed webhooks: https://github.com/resend/resend-skills/blob/main/skills/resend/references/webhook-setup.md
