# Robotronix Connect — Phase 3C and cross-phase hardening

Date: 2026-11-05
Branch: `feature/robotronix-connect-crm`
Database modified: **Development only** `fflejkqcspivnhsmkdtn`.
Main, Production Supabase and Netlify live deployment: **unchanged**.

## Delivered — Phase 3C

- Analytics RPC `public.connect_report_read(actor, tenant, from_date, through_date, optional_pipeline)`, with active-tenant manager/admin/owner authorization. Maximum reporting window 367 calendar days. All report queries tenant-scoped.
- Report cohort = opportunities created in selected local institute date range. Includes enquiry counts, won opportunities, cohort conversion rate, and current-stage distribution.
- Historical stage-reach funnel based on distinct opportunities reaching each stage in the `stage_events` history, expressed as a share of the full creation cohort. Does **not** claim step-to-step conversion on strictly linear journeys.
- Counsellor metrics based on **current** opportunity ownership (not historical closer) with won/open/lost, cohort conversion and tasks completed.
- Source metrics use the **earliest linked enquiry** per opportunity (single-touch source). Multiple enquiries for the same opportunity are not double-counted as admissions. Source reports also display raw enquiry counts.
- Campaign finance ledger:
  - `connect.campaign_spend`: dated actual recorded expenditure, per institute/campaign.
  - `connect.realized_revenue`: dated **manually recorded received payments**, linked to an opportunity, requiring a unique reference. No assumption that pipeline expected value equals revenue.
  - All spend and receipts strictly in institute reporting base currency; different-currency opportunities excluded from expected-value sum and explicitly counted.
  - Campaign attribution reuses existing `connect.attribution`, with unique campaign attribution per opportunity; an opportunity without attribution produces no campaign revenue.
- ROI for reporting window = **(recorded receipts minus recorded campaign expenditure) / recorded campaign expenditure**, only when spend is present. Values are not inferred or automatically synchronized from Portal Finance.
- When filtering by one pipeline, ROI and campaign spend are suppressed because costs are not allocated per pipeline (avoid a misleading KPI).
- `public.connect_report_write` supports campaign creation, campaign/opportunity association, spend entry and payment recording. All writes generate audit events.
- `GET/POST /api/connect/workspaces/:tenantId/reports` authenticates via Supabase Auth token; never exposes service secret.
- `Reports & ROI` navigation for owner/admin/manager, date and pipeline filters, stage distribution and historical journey, counsellor performance, lead source comparisons, campaign financial tables, manual record forms and CSV export. Styles scoped to Connect and aligned with Portal foundations.
- CSV export escapes CSV fields and prefixes formula-looking input as a spreadsheet injection safeguard.

## Cross-phase remediation in this pass

- **Authorization defects fixed:** missing membership previously fell through `NOT IN` NULL checks in Analytics write, `connect_update_member` and `connect_register_channel`. All now explicitly reject a NULL/absent membership and are deployed to Development.
- TypeScript-sensitive issue in Phase 3B automation route corrected (`Number.isInteger` unknown value).
- Branch-specific GitHub Actions workflow `.github/workflows/connect-branch-validation.yml` added to request `npm ci`, `npm run typecheck`, demo `npm run build`, structure and communication-security checks on Connect branch pushes. **Run result not accessible/confirmed through currently available GitHub connection.**
- Date-range reporting, currency-safeguards, duplicate payment reference rejection, campaign attribution checks, pipeline-only ROI suppression and early empty-state reports all regression-tested.
- Added repeatable rollback-only analytics suite `database/connect/tests/verify_analytics_dev.sql`.

## Tests executed in Development

Five canonical SQL QA scripts **all passed** on combined current schema, every test rolled back:
1. `verify_workspace_security_dev.sql`: workspace memberships, invitations, permissions, last-owner safety
2. `verify_crm_phase2b_dev.sql`: enquiry/contact/admission lifecycle, stage history, tasks, tenant boundaries
3. `verify_multichannel_dev.sql`: four inbound channels, webhook idempotency, cross-tenant routing, form revocation
4. `verify_phase3b_dev.sql`: assignment/follow-ups/reminders, scheduled-job semantics, conversation history
5. `verify_analytics_dev.sql`: revenue/spend ROI, stage reached count, empty reports, cross-institute read/write denial, mismatched currency, duplicate receipt reference, unallocated spend

Additional final DB check:
- 41 Connect private tables, 80 existing Portal tables.
- All 41 Connect tables have RLS enabled.
- Zero temporary tenants, opportunities, receipts or campaign-spend rows retained after QA.
- `anon` and `authenticated` cannot execute privileged report reader or writer; `service_role` can.
- Development `pg_cron` reminder job remains active; previously observed successful execution.
- Git branch remains ahead of main and not merged.

## IMPORTANT — not finished / not claimed as complete

**Build/UI release gate is still open.** Container cannot resolve GitHub to clone repository, and connected repository tools do not expose a verifiable Actions run result. Cannot truthfully say TypeScript, Next.js build, visual desktop/mobile browser inspection, authenticated HTTP workflow tests or Portal end-to-end regressions have passed. Run the branch validation workflow and existing Portal suites before merge.

**Provider activation remains pending.** Actual Meta WhatsApp/Lead Ads, Resend inbound email, and Cloudflare Turnstile/approved website origins need real account credentials, webhook subscriptions, provider-app approvals and signed HTTP testing. This was not achievable from GitHub and DB tools alone. No outbound WhatsApp/email send flow has been enabled.

**SaaS/product launch gates remain**: per-institute Meta OAuth and token rotation, subscription entitlements, GDPR/privacy/retention/exports review, rate limits, durable retries/monitoring, international phone normalization, true server-side pagination for large CRM lists and opportunity pickers (currently 100 records per loaded view), automated payment-to-Portal reconciliation, CRM UI accessibility audit, full parent/trainer/admin/student Portal regression, and production migration rehearsals.

**Measurement interpretation:** manually recorded receipts are operator-entered and must be reconciled; lead-source attribution and campaign attribution are single touch; current-stage and reached-stage charts are separate; historical staff closer data is not available; results do not claim causality.

## Release order

1. Confirm Connect branch CI TypeScript/build/structure checks; fix any failures.
2. Run authenticated 2-institute browser testing and existing Portal regressions.
3. Verify real provider webhooks in Development, with production-safe secrets, approved apps and form protection.
4. Reconcile finance/retention/entitlements and import/export/pagination requirements.
5. Only then seek explicit approval for a staged Production migration and branch merge.

**Do not merge to main or deploy Production without the user's explicit approval.**
