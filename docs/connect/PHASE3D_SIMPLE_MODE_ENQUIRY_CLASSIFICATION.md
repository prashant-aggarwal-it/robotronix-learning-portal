# Phase 3D — Simple Mode and multi-purpose enquiry classification

Implemented on `feature/robotronix-connect-crm`, Development Supabase only.

## Delivered
- `database/connect/saas/20_simple_mode_enquiry_classification.sql`: tenant defaults (simple mode and nine categories), isolated category IDs, category-linked enquiries, audited tenant-scoped RPC with owner/admin settings permissions and staff classification permissions.
- `app/api/connect/workspaces/[tenantId]/enquiry-preferences/route.ts`: authenticated GET/PATCH.
- `components/connect/EnquirySettings.tsx`: Simple/Advanced toggle, add/rename/activate/deactivate categories.
- `app/connect/page.tsx`: Simple navigation by default (Overview, Enquiries, Contacts, Follow-ups, Settings); Advanced retains pipelines, calendar, communications, reports and advanced settings. Enquiry category filter, editable classification, category selection at capture and conservative keyword suggestions requiring human confirmation.
- `database/connect/saas/09_crm_commands.sql`: atomic category on manual capture; optional pipeline remains optional.
- `database/connect/saas/10_crm_queries.sql`: category ID and label in list results.
- `lib/connect-client.ts`: typed enquiry category fields.

## Validation
- Rollback-only SQL test passed for 9 defaults, Simple initial mode, Advanced/Simple toggle persistence, manual trainer capture without opportunity, unauthorized read/write isolation, provider intake without admissions deal, and deduplicated initial follow-up tasks.
- Re-ran Phase 2A workspace security, Phase 2B CRM, Phase 3A ingestion, Phase 3B automation and Phase 3C analytics SQL suites after intake-first changes; all passed.
- Re-ran Phase 2B CRM, Phase 3A ingestion and Phase 3B automation SQL suites; all passed.
- No main merge or production deployment.

## Known limitations
- Rule-based suggestions are intentionally conservative and require human confirmation; **not AI classification**.
- FIXED by migration 21: verified inbound messages now create enquiries only; no admissions opportunity is automatically created. Admissions must be deliberately created after qualification.
- FIXED by migration 23: new enquiries without admissions opportunities get one open follow-up task per contact, respecting institute automation settings, without duplicate tasks on repeated messages.
- Existing inbound provider webhook setup requires credentials and real signed HTTP tests.
- No confirmed Next.js build, TypeScript CI result or authenticated browser UAT. Treat feature as development-stage.
- Default Simple navigation hides advanced features but staff permissions remain enforced server-side.
- Categories are single-select per enquiry, while a person can have multiple separate enquiries; multi-tagging the same enquiry is not yet implemented.
- Enquiry inbox loads up to 100 recent enquiries; pagination remains outstanding.
