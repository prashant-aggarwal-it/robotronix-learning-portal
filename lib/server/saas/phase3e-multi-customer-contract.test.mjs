import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8");
test("Phase3E migration protects direct legacy bridge installation and allows mapped tenants",()=>{
 const install=read("database/saas/48_phase3e_multi_active_crm_portal.sql");
 const access=read("database/saas/49_phase3e_crm_portal_access_scope.sql");
 const guard=read("database/saas/50_phase3e_guard_legacy_portal_installs.sql");
 assert.match(install,/saas\.legacy_tenant_links/);
 assert.match(install,/saas\.module_entitlements/);
 assert.match(install,/pg_advisory_xact_lock/);
 assert.doesNotMatch(install,/DROP INDEX IF EXISTS connect\.connect_portal_single_active_integration;/);
 assert.match(guard,/CREATE TRIGGER guard_portal_install_tenant_v1/);
 assert.match(guard,/DROP INDEX IF EXISTS connect\.connect_portal_single_active_integration/);
 assert.match(access,/m\.status='active'/);
 assert.match(access,/v_installer/);
});
test("SaaS route is scoped and standalone legacy fallback requires absent SaaS context",()=>{
 const route=read("app/api/connect/workspaces/[tenantId]/portal-integration/route.ts");
 const gate=read("lib/server/connect-portal-access.ts");
 assert.match(route,/saas_crm_portal_install_v1/);
 assert.match(route,/saas_authorized_organizations/);
 assert.match(gate,/saas_crm_portal_access_v1/);
 assert.match(gate,/saas_authorized_organizations/);
});
test("Phase3E migration package excludes DEV-only QA fixtures",()=>{
 const builder=read("scripts/build-phase3e-upgrade.mjs");
 for(const id of ["48_phase3e","49_phase3e","50_phase3e"])assert.ok(builder.includes(id));
 assert.doesNotMatch(builder,/09_phase3e_three_customers/);
});
