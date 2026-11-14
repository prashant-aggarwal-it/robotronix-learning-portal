import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const context=fs.readFileSync("lib/server/saas/organization-context.ts","utf8");
const modules=fs.readFileSync("app/api/platform/organization-modules/route.ts","utf8");
const organizations=fs.readFileSync("app/api/platform/organizations/route.ts","utf8");

test("organization and entitlement APIs use one strict bearer parser",()=>{
 assert.match(context,/export function readBearerToken\(/);
 assert.match(context,/match\(\/\^Bearer/);
 assert.match(modules,/readBearerToken\(request\.headers\.get\("authorization"\)\)/);
 assert.match(organizations,/readBearerToken\(request\.headers\.get\("authorization"\)\)/);
});
test("tenant module gate revalidates identity, membership and enabled entitlement",()=>{
 assert.match(context,/export async function requireAuthorizedTenantModule\(/);
 assert.match(context,/getAuthorizedOrganizations\(bearer\)/);
 assert.match(context,/resolveAuthorizedOrganization\(organizations,organizationId\)/);
 assert.match(context,/saas_authorized_module_entitlements/);
 assert.match(context,/row\.module_key===moduleKey&&row\.enabled===true/);
 assert.match(context,/requireModuleAccess\(enabled,organization\)/);
});
test("entitlement response cannot be cached across users",()=>{
 assert.match(modules,/private, no-store/);
 assert.match(modules,/Vary":"Authorization, Cookie"/);
});
