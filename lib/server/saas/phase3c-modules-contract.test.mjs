import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(path,"utf8");

test("CRM requires authenticated bearer and scopes membership actions to verified actor",()=>{
 const session=read("lib/server/connect-auth.ts");
 const member=read("app/api/connect/workspaces/[tenantId]/members/[memberId]/route.ts");
 assert.match(session,/admin\.auth\.getUser\(token\)/);
 assert.match(session,/user\.is_anonymous/);
 assert.match(member,/connectSession\(request\)/);
 assert.match(member,/p_actor_id:auth\.actorId/);
 assert.match(member,/p_tenant_id:tenantId/);
 assert.doesNotMatch(member,/p_actor_id:\s*body/);
});
test("Tasks preserve independent verified identity for private task operations",()=>{
 const auth=read("lib/server/tasks/auth.ts");
 const task=read("app/api/tasks/[id]/route.ts");
 const listing=read("app/api/tasks/route.ts");
 assert.match(auth,/db\.auth\.getUser\(token\)/);
 assert.match(auth,/task_account_get/);
 assert.match(auth,/taskAccount\?\.status==="suspended"/);
 assert.match(task,/p_actor_id:session\.userId/g);
 assert.match(listing,/p_actor_id:session\.userId/g);
});
test("CRM and Tasks remain independent of Academy tenant capability imports",()=>{
 for(const path of ["lib/server/connect-auth.ts","lib/server/tasks/auth.ts"]) {
  const s=read(path);
  assert.doesNotMatch(s,/requireAuthorizedTenantCapability/);
  assert.doesNotMatch(s,/saas_academy/);
 }
});
