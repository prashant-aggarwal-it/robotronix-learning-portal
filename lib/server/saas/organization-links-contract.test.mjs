import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync("app/api/platform/organization-links/route.ts","utf8");
test("tenant linkage discovery requires bearer authentication and membership-verified entitlements",()=>{
 assert.match(route,/readBearerToken\(request\.headers\.get\("authorization"\)\)/);
 assert.match(route,/getAuthorizedModuleEntitlements\(bearer,organizationId\)/);
 assert.match(route,/organization\.id/);
 assert.match(route,/crmRows\.length===1/);
 assert.match(route,/status:.*unmapped/);
 assert.match(route,/does not authorize access/);
});
test("tenant linkage endpoint never returns raw tenant or workspace identifiers",()=>{
 assert.doesNotMatch(route,/crm_tenant_id:crmRows/);
 assert.doesNotMatch(route,/workspace_id:taskRows/);
 assert.match(route,/Cache-Control.*no-store/);
});
