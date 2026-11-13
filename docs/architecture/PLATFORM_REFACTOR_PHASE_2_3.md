# Phase 2.3 — Platform database refactoring preparation (no database changes)

## Baseline / scope
Source: DEV catalog (read-only) and current `feature/portal-canonical-db-package` repository.
Never install the discarded 70-table alternative. This document is **not** executable migration SQL.

## Verified current identity / access contracts
| Interface | Current source | Existing caller/guard | Migration invariant |
|---|---|---|---|
| Supabase identity | `auth.users.id` | `auth.getUser(token)` in CRM and Tasks server session wrappers | Never replace identity or trust client-provided actor IDs |
| Portal role | `public.profiles(id,role,active)` | `app/api/platform/my-products/route.ts`, auth routing, `public.current_role()`, `public.is_admin()` | All admin/trainer/parent/student access and disabled accounts remain equivalent |
| Trainer link | `public.trainers.profile_id` | Platform product switcher plus Portal flows | Disabled trainer access remains denied |
| Portal invitation / access | `public.portal_access_requests(target_type,target_id,status)` | Platform product switcher and Portal onboarding | Preserve invited/unlinked/disabled states |
| CRM organisation | `connect.tenants(id,status)` | `public.connect_my_workspaces(uuid)` | CRM must remain independently installable |
| CRM membership | `connect.memberships(tenant_id,user_id,role,status)` | CRM RPCs / `connectSession` | Enforce tenant ID and active membership on every tenant command |
| Tasks account | `tasks.accounts(user_id,status)` | `public.task_account_get(uuid)` and `taskSession` | Suspended account cannot gain access through Portal fallback |
| Tasks workspace | `tasks.workspaces`, `tasks.workspace_members` | Tasks RPCs / `tasks.can_read(uuid,uuid)` | Private tasks remain private; workspace membership required for shared tasks |
| Module flags | `PRODUCT_MODE`, `ENABLED_PRODUCTS`, `ENABLED_INTEGRATIONS` | `lib/platform/deployment.ts` | Deployment flags never become end-user authorisation |

## RLS findings from DEV (read-only)
- `public.profiles` exposes policies `profiles_insert_own`, `profiles_select`, `profiles_update`. Update and select rely on `is_admin()` or own `auth.uid()`.
- `public.portal_access_requests` has an admin-read policy relying on `is_admin()`.
- `public.current_role()` and `public.is_admin()` are SECURITY DEFINER; review owner, search_path, and grants before any change.
- CRM server handlers call service-role backed RPCs; checking actor membership inside the RPC is mandatory, since RLS does not automatically protect a service-role call.
- Existing `profiles.role` is global, not per organisation; this is a SaaS limitation, not a reason to rewrite existing permissions in one step.

## Proposed *additive* migration design (not yet installed)
1. Keep existing `auth.users`, `public.profiles`, `connect.memberships`, `tasks.accounts`, all current RPC signatures and all current RLS policies unchanged.
2. Introduce a separate `platform` namespace only after testing DDL in an isolated transaction on disposable infrastructure, with `platform.organizations`, `platform.organization_memberships` and product entitlements as additive structures. Naming and constraints require a complete cross-module permission-model review first.
3. Make a deterministic, auditable identity mapping from existing CRM tenants and Tasks workspaces to platform organisations **without assuming they are the same organisation**.
4. Implement organisation-scoped membership evaluation behind an internal server adapter; retain legacy `public.current_role`, `public.is_admin`, CRM workspace RPCs and Tasks account RPCs as compatibility interfaces.
5. Introduce feature-flagged read-only dual-reads, compare old/new decisions for each role and tenant, and audit differences before directing writes to new structures.
6. Replace no existing RLS predicate until both explicit positive and negative permission tests pass (cross-tenant, unauthenticated, parent/student, disabled trainer, suspended Tasks, CRM viewer).
7. Migrate dependent RPCs, triggers, jobs, and UI routes module-by-module. No destructive rename or `DROP` until exhaustive dependency mapping and end-to-end checks are complete.

## Acceptance gates
- `node scripts/check-platform-refactor-baseline.mjs`
- `node scripts/check-cross-module-refactor-contracts.mjs`
- `npm run check:modules`, `npm run check:auth`, `npm run check:backend-modules`, `npm run check:deployment-profiles`
- Real DEV authentication, RLS, CRM membership, Tasks privacy and Portal role E2E tests (not in the static CI job)
- DB isolation tests for each product installer plus combined installation matrix
- Finance, Zoom, WhatsApp and scheduler regression suites before any reset

## Outstanding blockers
- Repository-wide SQL/TypeScript RPC call graph and definitions of each critical SECURITY DEFINER function not yet exhaustively traced.
- No new Platform schema DDL has been executed or runtime-certified.
- CI source checks cannot demonstrate successful DB installation, RLS tenant isolation, or live OAuth.
- Do not run any DEV reset, production changes, or deploy before separate approval and acceptance gates.
