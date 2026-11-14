import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
test("CRM demos use actor and mapped tenant trainer scope before displaying or booking",()=>{
 const route=fs.readFileSync("app/api/connect/workspaces/[tenantId]/portal-demos/route.ts","utf8");
 assert.match(route,/saas_crm_portal_trainers_v1/g);
 assert.match(route,/p_actor_id:access\.session\.actorId/);
 assert.match(route,/availableTrainers\|\|\[\]/);
 assert.doesNotMatch(route,/\.from\("trainers"\)\.select\("id"/);
});
test("SaaS trainer RPC intersects active CRM and SaaS membership with Academy entitlement",()=>{
 const sql=fs.readFileSync("database/saas/47_phase3d_crm_portal_trainer_scope.sql","utf8");
 for(const x of ["cm.status='active'","sm.status='active'","e.module_key='academy'","at.organization_id=org.id","tr.record_status='active'"])assert.ok(sql.includes(x),x);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saas_crm_portal_trainers_v1/);
});
