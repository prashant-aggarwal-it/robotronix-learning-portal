import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route=fs.readFileSync("app/api/platform/organizations/route.ts","utf8");
const context=fs.readFileSync("lib/server/saas/organization-context.ts","utf8");

test("organization switching requires a bearer-authenticated membership check",()=>{
 assert.match(route,/export async function POST\(/);
 assert.match(route,/getAuthorizedOrganizations\(bearerFrom\(request\)\)/);
 assert.match(route,/resolveAuthorizedOrganization\(organizations,organizationId\)/);
 assert.match(context,/if\(!match\)throw new SaaSAccessError\(403/);
});
test("active organization cookie is HttpOnly and never stores a bearer token",()=>{
 assert.match(route,/httpOnly:true/);
 assert.match(route,/sameSite:"strict"/);
 assert.match(route,/response\.cookies\.set\(cookieName,selected\.id/);
 assert.doesNotMatch(route,/response\.cookies\.set\(cookieName,\s*(?:token|bearer)/);
});
test("organization discovery always validates cookie and query selection",()=>{
 assert.match(route,/request\.cookies\.get\(cookieName\)/);
 assert.match(route,/resolveAuthorizedOrganization\(organizations,requested\)/);
 assert.match(route,/requiresSelection:organizations\.length>1/);
});
test("organization selection cannot be cached across identities",()=>{
 assert.match(route,/private, no-store/);
 assert.match(route,/Vary":"Authorization, Cookie"/);
});
test("organization selection requires valid JSON and UUID",()=>{
 assert.match(route,/application\/json/);
 assert.match(route,/uuid\.test\(organizationId\)/);
});
test("clearing selection does not remove membership",()=>{
 assert.match(route,/export async function DELETE\(/);
 assert.match(route,/getAuthorizedOrganizations\(bearerFrom\(request\)\)/);
 assert.match(route,/maxAge:0/);
});
