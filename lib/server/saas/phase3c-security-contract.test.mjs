import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=path=>fs.readFileSync(path,"utf8");
test("Academy service checks namespaced capability after tenant entitlement",()=>{
 const s=source("lib/server/saas/academy-service.ts");
 assert.match(s,/requireAuthorizedTenantCapability\(token,orgId,"academy",capability\)/);
 assert.match(s,/p_actor_id:userId/);
});
test("legacy finance service checks capability and tenant-specific finance scope",()=>{
 const s=source("lib/server/saas/legacy-finance-scope.ts");
 assert.match(s,/requireAuthorizedTenantCapability\(bearer,organizationId,"academy","academy.finance.manage"\)/);
 assert.match(s,/saas_academy_finance_scope/);
 assert.match(s,/saas_actor_ever_member/);
});
test("membership route validates JWT identity; SQL restricts service-only execution",()=>{
 const route=source("app/api/platform/organizations/[organizationId]/members/[membershipId]/route.ts");
 const sql=source("database/saas/38_phase3c_membership_management.sql");
 assert.match(route,/getAuthorizedOrganizations\(bearer\)/);
 assert.match(route,/p_actor_id:userId/);
 assert.match(route,/saas_manage_membership_v1/);
 assert.match(sql,/v_actor_role='admin'/);
 assert.match(sql,/v_old.role_key IN \('owner','admin'\)/);
 assert.match(sql,/p_role_key IS NULL OR p_status IS NULL/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.saas_manage_membership_v1.*FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/TO service_role/);
});
test("SaaS role-capability evaluation does not pretend to authorize CRM or Tasks",()=>{
 const s=source("lib/server/saas/role-capabilities.mjs");
 assert.match(s,/roleHasCapability/);
 assert.match(s,/\^\(academy\|saas\)/);
 assert.doesNotMatch(s,/"crm.contacts.manage"/);
});
