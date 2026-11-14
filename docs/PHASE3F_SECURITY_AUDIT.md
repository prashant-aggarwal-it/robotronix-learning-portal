# Phase 3F — DEV Security Audit

Date: 14 November 2026. Scope: DEV only (`uzzuquxeeqonxeqcuohh`). Production not examined or changed.

## Current advisor findings

Supabase security advisor: 147 RLS-enabled tables with no policy (INFO); 15 anonymous-executable SECURITY DEFINER functions (WARN); 35 authenticated-executable SECURITY DEFINER functions (WARN); leaked-password protection not enabled (WARN).

Function-grant inventory shows many anonymous-callable helpers are deliberate RLS predicates (e.g., `current_role`, `is_admin`, `can_read_student`). Many authenticated-callable procedures are Academy business RPCs (e.g., scheduling, cancellations, payments). They cannot be revoked in bulk without proving dependent RLS/application contracts. Every candidate requires call-site and policy inventory and targeted authenticated tests before permission changes.

Phase 3E SaaS CRM integration installer, access functions, and trainer-scoping RPCs are service-role only, based on prior DEV certification. Phase 3F makes no blanket role grant changes.

## Implemented remediation

- `netlify/functions/process-reminders.mjs`, `zoom-auto-reconcile.mts`, `zoom-retention.mts` now require `netlifyJobOwned("PORTAL_SCHEDULER_ENABLED")` in addition to Portal module capability. This prevents duplicate live job execution unless a configured operator explicitly assigns Netlify as scheduler owner.
- `lib/server/saas/phase3f-scheduler-ownership.test.mjs` checks explicit fail-closed gate and response.
- Source CI watches Netlify function changes on the Phase 3F branch.

## Outstanding security actions

- Review 15/35 legacy callable-definer functions individually against RLS policies and API consumers. Do not revoke RLS helpers purely to quiet advisors.
- Enable leaked-password protection via approved Supabase Auth settings where available.
- Review `auth_rls_initplan` warnings (29), `multiple_permissive_policies` (277), and analyze policy equivalence before rewriting RLS.
- Audit browser service-key exposure, OAuth/refresh/session behavior, live payment, WhatsApp and Zoom webhooks, and cross-tenant IDOR in a production-like environment.
- **Status: PARTIAL** until these are verified; no production certification granted.
