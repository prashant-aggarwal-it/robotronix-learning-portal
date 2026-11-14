import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const builder=fs.readFileSync("scripts/build-phase3d-upgrade.mjs","utf8");
test("Separate Phase 3D optional upgrade packages preserve standalone modules",()=>{
 assert.match(builder,/PHASE3D_CRM_TASKS_UPGRADE.sql/);
 assert.match(builder,/45_phase3d_crm_tasks_owner_sync_guard.sql/);
 assert.match(builder,/PHASE3D_SAAS_ACADEMY_TASKS_UPGRADE.sql/);
 assert.match(builder,/46_phase3d_schedule_task_scope.sql/);
 assert.doesNotMatch(builder,/dev_only\/08_phase3d/);
});
