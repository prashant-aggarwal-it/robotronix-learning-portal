# Robotronix Connect — Phase 2B Core CRM Backend
Date: 2026-11-05
Environment: Development Supabase only (`fflejkqcspivnhsmkdtn`)
Branch: `feature/robotronix-connect-crm`
Status: **Database RPC and authenticated API implementation complete; release gate OPEN.**

## Product design
Connect remains a standalone institute CRM inside the **private `connect` schema** of the same Supabase database as the Portal's existing `public` schema. Institutes are distinguished by tenant ID; no Connect business table has a direct Portal foreign key. Existing Supabase Auth is shared; Connect has independent tenant membership roles.

## Phase 2B implementation
1. **Canonical contacts**: add, edit, role labels, multiple contact methods; exact normalized-value duplicate candidate lookup. No automatic merging of shared family phone/email values.
2. **Families and institutes**: household membership, person-to-person guardian/learner relationships; organizations and contacts.
3. **Enquiries**: record leads from any declared source (WhatsApp, phone, walk-in, website, referral etc.), attached to a person or opportunity.
4. **Programmes**: institute-owned programmes and codes.
5. **Configurable admissions**: pipeline creation, configurable open/won/lost stages, opportunity creation, learner and programme links, staff assignment, stage history, optimistic concurrency through `version`, terminal win/loss outcome.
6. **Follow-ups**: create/update/complete tasks, assignee controls, due dates, activity logs.
7. **Counselling and trial appointments**: create, reschedule, complete, cancel or mark no-show.
8. **Audit**: each successful CRM command adds a tenant-scoped event. Note: immutable audit guarantees and extended before/after details remain release hardening tasks.
9. **Reads**: paginated people, duplicate candidates, households, organizations, programs, pipelines/stages, opportunities, enquiries, tasks, activities, appointments and combined activity/stage timeline.

## Implementation
- `database/connect/saas/09_crm_commands.sql`: restricted `public.connect_crm_write` RPC. Writes occur transactionally and enforce active institute membership plus roles; composite tenant-aware FKs prevent linking another institute's entities. Management configuration requires owner/admin/manager; viewer cannot write.
- `database/connect/saas/10_crm_queries.sql`: restricted `public.connect_crm_read` RPC. Every query filters tenant records. Pagination capped to 100 records and 10,000 offset.
- `app/api/connect/workspaces/[tenantId]/crm/[resource]/route.ts`: authenticated GET and POST. Only explicitly whitelisted resources/actions accepted. The caller ID comes from Supabase `auth.getUser(token)`, never request body. Database RPC execution is service-only; neither `anon` nor `authenticated` can invoke RPC directly.
- `lib/server/connect-auth.ts`: safe HTTP error mapping (conflict, authorization, validation).
- `database/connect/saas/11_verify_crm_phase2b_dev.sql`: complete rollback-only CRM journey and isolation test.

## HTTP API usage
Use `Authorization: Bearer <Supabase user access token>`, and a tenant UUID previously returned by `GET /api/connect/workspaces`.

**Read** `GET /api/connect/workspaces/:tenantId/crm/:resource?limit=30&offset=0&search=...`.
Resources: `people`, `contact_matches`, `households`, `organizations`, `programs`, `pipelines`, `opportunities`, `inquiries`, `tasks`, `activities`, `appointments`, `timeline`. Specify `id=<uuid>` for record-specific reads when supported; `timeline` requires it.

**Write** `POST /api/connect/workspaces/:tenantId/crm/:resource`, body `{"action":"create_person","data":{"name":"Parent Example","role":"guardian"}}`.
The `resource` path and action must match:
- people: `create_person`, `update_person`, `add_person_role`, `add_contact_method`, `link_people`
- households: `create_household`, `link_household_member`
- organizations: `create_organization`, `link_organization_contact`
- programs: `create_program`
- pipelines: `create_pipeline`, `add_stage`
- opportunities: `create_opportunity`, `link_opportunity_person`, `link_opportunity_program`, `move_opportunity`, `assign_opportunity`
- inquiries: `create_inquiry`
- tasks: `create_task`, `update_task`, `complete_task`
- activities: `log_activity`
- appointments: `create_appointment`, `reschedule_appointment`, `finish_appointment`

Opportunity stage moves and assignments require the last-seen numeric `version` and return HTTP 409 on stale updates.

## Executed Development QA
- Realistic parent/learner/family, programme, enquiry, opportunity, follow-up, call activity, counselling, rescheduling, and won-stage journey succeeded.
- Invalid initial terminal stage rejected; valid stage movement and history recorded.
- Contact matching, households, opportunities, activity listing and timeline returned expected tenant data.
- Two-institute cross-tenant read/write and cross-tenant relationship tests rejected.
- Viewer role could read but could not mutate; staff-configuration privileges restricted.
- Stale version rejected.
- All QA rows rolled back; final database query confirms 0 test tenants, people, opportunities, tasks and appointments.
- 36 Connect tables all with RLS enabled; 80 Portal tables preserved; no Connect-to-Portal FKs; restricted RPCs not executable by `anon` or `authenticated`, service_role permitted.

## Release blockers and remaining work
- **No Next.js typecheck/build or authenticated HTTP/Playwright regression executed.** Repository cannot be cloned in current runtime (GitHub DNS unavailable), and there is no working local checkout. Must run before merge/deploy.
- **No independent empty-DB fresh-install test** yet.
- No completed Connect UI, automated external WhatsApp/email/Meta lead ingestion, dedupe/merge UI, reminders engine, or subscription enforcement. Those are separate phases.
- CRM contact normalization for international phone numbers and automatic duplicate resolution should be built as audited services before real imports.
- Production hardening: finer role permissions, rate limits, PII retention/exports, audit immutability, appointment conflict detection, reporting, integration idempotency and observability.
- Product SaaS tenant/security review and Portal regression are prerequisites to production launch.
- No merge into `main`, no Production DB mutation, no deployment.
