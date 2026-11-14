import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
test("Portal access rechecks SaaS tenant and active installer",()=>{
 const file=fs.readFileSync("lib/server/connect-portal-access.ts","utf8");
 const sql=fs.readFileSync("database/saas/49_phase3e_crm_portal_access_scope.sql","utf8");
 assert.match(file,/saas_crm_portal_access_v1/);
 assert.match(file,/authorized!==true/);
 assert.match(sql,/v_installer/);
 assert.match(sql,/saas\.user_membership_history/);
 assert.match(sql,/ent\.module_key='academy'/);
 assert.match(sql,/m\.role_key IN \('owner','admin'\)/);
});
