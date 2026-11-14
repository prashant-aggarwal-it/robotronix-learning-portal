import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const code=fs.readFileSync("app/api/connect/workspaces/[tenantId]/admissions/route.ts","utf8");
test("Admission follow-up is opt-in and requires installed CRM Tasks integration",()=>{
 assert.match(code,/body\.createFollowupTask===true/);
 assert.match(code,/checkServerCapability\("crmTasks"\)/);
 assert.match(code,/p_resource:"crm_opportunity"/);
 assert.match(code,/p_actor_id:access\.session\.actorId/);
 assert.match(code,/p_tenant_id:tenantId/);
});
test("Optional Tasks error does not fail the already accepted admission",()=>{
 assert.match(code,/followUpTask=\{status:"unavailable"\}/);
 assert.match(code,/catch\{followUpTask=\{status:"unavailable"\}\}/);
 assert.match(code,/existing:true,inviteUrl:null/);
});
