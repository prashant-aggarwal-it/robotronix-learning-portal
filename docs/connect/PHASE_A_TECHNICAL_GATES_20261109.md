# Phase A technical gates — Development verification (2026-11-09)

Status: **partially cleared; not a live integration release gate**.

## Scope and environment

- Workstream: Connect CRM ↔ Learning Portal architecture, Phase A.
- Supabase Development project: `fflejkqcspivnhsmkdtn`.
- Production project and `main` branch: **not changed**.
- Operator confirmed there is no real production data and authorised schema recreation if useful. This audit did not require dropping data.
- Existing Portal demo, trainer, learner, Zoom, onboarding, and finance workflows must remain compatible.

## Gate 1: migration ledger and schema parity

- Existing Development ledger baseline: 51 migrations, latest original `connect_calendar_management_fields`.
- Recorded seven previously untracked contact-management scripts from `database/connect/saas/40_...sql` through `46_...sql` as new Development migrations. They were already represented in the working schema; reconciliation was non-destructive.
- `47_contact_import_profile_sync.sql` is **not recorded**: Supabase migration confirmation expired. The corresponding `connect.contact_import_enrich_profile` trigger was queried and found **enabled** in Development, so the working behavior exists; ledger completeness is still blocked.
- The Development and Production schemas intentionally differ: CRM `connect` schema exists in Development, not Production. No rollout is authorised by this phase.
- Required closure: apply/record script 47 with a fresh explicit approval; then verify migration ledger consistency and fresh-install replay in a disposable database.

## Gate 2: privileged database function review

- Applied and recorded `database/04_existing_db_migrations/20261109_restrict_portal_trainer_rpc_public_grants.sql` in Development.
- `public.review_trainer_finance_request(uuid,text,text)` and `public.update_own_trainer_profile(text,text,text,text,text,text[])` now deny `anon` EXECUTE and preserve `authenticated` and `service_role` permissions. Read-only SQL checks verified this.
- Supabase security advisor still reports: 88 `rls_enabled_no_policy` (60 intentionally backend-only `connect` tables plus 28 public tables pending classification), 9 mutable search-path warnings, 1 extension in public, 37 anonymous SECURITY DEFINER executable warnings, 57 authenticated SECURITY DEFINER executable warnings, and leaked-password protection disabled. Advisor warnings are **not evidence that all these functions are exploitable**; continue per-function permission/authorization review.
- Required closure: explicit classification and hardening of remaining exposed functions and public-table policy decisions, then rerun advisors and role-specific negative authorization tests.

## Gate 3: regression evidence

Passed locally on feature branch:

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `node scripts/check-connect-portal-contract.mjs` | PASS (design contracts, not live HTTP integration) |
| `npm run check:demo-experience` | PASS (source structure) |
| `npm run check:security` | PASS (source structure; not penetration test) |
| `npm run check:zoom-classroom` | PASS (source structure) |

Not yet established: authenticated end-to-end demo booking, Connect-to-Portal handoff, cancellation/rescheduling, tenant isolation, trainer/parent/learner role negative cases, Zoom end-to-end authorization, production-like fresh schema replay. No local `.env.local` or live QA credentials were configured for these runs. **Phase B integration itself has not been implemented**.

## Decision

Phase A architecture/contracts are useful inputs for Phase B, but the technical gate is **AMBER** until the migration confirmation, security classification, and live QA items above are closed. This document is an evidence log, not a claim of completed production readiness.

Advisor remediation references: [RLS/no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [mutable search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [SECURITY DEFINER exposure](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
