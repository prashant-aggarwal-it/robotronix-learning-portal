# Connect/Portal source consolidation — implementation & release gate

Branch: `feature/robotronix-connect-crm`. Do not merge to `main`, deploy, or modify Production without explicit approval.

## Implemented in repository

- Extracted Connect navigation/model and category suggestions into `features/connect/model.ts`; enquiry preference types into `features/connect/types/enquiries.ts`.
- Extracted `ConnectSidebar`, `ConnectTopbar`, `ConnectAuthGates`, and generic empty/error states.
- Grouped the Connect channel, automation, communication, report and enquiry settings components in `features/connect/components/`; deleted superseded `components/connect/` files.
- Canonicalized Connect browser API client and contracts at `features/connect/api/client.ts`; deleted unused `lib/connect-client.ts` after checking all Connect branch TS/TSX paths for imports.
- Added shared `components/ApplicationSwitcher.tsx`, used by Portal admin and Connect (when Portal admin access is available). Portal admins can open Connect before their first workspace exists.
- Added Connect route-level metadata and CSS import. Kept `cx-` CSS scoping, leaving Portal styling unaffected.
- Moved seven read-only/rollback-only database verification scripts from `database/connect/saas/` to `database/connect/tests/`; source SQL files retain their original names and order.
- Updated Connect documentation paths. Added `database/connect/README.md` and SQL/code structure checks to GitHub branch workflow.

## Deliberately NOT changed

- `main` and all deployed systems; the Production and Development database contents/schema.
- Existing Portal installer generation paths; applied SQL migration history.
- Complex Portal domain modules and the large Portal global stylesheet; bulk moves are unsafe without full regression.
- Connect main feature screens remain orchestrated in `app/connect/page.tsx` and can be split further after authenticated browser tests; this is not evidence of duplicate implementation.

## Verification boundary

**Source inspection performed:** moved files and imports have been checked on the feature branch; stale `components/connect/` and `lib/connect-client.ts` imports were removed from examined Connect source. CI has `npm ci`, TypeScript, Next.js build, structure checks and two Connect layout checks configured.

**Not yet verified:** actual completed CI logs, compiled production build, Portal role regressions, Connect authentication/tenant-switch browser UAT, webhook integrations, or mobile rendering. Passing text/path checks alone does not certify these.

## Before approving merge

1. Review GitHub Actions **Connect branch validation** logs; fix any typecheck, build, structure or import failures.
2. Test Portal admin (with and without a Connect workspace), Portal parent/trainer/student navigation, and Connect owner/manager/viewer roles.
3. Check cross-application navigation, first-workspace creation, sign-in continuity, Connect CRUD, tenant isolation and mobile sidebar.
4. Execute Connect database rollback-only DEV tests in an approved development environment only (never against Production).
5. Run existing Portal scheduling/Zoom/finance regression suite and check key styling at desktop/mobile sizes.
6. Reconfirm branch diff and migration map before user-approved merge.

No validation step should be described as passed until its run result is inspected.

## Simplified organization UX (November 2026)

- Development database read-only inspection confirmed an active `Robotronix Tech Lab` workspace (`robotronix-tech-lab`). No database records were created or altered.
- A user with one authorized workspace opens that workspace directly; its selector is hidden.
- A user with multiple authorized workspaces retains the organization dropdown.
- A user with zero workspace memberships sees an access request / retry gate instead of self-service organization creation.
- The `POST /api/connect/workspaces` provisioning API and multi-tenant backend remain available for future controlled provisioning. **Important:** this pass changes the user interface only; server-side provisioning restrictions are NOT yet implemented. Restrict the API before any public SaaS rollout.
- Existing workspace memberships and tenant permission checks remain the source of truth; a Portal login alone does not grant CRM access.
- Validate that the current account has a membership in Robotronix before testing the direct dashboard flow.


## Dashboard visual refresh — reference-led, data-first

The CRM overview now has clickable KPI cards, a source-distribution summary of the currently loaded enquiry records (up to 100 from the existing API), action-focused task/appointment widgets, and an advanced-only pipeline stage snapshot (also limited to the currently loaded opportunity records). It deliberately shows no invented conversion percentages, revenue, messaging delivery rates or AI lead scores. It retains the existing recent-enquiries and attention panels.

Further product candidates to assess separately before implementation: omnichannel inbox with verified WhatsApp provider support; a consolidated contact journey; role-specific productivity metrics; payments only when actual payment integration and tenant permissions are verified; funnel analytics with appropriate dedicated aggregate endpoints for accurate historical reporting. Keep all new reporting tenant-scoped, clear about date ranges, and honest about sampling/pagination.

Validation still needed: npm typecheck/build, mobile-width visual review, zero-data and large-data rendering, all section links in Simple and Advanced modes, permissions and a real DEV account. No schema, Production or deployed service was changed by this UI work.


## Contact 360 Phase 1 — implemented on feature branch

- Extracted reusable `features/connect/components/contact/ContactProfile.tsx` from the long in-page profile UI.
- Wider responsive drawer, Robotronix-consistent identity header, contact status and role, tap-to-call / email links when a valid contact method exists, new enquiry with existing-contact prefill, and quick access to Activity / Follow-ups.
- New tabbed layout: Overview (admissions and enquiries), Activity (existing opportunity timeline, counselling notes, conversation component), Follow-ups (contact and opportunity-linked tasks/appointments, existing create forms), Details (contact methods and existing admission creation).
- Three summary cards reflect **currently loaded** records only; do not claim database-wide totals. All linked record queries remain bounded by existing API pagination; full contact history is Phase 2.
- Preserved existing CRM write commands, membership permissions, source data, and error/notice handling; no schema or RPC mutations introduced.
- Existing activity timeline is still opportunity-scoped, not a true contact-wide timeline. Combined historical activity requires Phase 2 backend work.
- Regression tests to run locally: TypeScript, production build, drawer opening from Contacts/Enquiries/Pipeline, tab actions, new enquiry prefill and back/cancel, note/task/appointment/admission creation, viewer read-only behavior, cross-tenant switching and mobile layout. No GitHub workflow run has confirmed these yet.


## Contact 360 Phase 2 — feature branch implementation (database activation pending)

- Added `features/connect/components/contact/ContactTimeline.tsx`: merged newest-first event feed, event-type filter, page-by-page loading, responsive entry styling, refresh/retry, zero-state, and protection against stale asynchronous responses on contact/workspace changes.
- Replaced the old opportunity-only timeline in `app/connect/page.tsx`. Notes remain writable with existing permission checks; conversations now display as message events within the unified feed.
- Added `GET /api/connect/workspaces/[tenantId]/contacts/[personId]/timeline`. Requires a valid authenticated session, validates UUIDs and cursors, sets no-store, and calls a service-role-only RPC.
- Added **NOT APPLIED** `database/connect/saas/24_contact_360_timeline_PENDING.sql`. The function explicitly verifies active workspace membership and contact tenant ownership; its rows include enquiries, notes/activities, admissions created, real stage history, task creation/completion, appointment scheduling, and recorded inbound/outbound messages.
- Cursor pagination is ordered by (record timestamp, deterministic prefixed ID), avoiding offsets on heavily mixed event streams. Historical record changes without timestamps cannot be reconstructed; do not invent past calls or appointment completions.
- Corrected the pre-existing ContactProfile TypeScript mismatch (`opportunities` and `canWrite` missing from its Props type).
- **Operational status:** No Supabase SQL has been executed, no deploy, no merge. DEV inspection on 2026-11-06 confirmed the new RPC is absent; the API returns 503 "Contact timeline is not yet enabled in this environment" until a separately approved DEV activation. GitHub build and real UI tests are still outstanding.
- Required QA after approval: function permissions (service_role only), no access for inactive or different-tenant users, nonexistent contact, independent opportunity links, stable pagination for same-time entries, all event types, live note/task updates, viewer mode, mobile and cross-workspace navigation.

## DEV timeline activation — 2026-11-06

The user explicitly approved DEV database changes. Migration `connect_contact_360_unified_timeline` was successfully applied to project `fflejkqcspivnhsmkdtn` (Development DB – Robotronix Learning Portal). Verification: `connect_contact_timeline` exists; service_role EXECUTE true, anon/authenticated EXECUTE false, security_definer false; invalid actor rejected with SQLSTATE 42501. No contacts existed at verification, so event content, pagination and browser checks remain to be tested with actual contacts. No Production change, merge or deployment. The historical source file still uses `_PENDING` in its filename; its content now records the DEV-applied state.

## Contact 360 Phase 3 — implemented and DEV activated (2026-11-06)

- Added Contact 360 `Relationships` tab with person-to-person links (parent/student, guardian, sibling, colleague, referral, custom), organization association/position, and contact owner assignment.
- Added dedicated reusable `features/connect/components/contact/ContactRelationships.tsx` with reusable controls, empty states, refresh and role-appropriate read/write actions; linked organization creation reuses the existing CRM command.
- Added Next.js `GET`/`POST` route `/api/connect/workspaces/[tenantId]/contacts/[personId]/relations` with session, UUID and action validation, using two limited service-only RPCs.
- DEV migrations `connect_contact_relationships_phase3` and `connect_contact_owners_rls` applied successfully to `fflejkqcspivnhsmkdtn`. Added private `connect.contact_owners` for accountable contact-level ownership; kept the existing opportunity owner and the canonical `person_relations`/`organization_contacts` tables.
- Database verified two RPCs are service-role-only, not SECURITY DEFINER. Transactional DEV test verified link/read/unlink/assign/unassign; SQL transaction was rolled back. Forged-actor read and write calls rejected. New owner table RLS enabled; its underlying private data is not exposed to `anon`/`authenticated`.
- `main`, production database and deployments remain unchanged. A successful Next.js typecheck/build and browser end-to-end regression test with real contacts are not yet evidenced; do not claim those passed.

## Phase 4 — Contact Intelligence (DEV activated, 2026-11-06)

- Added `features/connect/components/contact/ContactIntelligence.tsx`: Contact 360 Insights tab plus prioritized workspace attention list. UI surfaces factual contact health, lead ageing, next action suggestions and a digest composed from recorded CRM counters. This is **not** a model-generated or predictive AI summary; no contact PII is transmitted to an external AI provider.
- Added authenticated `GET /api/connect/workspaces/[tenantId]/intelligence` with strict UUID/limit validation and server-only `connect_contact_insights` RPC.
- Added `database/connect/saas/27_contact_intelligence.sql`; applied migration `connect_contact_intelligence_phase4` to DEV `fflejkqcspivnhsmkdtn` successfully. Aggregate data includes linked enquiries, open/overdue tasks, upcoming appointments, active/won opportunities, contact owner presence and latest recorded interaction from enquiries, notes, messages and stage changes.
- Indicators are transparent operational heuristics, not AI lead scores. Workspace preview is limited to 50 top-priority contacts; never label that a comprehensive historical report.
- Added safe click-through to contacts beyond the first 100 initially loaded people records, using tenant-scoped single-contact retrieval and stale response checks.
- Rollback-only DEV test with an 11-day-old enquiry and two-day-overdue task verified expected counts and priority 4. Forged actor rejected; no fixture data persisted. No Production changes, deployment or merge.
- **Pending QA:** Local typecheck/build, browser and mobile visual verification, real-tenant end-to-end workflows, high-volume query performance, and a dedicated AI-provider/privacy approval if genuine LLM-generated summaries are desired.

## WhatsApp messaging foundation — Phase 1 (DEV applied 2026-11-06)

- Introduced `28_whatsapp_messaging_foundation.sql` with a new service-only WhatsApp message intake RPC, independent chat/contact threading, deduped events and first-contact-only unclassified enquiry capture. A compatibility override for `connect_ingest_channel` routes existing WhatsApp callers through the safe intake; all other provider ingestion paths remain unchanged.
- Introduced `29_whatsapp_inbox_read_apis.sql` and secured `GET /api/connect/workspaces/[tenantId]/whatsapp/threads`, `GET /api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]/messages`. Stable keyset pagination and active workspace membership checks are enforced at the database boundary; the private `connect` schema is not exposed to client browser keys.
- Updated signed `app/api/connect/webhooks/meta/route.ts` to process WhatsApp `messages`, `statuses` and coexistence `smb_message_echoes`. App echo events are outbound (recipient phone in the `to` field); delivery statuses do not generate conversations/enquiries.
- Message media-type, provider media ID, mime, filename and reply-to metadata are preserved; media binaries are not fetched in this phase. Early delivery status events are stored and reconciled when the corresponding outbound echo arrives.
- **DEV only:** applied migrations `connect_whatsapp_messaging_foundation_phase1` and `connect_whatsapp_inbox_read_phase1` to `fflejkqcspivnhsmkdtn`. SQL rollback-only fixtures passed for new contact + enquiry, subsequent message without new enquiry, dedupe, two business numbers, out-of-order status, document metadata, both read pagination and forbidden actor. Four RPCs are service-role-only; `SECURITY DEFINER` is false.
- **Release gate:** No real Meta credentials, channel registration, WA Simple migration or live webhook tests performed. No UI inbox or outbound send endpoint is implemented in Phase 1. Local TypeScript build, GitHub CI, authenticated HTTP tests and real coexistence subscription tests remain outstanding. Main, production, deployments and Meta account settings unchanged.

## WhatsApp Inbox — Phase 2 implemented (DEV activated 2026-11-06)

- Added `features/connect/components/ConnectWhatsAppInbox.tsx` with conversation list, number filter, search across loaded conversations, unread filtering/counters, status selector, agent assignment, contact linking/search, message bubbles, media metadata placeholders, cursor-based older messages, refresh and per-agent saved reply drafts. Messages are rendered as untrusted text, no automatic sending.
- Added the responsive `cx-wa-` scoped CSS; placed the inbox under Communications in both Simple and Advanced Connect. When the linked CRM contact falls outside the first 100 people, fetch its record by ID before opening Contact 360°.
- Added secured `GET/PATCH /api/connect/workspaces/[tenantId]/whatsapp/conversations/[conversationId]` and `GET /api/connect/workspaces/[tenantId]/whatsapp/contacts`. Existing read endpoints and RPCs are reused. New SQL `30_whatsapp_inbox_workflow.sql` includes private `connect.whatsapp_thread_state`, assignment FK and tenant-checked workflow procedures. DEV migration `connect_whatsapp_inbox_workflow_phase2` applied.
- Fixed identity drift in `31_whatsapp_preserve_contact_links.sql`: after manual CRM contact linking, new WhatsApp messages retain that link instead of overwriting it using phone matching. DEV migration `connect_whatsapp_preserve_manual_links_phase2` applied.
- Rollback-only DEV tests passed for read/unread, drafts, assignment, status, contact matching, unauthorized actor and link persistence after later messages. No fixture records retained.
- **Sending remains deliberately disabled.** Phase 2 stores reply drafts only. Phase 3 must provide secure Meta Cloud API sending, live callback configuration, verified credentials, provider-level media retrieval, and live end-to-end tests; Phase 4 is the Business App coexistence onboarding.
- **QA gate:** Next.js TypeScript/build, authenticated HTTP tests, mobile/browser verification, high-volume performance, viewer read-only regression and full app integration checks still pending. Production database, main branch, deployments and WA Simple untouched.
