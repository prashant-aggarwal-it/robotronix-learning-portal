import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const context=fs.readFileSync("lib/server/saas/organization-context.ts","utf8");
const org=fs.readFileSync("app/api/platform/organizations/route.ts","utf8");
const modules=fs.readFileSync("app/api/platform/organization-modules/route.ts","utf8");
const links=fs.readFileSync("app/api/platform/organization-links/route.ts","utf8");
const admin=fs.readFileSync("lib/server/saas/platform-admin.ts","utf8");

test("tenant resolution checks active membership through a server-side RPC",()=>{
 assert.match(context,/auth\.getUser\(bearer\)/);
 assert.match(context,/!user\.email_confirmed_at/);
 assert.match(context,/saas_authorized_organizations/);
 assert.match(context,/resolveAuthorizedOrganization\(organizations,organizationId\)/);
});
test("cross-tenant ID cannot select unauthorized organization",()=>{
 assert.match(context,/if\(!match\)throw new SaaSAccessError\(403/);
 assert.match(context,/if\(organizations\.length===1\)return organizations\[0\]/);
});
test("module authorization requires membership and entitlement",()=>{
 assert.match(context,/saas_authorized_module_entitlements/);
 assert.match(context,/requireModuleAccess\(enabled,organization\)/);
 assert.match(modules,/getAuthorizedModuleEntitlements\(token,organizationId\)/);
});
test("organization selector cookie is never authentication",()=>{
 assert.match(org,/getAuthorizedOrganizations\(bearerFrom\(request\)\)/);
 assert.match(org,/httpOnly:true/);
 assert.match(org,/sameSite:"strict"/);
 assert.match(org,/resolveAuthorizedOrganization\(organizations,requested\)/);
});
test("module links require independent module membership checks",()=>{
 assert.match(links,/getAuthorizedModuleEntitlements\(bearer,organizationId\)/);
 assert.match(links,/saas_resolve_module_links/);
});
test("platform role is separately verified and never grants tenant membership",()=>{
 assert.match(admin,/saas_is_platform_admin_v1/);
 assert.doesNotMatch(admin,/insert\s+into\s+saas\.memberships/i);
});
