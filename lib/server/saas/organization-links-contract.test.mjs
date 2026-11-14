import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync("app/api/platform/organization-links/route.ts","utf8");
const sql=fs.readFileSync("database/saas/12_module_links_rpc.sql","utf8");
test("SaaS organization and entitlements are verified before link resolution",()=>{
 assert.match(route,/readBearerToken\(request\.headers\.get\("authorization"\)\)/);
 assert.match(route,/getAuthorizedModuleEntitlements\(bearer,organizationId\)/);
 assert.match(route,/getAuthorizedOrganizations\(bearer\)/);
 assert.match(route,/saas_resolve_module_links/);
});
test("service-only module resolver independently verifies CRM and Tasks access",()=>{
 assert.match(sql,/saas\.memberships/);
 assert.match(sql,/saas\.module_entitlements/);
 assert.match(sql,/connect\.memberships/);
 assert.match(sql,/tasks\.workspace_members/);
 assert.match(sql,/w\.archived_at IS NULL/);
 assert.match(sql,/REVOKE ALL ON FUNCTION.*PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION.*service_role/);
});
test("link resolver fails closed and never grants client table access",()=>{
 assert.match(route,/SaaSAccessError\(503/);
 assert.match(route,/Cache-Control.*no-store/);
 assert.doesNotMatch(route,/service_role.*NEXT_PUBLIC_/);
});
