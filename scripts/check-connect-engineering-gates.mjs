import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
const branch=read(".github/workflows/connect-branch-validation.yml");
const integration=read(".github/workflows/integrated-e2e.yml");
const security=read("lib/server/connect-auth.ts");
const access=read("lib/server/connect-portal-access.ts");
const lifecycle=read("database/connect/saas/58_portal_lifecycle_renewals.sql");
const admissions=read("database/connect/saas/53_portal_admissions_rpc.sql");
const health=read("app/api/connect/jobs/reminders/route.ts");
const triggerGrants=read("database/04_existing_db_migrations/20261109_restrict_privileged_trigger_function_execute.sql");

// Fail when CI stops running the actual Connect feature contracts.
for(const name of ["check:connect-hardening","check:security","npm audit --omit=dev","connect-api-boundaries.spec.ts"])
 assert.ok(branch.includes(name),`Connect CI missing required gate: ${name}`);
assert.match(branch,/pull_request:/,"A PR must trigger quality gates");
assert.match(integration,/connect-dev-integration\.spec\.ts/,"Isolated authenticated CRM integration suite must be wired");
assert.match(integration,/QA_TARGET: dev/,"Authenticated QA must target Development");
assert.match(security,/admin\.auth\.getUser\(token\)/,"Bearer JWT must be validated against Supabase Auth");
assert.match(security,/user\.is_anonymous/,"Anonymous Supabase users must be rejected");
assert.doesNotMatch(access,/\.schema\(["']connect["']\)/,"Private Connect schema must not be exposed through Data API");
assert.match(lifecycle,/m\.user_id=p_actor_id and m\.tenant_id=p_tenant_id/,"Lifecycle RPC requires tenant membership");
assert.match(lifecycle,/v_role='viewer'/,"Viewer access must be restricted");
assert.match(lifecycle,/owner_membership_id=v_member/,"Counsellor access must be assigned-only");
assert.match(lifecycle,/coalesce\(l\.package_id,l\.enrollment_id\)/,"Renewal cycles must be bound to a package or enrollment");
assert.match(lifecycle,/payment_attention else null/,"Sensitive finance flag must be scoped");
assert.match(admissions,/v_h\.status='enrollment_confirmed'/,"Enrollment handoff must be idempotent");
assert.match(health,/timingSafeEqual/,"Scheduler bearer secret must be compared in constant time");
assert.match(health,/"Cache-Control":"no-store"/,"Job responses must not be cached");
for(const name of ["audit_core_change","protect_profile_privileges","notify_admin_on_onboarding_submission","lock_trainer_payout_instructions","trg_sync_trainer_earning"])
 assert.ok(triggerGrants.includes(`revoke execute on function public.${name}()`),`Trigger-only RPC grant reintroduced: ${name}`);
console.log("Connect engineering gates passed: workflow, authorization, privacy and scheduler contract checks.");
