import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync("app/api/platform/organization-links/route.ts","utf8");
test("SaaS org membership and module entitlements are verified",()=>{
 assert.match(route,/readBearerToken\(request\.headers\.get\("authorization"\)\)/);
 assert.match(route,/getAuthorizedModuleEntitlements\(bearer,organizationId\)/);
 assert.match(route,/getAuthorizedOrganizations\(bearer\)/);
 assert.match(route,/organization\.id/);
});
test("CRM and Tasks link requires independent module membership",()=>{
 assert.match(route,/connect_my_workspaces/);
 assert.match(route,/workspace_members/);
 assert.match(route,/\.eq\("user_id",userId\)/);
 assert.match(route,/permittedCrm/);
 assert.match(route,/allowedTasks/);
 assert.match(route,/access_denied/);
 assert.match(route,/unmapped/);
});
test("route handles unavailable ownership services safely",()=>{
 assert.match(route,/SaaSAccessError\(503/);
 assert.match(route,/Cache-Control.*no-store/);
 assert.match(route,/getAuthorizedModuleEntitlements/);
});
