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

## Additional audit and remediation — 14 November 2026
- Reviewed DEV PostgreSQL catalog: no SECURITY DEFINER function in `public`, `connect`, `saas` or `tasks` lacked an explicit `search_path` setting.
- Phase 3F hardened the remaining scheduled Netlify functions `system-log-retention.mjs` and `connect-history-drain.mts` with `netlifyJobOwned`. The history job retains its separate explicit feature switch. All five modified scheduler functions require a declared single scheduler owner before running side effects.
- The 15 anon/35 authenticated SECURITY DEFINER warnings are not all direct vulnerabilities; RLS helper functions and authenticated business functions require distinct usage and grants analysis before any revoke. No unsafe blanket changes made.
- Duplicate CRM message indexes identified: `connect_message_idempotency_idx` vs `idx_connect_msg_external_id`, and `connect_message_history_idx` vs `idx_connect_msg_recent`. No index dropped without query-plan/release proof.
- Phase 3F code CI at [43620897305](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43620897305) PASS; authenticated DEV E2E [43620897318](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43620897318) PASS. Latest scheduler source commit `562d86e3` workflows [43625449088](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625449088) and [43625449064](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43625449064) pending at report update.

## Additional DEV exposure and provider code review

- PostgreSQL catalog check returned **0 directly granted anonymous/non-RLS application tables**, for application schemas `public`, `connect`, `tasks`, `saas`.
- Catalog check returned **0 publicly readable privileged views lacking a security-invoker setting**, across those schemas.
- The existing Meta webhook route checks `x-hub-signature-256` against the configured Meta secret and uses provider event IDs to identify duplicates.
- The existing Razorpay webhook route verifies `x-razorpay-signature` before using the service-role database client and skips already processed webhook events.
- The existing Zoom webhook route validates the signed timestamp and signature with SHA-256 HMAC and constant-time comparison, and handles already processed events.
- These checks are **code review/static evidence only**: live provider credentials, message delivery, payment reconciliation and Zoom event redelivery were not exercised.

No schema or provider settings changed during this review. Existing advisor warnings still require operator and/or targeted business-rule remediation, and **production is not approved**.
