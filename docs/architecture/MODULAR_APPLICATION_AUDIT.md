# Phase 1 — Application architecture audit and module boundaries

**Date:** 2026-11-11  
**Source:** GitHub `main` (read-only inspection); documentation committed to `feature/modular-platform-architecture`.  
**Status:** Architecture audit; **not** an implementation, clean-install certification, or release approval.

## 1. Executive decision

Keep **one Git repository** and **one modular Next.js source tree**; build independently deployable Portal, Connect CRM and My Tasks products from shared packages. Do **not** split into three repositories, rebuild working features, or require Portal tables for CRM/Tasks. Combined deployment must enable explicitly authorised integrations; database project boundaries and identity mapping require an explicit decision before production.

**Current readiness**
- **SQL:** CRM core and Tasks core have separate canonical definitions, with optional integration SQL. Static guards exist, but no isolated full install/e2e certification.
- **Application:** Routes and feature components are partially modular; authentication, shared root UI, app switching, deployment packaging and module-level API guards are not yet independent.
- **Operations:** Nine Netlify workers catalogued in `config/scheduled-jobs.json`; CRM/Tasks feature flags exist. DEV also has two active pg_cron CRM jobs, so enabling equivalent Netlify workers there without cutover would overlap schedules.
- **Production:** Portal already contains live data and working schedules. Never reset or reinstall the Portal, merge this branch into main, or deploy without explicit approval.

## 2. Audited repository inventory

GitHub recursive tree inventory: **828 tracked files**, not truncated. File counts are inventory counts, not an assertion that every function's runtime behaviour has been exercised.

| Category | Paths | Count |
|---|---|---:|
| API route entrypoints | `app/api/**/route.ts` | **107** |
| CRM API entrypoints | `app/api/connect/**/route.ts` | **45** |
| Tasks API entrypoints | `app/api/tasks/**/route.ts` | **26** |
| Portal / shared API entrypoints | other `app/api/**/route.ts` | **36** |
| Page entrypoints | `app/**/page.tsx` | **112** |
| CRM page entrypoints | `app/connect/**/page.tsx` | **1** (large client workspace) |
| Tasks page entrypoints | `app/tasks/**/page.tsx` | **13** |
| Portal / shared pages | other `app/**/page.tsx` | **98** |
| Shared/Portal component files | `components/**/*.tsx` | **58** |
| CRM feature TS/TSX files | `features/connect/**` | **32** |
| Tasks feature TS/TSX files | `features/tasks/**` | **15** |
| Backend TS files | `lib/server/**/*.ts` | **24** |
| Netlify scheduled workers | `netlify/functions/` | **9** |

These counts include legacy/experimental routes and do not imply 107 supported customer APIs.

## 3. Dependency matrix (actual findings)

Legend: **CORE** = owned by product; **SHARED** = permitted platform dependency; **OPTIONAL** = only when selected integration is enabled; **BLOCKER** = must be eliminated or guarded; **QA** = not yet execution-tested.

| Area | Portal | Connect CRM | My Tasks | Evidence and decision |
|---|---|---|---|---|
| Supabase Auth | Shared auth in current combined installation | Uses `auth.getUser(token)` in `lib/server/connect-auth.ts` | Uses `auth.getUser(token)` in `lib/server/tasks/auth.ts` | **SHARED** identity adapter. For separate projects, token verification and identity translation must be scoped to each project. |
| Portal `public.profiles` | **CORE**; `lib/repository.ts` | `app/connect/page.tsx` imports `getCurrentProfile` for a Portal admin link | `lib/server/tasks/auth.ts`, `app/api/tasks/onboarding/route.ts` both query `profiles` | **BLOCKER** for Tasks-only; optional CRM Portal link must never require Portal schema. |
| Login and OAuth routing | `app/login/page.tsx`, `app/auth/callback/page.tsx` query Portal account access | Current shared login isn't CRM-package aware | Login callback checks Tasks account as fallback but uses Portal access first | **BLOCKER**: product/tenant-aware redirect with safe `next` allowlist, no blind Portal lookup. |
| Root metadata / fallback | `app/layout.tsx` and `app/page.tsx` explicitly Portal branded | `app/connect/layout.tsx` overrides some page metadata, not root shell | `app/tasks/layout.tsx` sets metadata, not standalone landing | **BLOCKER**: product shell/branding/error states must come from validated deployment config. |
| Application switcher | Used by Portal `components/AppShell.tsx` | Used by `features/connect/ConnectSidebar.tsx` | Used by Tasks V2 | `components/ApplicationSwitcher.tsx` always links to all three applications. **BLOCKER**: filter by installed, enabled and authorised modules. |
| CRM core UI/API | Not a requirement | `app/connect/page.tsx`; `features/connect/**`; `app/api/connect/**`; `lib/server/connect-auth.ts` | Not required | **CORE CRM**; preserve tenant-scoped membership authorization, inbox, contacts, campaigns and existing WhatsApp integrations. |
| Tasks core UI/API | Not a requirement | CRM native `connect.tasks` remains inside CRM | `app/tasks/**`, `features/tasks/**`, `app/api/tasks/**`, `lib/server/tasks/**` | **CORE Tasks**; preserve workspaces, collaboration, projects, planner, reminders, tasks V2. Do not treat CRM native tasks as standalone Tasks data. |
| CRM ↔ Portal demo/admissions | Portal scheduling/classes/enrollment | CRM `portal-demos`, `admissions`, `portal-integration`, `lifecycle` endpoints | Not required | **OPTIONAL**; `lib/server/connect-portal-access.ts` unconditionally invokes `connect_portal_demo_bridge` when these routes are called; hide and reject routes when integration absent. |
| Tasks ↔ CRM/Portal links | Optional Portal event links | Optional CRM entity/task links | `app/api/tasks/module-links/route.ts`; `features/tasks/v2/TasksV2Connected.tsx` | **OPTIONAL**; SQL integration files 03/05 provide mutually exclusive final link functions. In Tasks-only installs these RPCs are absent; hide the connected view and return a deliberate module-unavailable result. |
| Portal access check inside Tasks connected UI | Portal uses `getCurrentProfile` | Can reveal Portal link only by entitlement | `features/tasks/v2/TasksV2Connected.tsx` imports `getCurrentProfile` | **BLOCKER/OPTIONAL**: use a safe capability check, not Portal profile lookup on standalone Tasks. |
| Base DB SQL | `database/01_install/` | `database/canonical/03_*,05_*,07_*,09_*` | `database/canonical/02_*,04_*,06_*,08_*` | **CORE** definitions separated. Run on disposable, empty projects and compare expected database objects before rollout. |
| Integration SQL | N/A | `database/integrations/01_crm_portal.sql` | `02_tasks_crm.sql`, `03_tasks_crm_links.sql`, `04_tasks_portal_notifications.sql`, `05_full_suite_task_links.sql` | **OPTIONAL**; never run 03 and 05 together. |
| Background workers | 5 Portal jobs (reminders, Zoom x2, retention, alerts) | 2 CRM jobs (reminders, WhatsApp drain) | 1 task reminders job | 1 additional CRM+Portal job. `config/scheduled-jobs.json` owns all **9** jobs; guard enable flags and eliminate overlap with existing DEV pg_cron before activation. |
| Deployment config | `netlify.toml`, `next.config.ts`, `lib/config.ts` currently Portal-oriented | No standalone build preset | No standalone build preset | **BLOCKER**: validated product mode, public URL, branding, minimal required env, scheduler/job entitlement and route availability. |
| Source packaging | Single `package.json`/Next build | Feature folder isolated, but monolithic `app/connect/page.tsx` | Feature folder isolated | **PARTIAL**; retain folder structure initially. Split only actual shared logic / integration adapters; do not reorganise all Portal files. |

### Critical source references

1. `lib/server/tasks/auth.ts`: validates user, then queries `db.from("profiles").select("active")` and fetches `task_account_get`. **Tasks-only database cannot safely rely on this call.**
2. `app/api/tasks/onboarding/route.ts`: GET fetches `task_account_get` **and** Portal `profiles`, failing if either reports an error.
3. `lib/repository.ts` exposes `getCurrentProfile` and `getCurrentAccountAccess`; those are Portal features, not shared platform identity adapters.
4. `app/login/page.tsx` and `app/auth/callback/page.tsx`: shared login checks Portal access before Tasks fallback; a CRM-only sign-in path is not explicitly routed.
5. `app/connect/page.tsx`: references `getCurrentProfile` to compute `canOpenPortal` for app switching.
6. `features/tasks/v2/TasksV2Connected.tsx`: references Portal `getCurrentProfile` and optional integration views.
7. `components/ApplicationSwitcher.tsx`: statically renders Portal, CRM, Tasks links regardless of deployment selection or entitlements.
8. `lib/server/connect-portal-access.ts`: uses `connect_portal_demo_bridge`, which is in optional CRM+Portal SQL; callers must be gated before invoking on CRM-only.
9. `app/api/tasks/module-links/route.ts`: uses optional `task_module_link` / `task_module_links_list` RPCs; core Tasks-only SQL does not install these.
10. `app/layout.tsx`, `app/page.tsx`: Portal-specific root metadata, home and production error screen.
11. `lib/config.ts`: `appMode` distinguishes only `live` vs `demo` (database configuration), **not** product package selection; do not overload it silently.
12. `features/connect/ConnectAuthGates.tsx`: sign-in messaging describes shared Robotronix Portal authentication; standalone CRM wording and redirect need changes.

## 4. Package boundary rules (non-negotiable)

- **Portal** owns students, trainers, classes, cohorts, attendance, Zoom, invoices, Portal notifications and Portal account profiles.
- **CRM** owns tenants/memberships, people, enquiries, pipelines, CRM-native `connect.tasks`, campaigns, channels, messages, WhatsApp and email.
- **Tasks** owns `tasks.*` task accounts, projects, personal/team tasks, planners, reminders, workspaces and collaboration.
- **Shared platform** may own validation, browser/server Supabase client creation, identity verification and presentation primitives. It must **not** read any Portal/CRM/Tasks business table by default.
- **Integrations** own business synchronization, Portal demo/admission handoffs, task links, optional notification fan-out and product-to-product mapping. Missing integration must never break a core feature.
- Do not use feature hiding as security: every API and background worker must independently check available modules and caller entitlements; every RPC must enforce tenant/user membership.
- Different Supabase projects do **not** share tokens, Auth user IDs or database transactions automatically. Combined independent-project products need authenticated service contracts, ID mapping, idempotency and failure handling. A single shared project is simpler for the first combined release, but that must be an explicit deployment choice.

## 5. Minimal target source layout

Preserve the Next.js App Router routes and existing feature folders wherever possible:

```text
app/
  (existing Portal routes: admin, parent, trainer, student, ...)
  connect/                       # CRM product UI + its layout
  tasks/                         # Tasks product UI + its layout
  api/
    connect/                     # CRM core API
    tasks/                       # Tasks core API
    ...                          # Portal core API
features/
  connect/                       # CRM pages, components, state
  tasks/                         # Tasks pages, components, state
components/
  ...                            # Shared UI only; application switcher becomes entitlement-aware
lib/
  platform/
    deployment.ts                # validate enabled products and installed integrations
    auth.ts                      # shared token/user helpers without business-table reads
    entitlements.ts              # product access contracts
  server/
    connect-*.ts                 # CRM-owned backend
    tasks/                       # Tasks-owned backend
    portal-*.ts                  # Portal-owned backend
  integrations/
    crm-portal/
    crm-tasks/
    portal-tasks/
config/
  scheduled-jobs.json            # already exists
  product-packages.json          # proposed customer combinations and capabilities
database/
  canonical/                     # already exists
  integrations/                  # already exists
  packages.json                  # already exists
netlify/functions/               # already exists, opt-in module workers
scripts/
  check-module-boundaries.mjs    # proposed import/route/static dependency guard
  check-scheduled-jobs.mjs       # already exists
docs/architecture/
  MODULAR_APPLICATION_AUDIT.md  # this audit
```

Do **not** move `features/connect`, `features/tasks`, all Portal files, or split `package.json` merely for aesthetics. Prefer extracting targeted integration adapters and introducing deploy-time guards before considering physical build output pruning.

## 6. Prioritised detailed change list

| ID | Priority | Phase | Concrete implementation | Acceptance criterion |
|---|---|---|---|---|
| M01 | P0 | 2 — Mode contract | Add typed `PRODUCT_MODE=portal|crm|tasks|combined` plus a validated list of enabled products/integrations. Avoid naming collision with existing `appMode=live|demo`. | Invalid mode fails deploy validation; Portal mode retains unchanged behavior. |
| M02 | P0 | 2 — Capabilities | Define backend-authoritative `portal,crm,tasks,crmPortal,crmTasks,portalTasks` availability and tenant entitlements. Frontend only consumes safe public subset. | CRM-only/Tasks-only deployments do not access unavailable module endpoints; server rejects inaccessible routes. |
| M03 | P0 | 3 — Tasks auth | Remove unconditional Portal `profiles` query in `lib/server/tasks/auth.ts`; use `tasks.accounts`, verified Auth user and optional Portal policy adapter. | Tasks-only GET/POST with missing `public.profiles` succeeds for eligible user; disabled accounts are denied. |
| M04 | P0 | 3 — Tasks onboarding | Remove mandatory Portal table fetch in `app/api/tasks/onboarding/route.ts`; use Tasks account state. | First-time Tasks-only signup/onboarding works on clean Tasks DB. |
| M05 | P0 | 3 — Login/callback | Product-aware secure login, OAuth callback and post-login route resolution; preserve Portal's existing disabled-account policies. | New users in CRM-only, Tasks-only and combined deployments route to correct product; no open redirect. |
| M06 | P0 | 4 — Integrations | Gate `lib/server/connect-portal-access.ts` and all CRM Portal routes before calling optional RPCs. | CRM-only APIs never require Portal bridge functions, return explicit capability error where integration is absent. |
| M07 | P0 | 4 — Tasks links | Gate optional module-link RPCs and cross-product Tasks connected view. | Tasks-only core routes continue; disabled integration is inaccessible and does not cause 500s. |
| M08 | P0 | 4 — Enforcement | Add server-side product/tenant authorization at API boundaries, not only UI visibility; keep service-role secrets server-only. | Unsubscribed roles cannot call hidden APIs; cross-tenant and module-isolation tests pass. |
| M09 | P1 | 5 — Shell/branding | Product-aware landing/home, root metadata, auth copy, error states and links. | CRM-only deploy never advertises Portal/Tasks as installed. |
| M10 | P1 | 5 — Navigation | Replace unconditional `ApplicationSwitcher` links with entitled/available choices. Adapt `AppShell`, `ConnectSidebar`, Tasks dashboards. | Combined shows permitted products; standalone shows only purchased product. |
| M11 | P1 | 5 — CRM cleanup | Replace Portal `getCurrentProfile` in `app/connect/page.tsx` with an optional Portal capability check. | CRM-only dashboard works without Portal public tables. |
| M12 | P1 | 6 — Integration contracts | Explicit services for CRM↔Portal, CRM↔Tasks, Portal↔Tasks. Define identity/tenant mapping and idempotent writes. | No CRM core imports Portal business services; integrations fail closed when disabled. |
| M13 | P1 | 6 — Scheduled jobs | Validate opt-in flags, product schema present, job health and overlap with existing DEV pg_cron. | Exactly one scheduler executes each RPC in each deployment; no Portal telemetry assumption for standalone apps. |
| M14 | P1 | 7 — Deployment | Add production-safe per-product environment templates/build configuration (reuse one repo, distinct Netlify sites if desired). | Independent builds, secrets, OAuth callback URLs and CSP work per product. |
| M15 | P1 | 7 — Boundary CI | Add static import / route / worker boundaries test and matrix of product modes. | PR cannot add unguarded core-to-core dependency. |
| M16 | P0 before PROD | 8 — QA | Run clean SQL install for Tasks-only, CRM-only, combined variants; authenticated API and browser journeys; permission + background tests; Portal regression tests. | All combinations pass; no live Portal data/cron affected. |
| M17 | P0 before PROD | 8 — Release | Capture verified backup, deployment/cutover plan, compare DEV→PROD schema and secure env, obtain explicit approval. | Rollback documented and practiced in QA; production changes explicitly authorised. |

**Implementation order:** M01 → M02 → M03–M05 → M06–M08 → M09–M11 → M12–M13 → M14–M15 → M16–M17. Avoid UI-only hiding before backend enforcement. Do not enable untested production module jobs.

## 7. Test matrix and release gates

| Target deployment | Database core | Product journeys | Optional interfaces |
|---|---|---|---|
| Portal only | Existing Portal only | Admin/trainer/parent/student, finance, Zoom, reminders | No CRM/Tasks lookups |
| CRM only | Connect only | Sign-in, workspace, contacts, enquiry pipeline, communication, reminders | No Portal `profiles` or demo bridge; no Tasks SQL |
| Tasks only | Tasks only | Signup, personal/team tasks, planner, reminders, collaboration | No Portal `profiles`; no CRM link RPC |
| CRM + Tasks | Both cores | Both products | Sync + CRM-only module links |
| Portal + CRM | Portal + CRM | Portal regression + CRM workflows | Admissions/demos/lifecycle bridge |
| Portal + Tasks | Portal + Tasks | Portal regression + Tasks | Optional Portal notification fan-out |
| Complete suite | All cores | Full regression | Full-suite task links (not CRM-only task-link variant) |

For each target: smoke login/callback, claim identity & workspace, protected server API, RLS/tenant authorization, isolated schema dependency, configured jobs, correct landing/branding, graceful absence of other modules, secrets and redirects. **A static typecheck is not end-to-end certification.**

## 8. Known limitations of this audit

- Source inventory covers all tracked paths, while semantic inspection concentrated on high-risk application entrypoints and architecture/configuration files. It is **not** a fully computed transitive import graph or exhaustive runtime test of every API route.
- SQL isolation assertions are based on current canonical installers and their static checks. They have **not** been executed in all seven combinations against independent clean environments.
- Netlify deployed variables/active job health and customer subscription plumbing are not certified by source inspection.
- Module entitlements, cross-project identity and billing policies must be defined before standalone commercial rollout.

**Phase 1 acceptance:** audited inventory, dependency matrix, ownership rules, minimally disruptive target folder structure and prioritised change list. No application or production modifications.
