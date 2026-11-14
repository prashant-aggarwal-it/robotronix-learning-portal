import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=x=>fs.readFileSync(x,"utf8");
test("Private SaaS rosters use server-verified service RPC rather than exposed schema",()=>{
 const members=read("app/api/platform/organizations/[organizationId]/members/route.ts");
 const invitations=read("app/api/platform/organizations/[organizationId]/invitations/route.ts");
 assert.match(members,/saas_list_members_v1/);
 assert.match(invitations,/saas_list_invitations_v1/);
 assert.doesNotMatch(members,/\.schema\("saas"\)/);
 assert.doesNotMatch(invitations,/\.schema\("saas"\)/);
});
test("Private roster RPCs require active organization administrator and service role",()=>{
 const sql=read("database/saas/43_phase3c_private_schema_list_rpcs.sql");
 assert.match(sql,/m\.status='active' AND m\.role_key IN \('owner','admin'\)/g);
 assert.match(sql,/o\.status='active'/g);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_list_members_v1/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_list_invitations_v1/);
 assert.match(sql,/TO service_role/g);
});
