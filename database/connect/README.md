# Connect database: source, history and verification

Connect owns the private PostgreSQL `connect` schema and service-only `public.connect_*` RPCs. The Learning Portal owns its separate `public` tables and installer. **Do not run Connect SQL through the Portal fresh-install generator.**

## Directory guide

- `saas/` — SQL definitions and **historical applied changes**. Preserve their content and ordering; these files are not a one-click migration runner.
- `tests/` — read-only and rollback-only verification scripts. **Never apply these as migrations or ship them with production installation.**
- `README.md` — current operating instructions and safety rules.

## Source classification

| File in `saas/` | Purpose | Status |
| --- | --- | --- |
| `01_connect_independent_schema.sql` | Foundation schema | Canonical initial source |
| `02_retire_empty_prototype_dev_only.sql` | Remove empty legacy prototype tables | Historical DEV-only; **never rerun** |
| `03_harden_canonical_model_dev.sql` | Early model correction | Historical DEV-only; folded into foundation |
| `05_workspace_security.sql` | Workspace access and invitations | Active schema/RPC source |
| `06_auth_user_permission_fix_dev.sql` | Early DEV compatibility correction | Historical; folded into current source |
| `07_member_management.sql` | Staff membership RPCs | Active |
| `09_crm_commands.sql` | CRM write RPCs | Active |
| `10_crm_queries.sql` | CRM read RPCs | Active |
| `12_multichannel_ingestion.sql` | Inbound integrations | Active |
| `15_workflow_automation.sql` | Tasks, reminders and automation | Active |
| `16_schedule_inapp_reminders_dev.sql` | Development cron scheduling | DEV-only; never automatically promote |
| `18_admissions_analytics.sql` | Analytics and reporting | Active |
| `20_simple_mode_enquiry_classification.sql` | Simple Mode and categories | Active |
| `21_intake_first_inbound.sql` | Enquiry-first inbound policy | Active |
| `23_unqualified_enquiry_followups.sql` | Initial follow-ups | Active |
| `24_contact_360_timeline_PENDING.sql` | Unified contact-wide timeline RPC | **Applied in DEV 2026-11-06; not applied in Production** |\n| `25_contact_relationships.sql` | Contact relationship/organization/owner RPCs and owner table | **Applied in DEV 2026-11-06; not applied in Production** |\n| `26_contact_owners_rls.sql` | Enable private-table RLS and indexing | **Applied in DEV 2026-11-06; not applied in Production** |
| `27_contact_intelligence.sql` | Explainable CRM contact and workspace intelligence RPC | **Applied in DEV 2026-11-06; not applied in Production** |\n| `28_whatsapp_messaging_foundation.sql` | Separate signed WhatsApp chat events from enquiries; dedupe/status/media fields | **Applied in DEV 2026-11-06; not applied in Production** |\n| `29_whatsapp_inbox_read_apis.sql` | Tenant-authorized WhatsApp threads/messages with stable cursor pagination | **Applied in DEV 2026-11-06; not applied in Production** |\n| `30_whatsapp_inbox_workflow.sql` | Per-agent unread state, drafts, assignments, contact links, search | **Applied in DEV 2026-11-06; not applied in Production** |\n| `31_whatsapp_preserve_contact_links.sql` | Keep explicitly linked CRM identity on future messages | **Applied in DEV 2026-11-06; not applied in Production** |
| `32_whatsapp_meta_test_sending.sql` | Idempotent Meta test text-send ledger; 23h45m reply window | **DEV applied 2026-11-06; no Production** |
| `33_whatsapp_meta_reply_eligibility.sql` | Authorized reply eligibility for inbox | **DEV applied 2026-11-06; no Production** |
| `34_whatsapp_meta_test_send_limits.sql` | Conversation and workspace test-send rate limits | **DEV applied 2026-11-06; no Production** |

The numbers deliberately retain original order and gaps where verification files were relocated. **Do not renumber applied source files.**

## Verification

`tests/` contains `verify_foundation.sql`, `verify_workspace_security_dev.sql`, `verify_crm_phase2b_dev.sql`, `verify_multichannel_dev.sql`, `verify_phase3b_dev.sql`, `verify_analytics_dev.sql` and `verify_simple_mode_dev.sql`.

Most tests need two confirmed DEV Auth accounts. Rollback-only tests should not leave fixture records. The foundation check reports live counts; do not assume historical counts remain current. Check RLS, privileges, tenant isolation and the application separately.

## Migration safety

1. Verify the exact Supabase project ID before executing any SQL. Current Connect work is DEV only; **do not touch Production without explicit approval**.
2. Compare the repository SQL to `supabase_migrations.schema_migrations` / the Supabase migration history. The historical migration names are **not one-to-one** with numbered source files; later incremental fixes may have been applied directly.
3. Never execute the full `saas/` directory in filename order: it contains historical DEV-only cleanup and cron operations.
4. Never reapply an already applied migration, drop/recreate Connect tables, or reset Portal data as part of a file reorganization.
5. Before a new environment is created, produce and test a reviewed **canonical installation sequence** in an isolated empty project, then run tests. The current source list is not yet certified as a fresh-install bundle.
6. Preserve historical SQL needed to understand applied changes; remove only proven obsolete copies or stale references, not migration provenance.

The Learning Portal's existing `database/01_install/`, `database/02_qa/` and related scripts remain unchanged during this Connect-only cleanup.

## Contact 360 Phase 2 activation gate

The feature branch contains `24_contact_360_timeline_PENDING.sql` and the matching authenticated Next.js API route.
The SQL is **not installed** in DEV or Production; the UI timeline will not load until this reviewed SQL
has been applied explicitly to the intended environment. Do not deploy or apply it automatically.

After approval, review permissions, execute **only this new pending SQL** against the approved DEV
project, confirm the `connect_contact_timeline` function signature and service-role-only EXECUTE,
run cross-tenant and pagination tests, and only then consider production promotion separately.
No Connect tables need rebuilding. The endpoint avoids direct PostgREST access to the private `connect` schema.

## Contact 360 Phase 3 activation

DEV migrations `connect_contact_relationships_phase3` and `connect_contact_owners_rls` were installed on 2026-11-06, with user approval. The feature branch adds the `Relationships` tab, person-to-person links with customizable descriptions, organization links, organization creation, and contact-specific owner assignment. Existing admissions ownership remains separate. The new RPCs enforce active membership; only managers/owners/admins can assign the contact owner, while viewers cannot write. The relation tables predate Phase 3 and were reused. All tables stay in the private `connect` schema; the public RPCs are callable by `service_role` only.

A rollback-only DEV transaction exercised linking, unlinking, owner assignment and unassignment, and readback; its data was rolled back. Production remains unchanged. The DEV dataset currently contains no contacts, so browser regression testing with real contacts remains outstanding.

## Phase 4: factual contact intelligence

Migration `connect_contact_intelligence_phase4` applied to DEV project `fflejkqcspivnhsmkdtn` on 2026-11-06. It exposes service-role-only `connect_contact_insights` with active workspace membership checks. No new tables or external AI integration are required. The UI shows lead ageing, overdue actions, active opportunities without next steps, unassigned contacts, operational follow-up health and explainable summaries. The dashboard previews up to 50 prioritized contacts; individual insights query the whole contact history through the database aggregation. A rollback-only fixture with an overdue task verified the response and checked unauthorized actor rejection. Production remains unchanged.

## WhatsApp integration — Stage A / Phase 1 (DEV 2026-11-06)

**Scope:** Messaging data foundation only; no real Meta phone number or WA Simple webhook was changed. Existing Meta webhook route recognizes `messages`, `statuses`, and `smb_message_echoes` after Meta HMAC verification. A new dedicated `connect_ingest_whatsapp_message` function separates conversation storage from enquiry creation. It creates an unclassified enquiry only for a **newly created contact** on their first inbound WhatsApp message. Subsequent incoming texts, media events and echoes are stored as messages only. Legacy calls to `connect_ingest_channel(..., 'whatsapp', ...)` route to the new function; other channels retain existing intake behavior. Do not assume every message is a sales lead.

Message records include type, provider media identifiers (not publicly accessible downloadable URLs), reply reference and delivery timestamps. Raw media downloads and signed media retrieval are **not yet implemented**. Delivery events are saved separately, including statuses that arrive before outbound echo storage. Distinct WhatsApp phone_number_id values are separate registered `channel_accounts` and have independent conversations.

New server-only read APIs: `GET /api/connect/workspaces/[tenantId]/whatsapp/threads` and `GET /api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/messages`. Both require a Connect session and confirm membership in the RPC. They return at most 100 records per page and expose no provider token.

**Installed DEV migrations:** `connect_whatsapp_messaging_foundation_phase1` and `connect_whatsapp_inbox_read_phase1`. Rollback-only DEV fixture verified first inbound enquiry, no subsequent enquiry, duplicate webhook idempotency, multi-number separation, out-of-order read/sent status, document metadata, both read cursor types and unauthorized actor rejection. Tests left no records. `database/connect/tests/verify_whatsapp_phase1.sql` documents read-only checks. DEV has no real WhatsApp channel connected.

**Not yet implemented:** Message send API, WhatsApp conversation composer/inbox UI, media retrieval, live subscriptions, Meta Developer app setup, coexistence onboarding, and campaigns. Complete those in Phases 2–4, and run a full Node/Next.js build and signed webhook replay before enabling a live number. Never touch Production, `main`, Meta app settings, or WA Simple without explicit approval.

## WhatsApp inbox — Phase 2 (DEV 2026-11-06)

The `ConnectWhatsAppInbox` replaces the flat Communications history page and is visible in Simple and Advanced navigation. Its two-pane desktop and single-pane mobile layout supports separate business numbers, message bubbles, inbound/outbound history, media metadata placeholders, read/unread state per team member, search/filter across loaded threads, conversation open/pending/closed status, manager-only owner assignment, contact search/linking, and a saved reply draft composer. The source explicitly disables live Send until Phase 3 provider integration; do not call Phase 2 an active WhatsApp sending client or claim that media binary download works.

DEV migrations `connect_whatsapp_inbox_workflow_phase2` and `connect_whatsapp_preserve_manual_links_phase2` applied to `fflejkqcspivnhsmkdtn`. `connect.whatsapp_thread_state` is private, RLS enabled, service-role only. New RPCs verify active tenant membership, writer permissions, contact tenancy, and manager-only assignment. The Phase 1 inbox read RPC is extended to report unread counts and assignment. CRM contact linking is preserved by incoming message ingestion even if incoming name/phone matches a separate legacy contact. Inbox history remains paginated to 100 records maximum per request; search/filter applies to loaded threads only.

Rollback-only DEV tests verified unread markers, persistent drafts, assignment, status, contact search/linking, unauthorized actor rejection and preservation of manual contact links on subsequent messages. No test data remains. End-to-end UI/browser QA and successful full TypeScript build have not yet been demonstrated; no Meta credentials or real numbers were connected.

## WhatsApp Phase 3 — Meta test sending (2026-11-06)

The feature branch now includes `lib/server/connect-meta-test.ts`, an authenticated `GET/POST .../whatsapp/conversations/[conversationId]/send` endpoint, and test-enabled inbox composer. **Sending is disabled unless an explicit Meta TEST sender, token, and recipient allowlist are configured in DEV.** The system does not allow arbitrary recipient numbers or sending outside the verified recent-inbound customer-service window. Token and App Secret stay in server environment variables, never in DB or frontend.

Applied DEV migrations: `connect_whatsapp_meta_test_sending_phase3`, `connect_whatsapp_meta_reply_eligibility_phase3`, and `connect_whatsapp_meta_test_send_limits_phase3`. The database holds a private RLS-enabled, idempotent send-request ledger. Status callback handling from Phase 1 is reused. Rollback-only tests verify successful reservation/completion, duplicate suppression, missing membership, reply-window expiry, and 5-per-minute rate guard. No Meta API calls were performed, no real message sent, and no production number, WA Simple integration, deployment, or main branch changed.

See `docs/connect/WHATSAPP_META_TEST_SETUP.md` for the exact user-side Meta Developer setup and acceptance plan. Live test-number sending and webhook verification remain blocked until the user configures an owned Meta test app and accessible HTTPS DEV endpoint. Also pending: TypeScript/Next.js build and browser regression testing.
