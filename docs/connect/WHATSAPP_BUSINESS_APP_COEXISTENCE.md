# WhatsApp Business App coexistence — Phase 3 release gate

**Priority:** Robotronix WhatsApp Business mobile-app number **+91 85957 72008**. The separate Cloud API/WA Simple number **+91 92179 06540** is out of scope and must not be changed.

**State:** Stage A code built and DEV migrations `connect_whatsapp_coexistence_sync_stage_a` and `connect_whatsapp_history_queue_stage_a` applied (2026-11-06/07). No real Meta credentials, webhook subscriptions or live phone connections. Do not activate a real channel, expose a production send button, launch embedded signup, scan a QR code, transfer/deregister a number, or claim live synchronization yet.

## Already implemented

- Signed Meta webhook verification, inbound messages and outbound `smb_message_echoes` routing, mapped by Meta phone number ID to a tenant's registered channel.
- CRM inbox with contact linking, unread state, assignments, draft replies and historical messages that have actually been ingested.
- An isolated, allowlisted **Meta test-number** send path. It is **not** authorization to send using +91 85957 72008.
- Inbox readiness notice that distinguishes coexistence preparation from test sending.
- `history` webhook parser and 200-message idempotent import batches, with original timestamps/direction, historical-message marking and no retroactive lead creation.
- `smb_app_state_sync` add/remove processing into a private contact mirror plus new CRM contacts (without overwriting existing CRM identities); stale events are discarded and removing a mobile contact does not delete CRM records.
- `edit` and `revoke` handling for incoming messages and app echoes, preserving original message body for audit.
- Authorized `/api/connect/workspaces/{tenantId}/whatsapp/health` readout of registered channels, synchronized contacts, imported historical messages and latest message activity. This does **not** establish live Meta connection health.
- Rollback-only DEV SQL acceptance tests passed after installation; RPCs are service-role-only and `SECURITY INVOKER`.
- Durable history queue: signed history events are stored in a private RLS-protected table with fingerprint deduplication; a bounded worker imports 200 messages at a time, persists cursor progress, uses leases, retries transient errors and exposes failed-job counts. Completed queue payloads are removed immediately; old completed/failed job records expire after 7/30 days. Worker is disabled by default and must be explicitly configured in an approved DEV deployment.

## Must complete before connecting the Business App

1. Recover Meta Developer sign-in (the user currently cannot receive SMS login codes). Check the existing app and business ownership, eligibility, Tech Provider/Solution Partner requirements and available Embedded Signup flow. Do not ask for OTPs, app secrets, access tokens or passwords in chat.
2. Build and verify the official Coexistence Embedded Signup callback, state/nonce checks and account binding. Use only the intended Robotronix Business Portfolio; never reuse the WA Simple number's connection as the Business App sender.
3. Verify the history/contact importers against actual signed Meta payloads, including large history chunks, media placeholders, history-sharing decline, missing/late edit targets and sync order. The webhook now queues history payloads (up to 8 MB per signed request, bounded by deployment provider request limits); the scheduled worker processes them asynchronously. Larger-than-limit webhook requests and very large single history chunks still need a live Meta acceptance check.
4. Confirm `messages`, `smb_message_echoes`, `history` and `smb_app_state_sync` subscriptions and any account-disconnection events required by the approved Meta onboarding model.
5. Build a production-number send path with permission checks, permitted reply/template rules, opt-in protections, idempotency, provider reconciliation and strict per-channel credential separation. Do not reuse the test-only token allowlist for live sends.
6. Test on a DEV HTTPS endpoint with an explicitly approved account: inbound text, app-originated reply echo, Connect-originated reply, delivery/read callbacks, duplicates, unsupported media, historical/contact sync, disconnected account and cross-tenant isolation.
7. Only after acceptance, separately approve production deployment and actual business-number onboarding. Preserve the WhatsApp Business mobile app and keep WA Simple unchanged throughout.

## User handoff

The user has confirmed WhatsApp Business app → Account → Business Platform displays **Connect to the Business Platform**, with the option to continue using the mobile app and share up to six months of individual chat history. This shows a connection entry point, **not** approval for this custom CRM or a completed connection.

Current blocker: Meta Developer login SMS is not arriving. Continue code and DEV-safe verification without account changes. Once login works, inspect **My Apps** before choosing the onboarding flow.

## Background worker DEV configuration

- `CONNECT_HISTORY_DRAIN_ENABLED=true` — only after a DEV deployment has the migration and a protected scheduler endpoint.
- `CONNECT_HISTORY_JOB_SECRET` — independent random server-only secret (at least 24 characters), never shared in chat.
- Existing DEV `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must point only to the DEV project.
- `netlify/functions/connect-history-drain.mts` runs every minute and calls the authenticated `/api/connect/jobs/whatsapp-history` endpoint. Without the enable flag, it exits without processing.
- The inbox Connection readiness panel shows pending, processing, completed and failed history jobs. A failed job is retained for review; never expose raw queued message payloads to the browser.
