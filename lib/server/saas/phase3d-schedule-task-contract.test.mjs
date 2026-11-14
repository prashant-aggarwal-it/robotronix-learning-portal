import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const sql=fs.readFileSync("database/saas/46_phase3d_schedule_task_scope.sql","utf8");
test("SaaS class links require canonical organization-scoped Academy authorization",()=>{
 assert.match(sql,/saas_academy_schedule_scope\(p_actor_id,p_resource_id\) IS FALSE/);
 assert.match(sql,/ERRCODE='42501'/);
});
test("Revoked organization access hides historical class Task links",()=>{
 assert.match(sql,/saas_academy_schedule_scope\(p_actor_id,l.resource_id\) IS DISTINCT FROM FALSE/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.task_module_link/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public.task_module_links_list/);
});
