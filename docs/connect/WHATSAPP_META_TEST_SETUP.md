# Robotronix Connect — Meta WhatsApp TEST integration

**Status:** Code integrated into `feature/robotronix-connect-crm`; DEV database migrations 32–34 applied. **No live Meta account, production WhatsApp number, or WA Simple integration has been changed.** Live end-to-end testing remains pending a user-owned Meta app and test credentials.

## Scope and safeguards

This stage enables **text replies to one Meta test sender**, only to explicitly allowlisted, verified test recipient numbers, when a verified inbound message has opened the customer-service window. It does **not** send marketing campaigns, templates, media, or messages to a production number. It does not connect the existing WhatsApp Business mobile-app number; Business App coexistence onboarding is Phase 4.

- Credentials are backend environment variables, never passed from browser and never persisted in CRM tables.
- `POST /api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/send` requires a valid Connect JWT, tenant membership, non-viewer role, active WhatsApp channel, reply window, test sender ID, allowlisted recipient, and UUID idempotency key.
- Free-form replies require the latest inbound message to be within **23 hours 45 minutes** as a conservative boundary inside Meta's typical 24-hour customer-service window.
- Database `connect.whatsapp_send_requests` records requests before invoking Meta. Retries with the same request UUID never send twice. Timeouts, 429 and provider 5xx are marked **unknown**, not automatically retried. Operator must inspect before retrying. Meta acceptance is not delivery; delivery/read/failure updates arrive via signed webhook.
- Rate limits: max 5 reserved sends per conversation per minute and 100 per workspace per hour.
- `GET` on the send endpoint returns eligibility only, without secrets. The composer is disabled when the channel/recipient is not specifically configured.
- `/api/connect/webhooks/meta` verifies Meta's `X-Hub-Signature-256` using `CONNECT_META_APP_SECRET`. Its GET verification uses `CONNECT_META_VERIFY_TOKEN`; both checks already existed before Phase 3.
- Database RPCs are `SECURITY INVOKER` and `service_role`-only; the private send ledger has RLS enabled.

## Required actions in the user's Meta account

1. Finish the Meta Developer registration at [Meta for Developers](https://developers.facebook.com/apps/) if it is not complete.
2. Create a **separate Robotronix Connect test app**, add WhatsApp/WhatsApp Business Platform use case, and open WhatsApp **API Setup**. Do not transfer, deregister, or reconnect the existing WA Simple number or the WhatsApp Business mobile app.
3. Obtain the **Meta test phone number ID** and short-lived test access token, and add/verify one destination test number in Meta's allowed recipient list.
4. Configure the following **server-only** environment variables on a controlled DEV environment (for local testing, use `.env.local`). Never send the access token or app secret in chat/screenshots:
   ```dotenv
   CONNECT_META_TEST_SEND_ENABLED=true
   CONNECT_META_TEST_PHONE_NUMBER_ID=<numeric Meta test phone number ID>
   CONNECT_META_TEST_ACCESS_TOKEN=<private test access token>
   CONNECT_META_TEST_RECIPIENTS=<verified destination number, digits only>
   CONNECT_META_GRAPH_VERSION=v26.0
   CONNECT_META_VERIFY_TOKEN=<random webhook verification secret>
   CONNECT_META_APP_SECRET=<Meta app secret, private>
   ```
   Existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` must target **DEV** only. The test token expires; replacing it is expected. `CONNECT_META_TEST_SEND_ENABLED` is **false/disabled** by default.
5. On a publicly reachable **HTTPS DEV deployment**, configure Meta's webhook callback URL: `https://<your-dev-host>/api/connect/webhooks/meta`, with exactly the `CONNECT_META_VERIFY_TOKEN` value, then subscribe to **messages** events. Localhost cannot receive Meta webhooks directly without an HTTPS tunnel. The callback is not activated until the user approves a DEV deployment or supplies a suitable test host.
6. In Connect → **Settings → Lead capture channels**, register a WhatsApp Cloud API channel using the **numeric test phone number ID** (not the visible phone number), label it e.g. `Meta Test WhatsApp`, and activate it **in DEV only**. Do not register any of the existing business/WA Simple production IDs for Phase 3.
7. Use Meta's test screen to send a template such as `hello_world` to the preapproved test recipient (this is performed **in Meta**, not from Connect). Reply from the recipient's WhatsApp to the Meta test number. That reply arrives through the verified webhook and opens the reply window.
8. Open Connect → Communications, select the incoming test conversation, type a reply and click **Send test reply**. Check provider acceptance and the follow-up `sent` / `delivered` / `read` status messages. Refresh messages if needed.
9. Verify duplicate webhook deliveries, expired reply window, viewer role, unregistered channel, and a recipient not in the allowlist are rejected. **Never** add production customer numbers to the test allowlist.

## API and database components

- `lib/server/connect-meta-test.ts`: server-only Graph API v26 text send adapter, test phone/recipient allowlist and timeout/error classification.
- `app/api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/send/route.ts`: eligibility GET and idempotent authenticated send POST.
- `database/connect/saas/32_whatsapp_meta_test_sending.sql`: reservation/completion RPCs, send ledger, 23h45m window.
- `database/connect/saas/33_whatsapp_meta_reply_eligibility.sql`: read-only reply context.
- `database/connect/saas/34_whatsapp_meta_test_send_limits.sql`: database test-rate guard.
- Existing signed `/api/connect/webhooks/meta` receives inbound messages and statuses. Phase 1 stores messages separately from enquiries; Phase 2 provides inbox.

## Checks completed and checks remaining

**Completed in DEV**, inside rolled-back SQL transactions (no messages sent): inbound fixture, reservation, duplicate suppression, accepted send persistence, completion idempotency, forbidden actor rejection, expired reply window, and per-conversation send limit. Server-only RPC grants also verified. PostgREST schema refreshed by each migration.

**Remaining:** CI/TypeScript/Next.js build; real Meta app credentials; HTTPS DEV webhook verification; signed inbound test; real Meta test-number send and delivery callback; multi-agent/browser/mobile QA; production deployment and coexistence (separate approvals). If no test Meta credential has been provided, do **not** claim Phase 3 has passed end-to-end.
