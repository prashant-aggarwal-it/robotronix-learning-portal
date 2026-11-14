import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
test("CRM Academy integration requires both module entitlements in all authorization paths",()=>{
 const sql=fs.readFileSync("database/saas/51_phase3e_dual_module_entitlements.sql","utf8");
 assert.match(sql,/crm_e\.module_key='crm' AND crm_e\.enabled/g);
 assert.ok((sql.match(/crm_e\.module_key='crm'/g)||[]).length===3);
 assert.match(sql,/ent\.module_key='academy' AND ent\.enabled/g);
 assert.match(sql,/e\.module_key='academy' AND e\.enabled/);
});
