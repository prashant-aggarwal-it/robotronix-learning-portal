# Connect Phase 2C — CRM Workspace UI Implementation

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Environment changed: **Development Supabase only**, plus the dedicated GitHub branch.
Production database, main branch, Netlify deployment and original Portal UI remain untouched.

## Implemented frontend
- Entry at **`/connect`** with its own sign-in screen using the shared Supabase Auth browser client.
- Institute workspace chooser (supports membership in more than one institute) and first-workspace creation flow.
- Scoped `cx-` design system using Portal Inter font and its newer blue/teal design foundations. Separate responsive sidebar, compact top navigation, mobile drawer behavior, readable tables and action buttons.
- Real overview metrics and action-oriented panels, without fake/sample data.
- Searchable enquiry inbox with lead source, latest detail, admissions stage and date.
- Contact directory, create contact dialog, role badges and contact details.
- 360° lead panel with contact details, enquiries, linked admissions, stage selection, activity history, quick follow-up and counselling booking.
- Multi-stage admissions board; configurable default pipeline from institute settings; direct stage updates and optimistic concurrency.
- Follow-up list and completion; counselling/demo/trial appointment list and completion.
- Programme setup and authorized team member listing in institute settings.
- Real loading, API error, empty, success and disabled UI states; all data filtered by logged-in Connect workspace membership.
- Quick enquiry capture matches existing contacts by name and allows explicit reuse without auto-merging family members.
- Dedicated contact creation does **not** generate a false enquiry.
- Opportunities can be created for existing contacts without duplicating people.

## Backend improvements delivered for UI
- `capture_lead`: atomic creation/link of contact, optional contact methods, enquiry, and optional admissions opportunity, with audit event.
- `create_contact`: atomic creation of a canonical contact and contact methods with role.
- `bootstrap_pipeline`: atomic creation of a pipeline and five default stages (New, Contacted, Trial / Counselling, Won, Lost).
- `connect_crm_read(...,'overview',...)`: institute-scoped real counts; today's enquiries use institute timezone.
- Enriched inbox read includes contact name/method, opportunity and current stage.
- Resource/action allow-list updated for the above operations.

## Source of truth
- `app/connect/page.tsx` — app UI wired to private Connect APIs.
- `app/connect/connect.css` — scoped responsive UI styles.
- `lib/connect-client.ts` — typed browser API client and data contracts.
- `app/api/connect/workspaces/[tenantId]/crm/[resource]/route.ts` — restricted authenticated HTTP contract.
- `database/connect/saas/09_crm_commands.sql` and `10_crm_queries.sql` — canonical new-install CRM functions.
- Existing Learning Portal `public` tables are not used directly by the Connect UI.

## Tests actually executed
- Development schema changes applied without error.
- Rolled-back SQL acceptance: 5-stage pipeline bootstrap, one-step enquiry capture with contact and opportunity, two admissions against one contact, enriched inbox, live overview metrics, atomic rollback of invalid lead capture.
- Rolled-back SQL acceptance: standalone contact creates no fake enquiry; a later genuine enquiry updates counts.
- Rolled-back SQL acceptance: existing person reused for later enquiry without duplicating identity.
- Earlier Phase 2B tests: cross-institute access denied, viewer denied write, opportunity optimistic concurrency, relationship constraints.
- All QA transactions rolled back; no test customer records intentionally persisted.

## Not certified (release gates)
- **Next.js TypeScript typecheck and production build have not run.** GitHub connector can edit and fetch files, but local Git checkout is unavailable due to disabled GitHub DNS/network access. Do not claim the UI compiles until checked.
- **Browser interaction, visual screenshots, accessibility audit, mobile QA and authenticated HTTP end-to-end tests have not run**. Implemented UI is not yet a production-certified release.
- Initial list views are bounded to the most recent 100 records. Add server-side pagination and debounced server search for production datasets.
- Onboarding, role permissions, subscriptions and advanced duplicate-merge operations need further product hardening, including tenant-wide usage limits, rate limiting, audit immutability, provider integration and full data retention controls.
- No automatic WhatsApp/email channel ingestion or email invitation delivery is included in Phase 2C.
- Full Portal role regression / demo / finance / scheduling / Zoom tests still pending.
- No production deploy, no merge to `main`.

## Recommended next steps
1. Run `npm run typecheck` and `npm run build` on the Connect branch, resolve all issues.
2. Test `/connect` with two institute staff logins and two different institute memberships; test viewer, admin and owner.
3. Visually review desktop/tablet/mobile against existing Portal (including sidebar, typography, forms, overlay and error states).
4. Add server-side filtering/pagination, accessible drawer/modal focus management and real-world duplicate candidate searches.
5. Complete security/rate-limit/audit acceptance and Portal regression before considering merge or deployment.
