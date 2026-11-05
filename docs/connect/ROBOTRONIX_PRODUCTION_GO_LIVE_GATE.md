# Robotronix Connect — Production Go-Live Gate (manual CRM first)

**State:** Development implementation and DB tests complete for Simple Mode and intake-first routing. **NOT production-approved**.
Branch: `feature/robotronix-connect-crm`. Production project and `main` must remain unchanged until explicit authorization.

## Completed in Development
1. Simple Mode default, Advanced Mode setting for institute owner/admin, categories configurable and tenant-isolated.
2. Manual capture and provider ingestion create a general enquiry without forcing an admissions deal.
3. Non-admissions enquiries can receive initial follow-up tasks (one open task per person, respecting automation configuration).
4. Channel setup remains available in Simple Settings for institute admins.
5. Enquiry inbox filters, category edits and review-before-apply heuristic suggestions.
6. Dev SQL acceptance: workspace security, CRM, multichannel ingestion, automation, analytics and `22_verify_simple_mode_dev.sql` PASSED with rollback. No QA fixtures remain by design.
7. All checked `connect` tables have RLS enabled; they are private tables using service-only RPC endpoints, which intentionally do not expose direct RLS policies to regular users.

## Blockers before any production deployment
1. **Verified build:** GitHub/runner must execute `npm ci`, `npm run typecheck`, `npm run build`; inspect logs and resolve failures. No successful run is yet confirmed. Never call build green based only on source review.
2. **Browser UAT with real auth**: owner, counsellor and viewer; verify navigation, category CRUD, manual lead capture, duplicate matching, non-admission followups, category change, tasks completion, mobile layout, tenant switches, authorization failure scenarios. Confirm existing Portal functions (four roles, scheduling, Zoom, payroll, finance) are unaffected.
3. **Test signed provider webhooks** on a non-production/approved development Meta setup before live number cutover; verify signature, replay, contact dedupe, inbound conversation, routing and fail-safe. Verify whether existing business number can be connected without disrupting WhatsApp Business usage; this is provider/account-specific and not proven here.
4. **Production migration rehearsal** against sanitized copy of target DB schema. Review all Connect migrations in order. Important follow-on scripts: `20_simple_mode_enquiry_classification.sql`, `21_intake_first_inbound.sql`, `23_unqualified_enquiry_followups.sql`. Tests `22_verify_simple_mode_dev.sql` must **never** be shipped as a production migration.
5. **Backups/recovery**: check backup coverage, schedule, restore drill and owner approval before migrations. No destructive Portal table changes.
6. **Configure Netlify server-only secret values** (service credentials/webhook verification) in approved environment; no secrets in source or public `NEXT_PUBLIC_` variables. Confirm inbound URL and firewall/rate limits; ensure legal/privacy consent and staff access.
7. **Observability**: review webhook failure/retry counts, task creation, logs and alerts; establish a way to identify delivery gaps and outages. Existing in-app reminder cron has Dev configuration only and needs separate Production scheduling decision.
8. **Final staging pilot**: use dummy enquiries first; reconcile contact and task counts and source/category handling, then manual low-volume Robotronix trial. Require explicit approval for Production merge/credentials/migration/deploy.

## Minimal first production release (without WhatsApp integration)
- Owner account, Simple Mode, manual enquiries, category sorting, contact view, due tasks and basic pipeline qualification.
- Keep externally triggered inbound channels disabled until signed live webhook tests and provider approval.
- No automatic outbound WhatsApp/email. Do not promise this feature until implemented and tested.

## Acceptance scenarios
- Parent enquires about an online Python course: enquiry captured, category selected, one task; admissions deal is created only after qualification.
- Person requests an Arduino kit: category Kits & Components, follow-up task, no forced admissions deal.
- School requests STEM lab partnership: category School Programs, follow-up task, optional proposal work; no forced admissions deal.
- Trainer asks about jobs via WhatsApp: record as an enquiry, classify Trainer / Job Applicant, follow-up task, **zero** automatic admissions deals.
- Repeated WhatsApp message from same contact: retain additional conversation message, do not create duplicate person or open follow-up task.
- Different institute: no access to other institute's enquiries, categories, settings or tasks.
- Toggle Advanced and back: same records and permissions, only navigation visibility changes.
- Existing Learning Portal: unrelated functionality and database remain unchanged.

## Operational caveats
- Enquiry type is single-select, not multi-tag. Classifier is a suggested keyword match requiring confirmation, not AI automation.
- New channels need credential setup, signature-verification tests and operational monitoring.
- Enquiry UI loads up to 100 recent records. Pagination/search are needed if usage increases.
- Service-role use is server-side only; always check API authorization and organization membership.
- Supabase Dev advisors report legacy Portal/public warnings. Connect private RLS no-policy notices are an intentional closed-data model; other warnings must still be reviewed independently for production.
