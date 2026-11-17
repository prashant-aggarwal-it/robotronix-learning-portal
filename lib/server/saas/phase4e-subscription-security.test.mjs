import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const phase4c=read("database/saas/65_phase4c_subscription_lifecycle.sql");
const phase4d=read("database/saas/68_phase4d_first_tenant_integration.sql");
const phase4e=read("database/saas/69_phase4e_subscription_bypass_hardening.sql");
const context=read("lib/server/saas/organization-context.ts");
const route=read("app/api/platform-admin/subscriptions/route.ts");
test("server tenant access always resolves verified membership and live module gate",()=>{
 assert.match(context,/getAuthorizedOrganizations\(bearer\)/);
 assert.match(context,/resolveAuthorizedOrganization\(organizations,organizationId\)/);
 assert.match(context,/saas_authorized_module_entitlements/);
 assert.match(context,/requireModuleAccess\(enabled,organization\)/);
});
test("subscription gate denies expiry and inactive status",()=>{
 assert.match(phase4c,/s\.status in \('trial','active'\)/i);
 assert.match(phase4c,/s\.ends_at>now\(\)/i);
 assert.match(phase4c,/o\.status='active'/i);
 assert.match(phase4c,/e\.enabled and public\.saas_subscription_access_v1/i);
});
test("workspace cards and public Academy branding respect subscriptions",()=>{
 assert.match(phase4d,/create or replace function public\.saas_my_workspaces/i);
 assert.match(phase4d,/create or replace function public\.saas_public_academy_brand/i);
 assert.ok((phase4d.match(/public\.saas_subscription_access_v1/g)||[]).length>=4);
});
test("mapped CRM and Academy family paths have subscription gate patches",()=>{
 for(const name of ["saas_crm_portal_access_v1","saas_crm_portal_install_v1","saas_my_academy_family"])
  assert.ok(phase4e.includes(name),name);
 assert.match(phase4e,/public\.saas_subscription_access_v1\(v_org\)/);
 assert.match(phase4e,/public\.saas_subscription_access_v1\(o\.id\)/);
});
test("subscription management is service-only with platform admin and module provisioning checks",()=>{
 assert.match(phase4c,/auth\.role\(\)<>'service_role'/);
 assert.match(phase4c,/saas\.platform_administrators/);
 assert.match(route,/requirePlatformAdmin/);
 const guard=read("database/saas/67_phase4c_toggle_guard_correction.sql");
 assert.match(guard,/saas\.require_module_workspace_v1/);
});
test("admin route never trusts an arbitrary caller-supplied actor",()=>{
 assert.match(route,/p_actor_id:userId/);
 assert.doesNotMatch(route,/p_actor_id:body\./);
});
test("Phase 4E does not change PROD or bypass auth",()=>{
 assert.doesNotMatch(phase4e,/\b(?:DROP TABLE|TRUNCATE|DELETE FROM auth\.users)\b/i);
 assert.doesNotMatch(phase4e,/grant execute .* to anon/i);
});

test("Phase 4D direct Academy CRUD RPC enforces subscription expiry",()=>{
 const guard=read("database/saas/71_phase4d_academy_subscription_rpc_guard.sql");
 assert.match(guard,/saas_academy_v1\(uuid,uuid,text,text,uuid,jsonb\)/);
 assert.match(guard,/saas_subscription_access_v1\(p_organization_id\)/);
 assert.match(guard,/ERRCODE=''42501''/);
 assert.match(guard,/Unexpected Academy RPC structure/);
 assert.doesNotMatch(guard,/grant execute\s+.*\s+to\s+anon/i);
});
