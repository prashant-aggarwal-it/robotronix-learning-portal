import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const service=fs.readFileSync("lib/server/saas/academy-service.ts","utf8");
const sql=fs.readFileSync("database/saas/10_academy_tenant_api.sql","utf8");
const collection=fs.readFileSync("app/api/platform/academy/[kind]/route.ts","utf8");
const individual=fs.readFileSync("app/api/platform/academy/[kind]/[id]/route.ts","utf8");
const page=fs.readFileSync("app/saas/academy/page.tsx","utf8");
test("HTTP request user ID is derived from validated bearer only",()=>{
 assert.match(service,/readBearerToken\(request\.headers\.get\("authorization"\)\)/);
 assert.match(service,/await requireAuthorizedTenantCapability\(token,orgId,"academy",capability\)/);
 assert.match(service,/const capability=kind==="students"/);
 assert.match(service,/p_actor_id:userId/);
 assert.doesNotMatch(service,/p_actor_id:\s*(?:payload|request|orgId)/);
});
test("database always validates membership, entitlement and ownership",()=>{
 assert.match(sql,/JOIN saas\.organizations o ON o\.id=m\.organization_id/);
 assert.match(sql,/m\.user_id=p_actor_id/);
 assert.match(sql,/m\.status='active' AND o\.status='active'/);
 assert.match(sql,/e\.enabled/);
 assert.match(sql,/saas\.enrollment_parties_match/);
 assert.match(sql,/v_owner IS DISTINCT FROM p_organization_id/g);
});
test("privileged SQL is not directly callable by browser credentials",()=>{
 assert.match(sql,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_academy_v1.*FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.saas_academy_v1.*TO service_role/);
});
test("HTTP surface limits kinds, methods, and tenant data",()=>{
 assert.match(service,/\["students","courses","trainers","enrollments"\]/);
 assert.match(collection,/export async function GET\(/);
 assert.match(collection,/export async function POST\(/);
 assert.match(individual,/export async function GET\(/);
 assert.match(individual,/export async function PATCH\(/);
 assert.match(service,/private, no-store/);
 assert.match(service,/if\(error\.code==="42501"\)return invalid\("Resource not accessible",403\)/);
});
test("UI switches only through server verified selection",()=>{
 assert.match(page,/await call\("\/api\/platform\/organizations"/);
 assert.match(page,/setRows\(empty\)/);
 assert.match(page,/setSelected\(id\)/);
 assert.match(page,/\/api\/platform\/academy\//);
});
