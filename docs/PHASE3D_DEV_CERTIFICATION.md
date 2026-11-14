# Robotronix Education Suite — Phase 3D DEV Engineering & Certification

**Date:** 2026-11-14
**Branch:** `feature/education-suite-phase3d`
**DEV Supabase:** `uzzuquxeeqonxeqcuohh`
**Certified Phase 3C starting HEAD:** `4fbb321169375c40e91dc1e9b5542e133f62b066`
**PROD/main/Netlify:** not accessed or changed

## Implemented integrations

1. **CRM ↔ Academy:** Existing connected demos, admission offer acceptance, one-time hashed parent onboarding invitations, consented guardian identity binding, Portal Admin enrollment activation, CRM Won reconciliation, duplicate-event prevention, cancellation, and disabled-integration behavior. Extended authenticated DEV testing through parent onboarding, active student/enrollment and Won stage.
2. **CRM ↔ Tasks:** Optional `createFollowupTask` checkbox in CRM acceptance UI. When `crmTasks` is enabled, service invokes idempotent `task_module_link` for CRM opportunity. It creates one private follow-up task; repeated requests reuse same task, and unavailable Tasks never fails the accepted admission. Mismatched admission request/payload is rejected before any task side effect. The existing CRM task synchronization now enforces `tasks.items.owner_user_id=tasks.module_links.owner_user_id`.
3. **Academy ↔ Tasks:** Existing class-to-task workflow tested for ownership, idempotence, and tenant isolation. New SaaS overlay requires `saas_academy_schedule_scope` on both link creation and historical linked-task listing, without modifying standalone Portal+Tasks package.
4. **CRM ↔ Academy demo trainer security:** New SaaS-specific service-role RPC scopes trainer roster and booking validation to CRM member + SaaS organization member + Academy entitlement + organization-linked trainer. Legacy CRM+Portal operators without mapped SaaS tenant retain only globally unowned active trainers.
5. **Organization context:** Verified existing two-organization switching and CRM/Tasks workspace visibility using authenticated DEV users; no unconditional dependency added to standalone core modules.
6. **Background jobs:** No new worker or cron schedule added; existing optional CRM/Portal jobs preserved. DEV has no `pg_cron` extension. External worker cadence, live Zoom and delivery require deployment-level verification.

## Canonical SQL and DEV-only changes

- `database/shared/integrations/02_tasks_crm.sql`: owner-matched CRM→Tasks sync source
- `database/saas/45_phase3d_crm_tasks_owner_sync_guard.sql`: additive optional CRM/Tasks migration; applied DEV as `phase3d_crm_tasks_owner_sync_guard`
- `database/saas/46_phase3d_schedule_task_scope.sql`: SaaS Academy/Tasks access overlay; applied DEV as `phase3d_saas_schedule_tasks_scope_overlay`
- `database/saas/47_phase3d_crm_portal_trainer_scope.sql`: SaaS CRM/Portal trainer roster RPC; applied DEV as `phase3d_saas_crm_portal_trainer_scope`
- `scripts/build-phase3d-upgrade.mjs`: independent additive packages for CRM+Tasks, SaaS Academy+Tasks and SaaS CRM+Portal trainer mapping
- `database/saas/dev_only/08_phase3d_crm_tasks_fixture.sql`: guarded synthetic CRM opportunities, verified guardian, Won stage, linked task/class fixture cleanup; **not included in production packages**.

## Automated DEV results — actual executed evidence

- Source certification, including TypeScript, security/auth, business suites, deployment profiles and SQL packaging: **PASS** on commit `7f949b87`, [run 43608734741](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43608734741).
- Authenticated DEV Academy/CRM/Tasks + Phase3D workflows: **PASS** on commit `e769a678`, [run 43608471784](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43608471784). Logs confirm **153 authenticated assertions**, plus **17 Phase3C regression assertions**. Includes parent onboarding, Academy active enrollment→CRM Won, once-only reconciliation, CRM and Academy private task links, cross-tenant denial, and disabled-module behavior.
- New SaaS CRM demo trainer scope and latest code commit `4721e4bf`: source CI [run 43609152275](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43609152275) and authenticated DEV [run 43609152246](https://github.com/prashant-aggarwal-it/robotronix-learning-portal/actions/runs/43609152246) **pending at last check**. These must pass before upgrading the certification decision.

## Outstanding release considerations

- The legacy `connect_portal_single_active_integration` database index enforces a single active global CRM→Portal installation, designed for the original shared Portal. Do not drop this until verified migration to fully tenant-scoped demo/Portal operations is complete. This limits simultaneous active CRM customers and is a genuine broader multi-tenant rollout constraint.
- Trainer-scoping RPC assumes SaaS overlay is installed; standalone CRM/Portal deployment compatibility must be tested separately before a product release.
- No live external Zoom scheduling, email/WhatsApp delivery, full background-worker recovery or production readiness is certified by DEV synthetic E2E.
- No production or main branch changes, no Netlify builds or deployments.

**Certification decision at last update: PARTIAL / pending the latest code SHA's passing CI and resolution of production rollout caveats.** Prior cross-module automation passes are verified evidence but are not a blanket live-production acceptance.
