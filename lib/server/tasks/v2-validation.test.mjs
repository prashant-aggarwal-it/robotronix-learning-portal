import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateV2} from "./v2-validation.ts";

test("area name is optional when updating but required when creating",()=>{
 assert.equal(validateV2("area",{name:"Robotronix",color:"blue"}).value?.name,"Robotronix");
 assert.match(validateV2("area",{color:"blue"}).error||"",/required/i);
 assert.equal(validateV2("area",{id:"b4ad0057-b474-4c45-b134-1c46fa3fd64c",color:"green"}).error,undefined);
});
test("rejects arbitrary server-side owner IDs and unknown task fields",()=>{
 assert.match(validateV2("task",{owner_user_id:"foo"}).error||"",/Unsupported/);
 assert.match(validateV2("project",{workspace_id:"foo"}).error||"",/Unsupported/);
 assert.match(validateV2("task",{}).error||"",/empty/i);
});
test("validates estimates, board positions, waiting state and safe dates",()=>{
 assert.equal(validateV2("task",{important:true,estimated_minutes:30,board_rank:2.5,status:"waiting"}).error,undefined);
 assert.match(validateV2("task",{status:"done"}).error||"",/Invalid status/);
 assert.match(validateV2("task",{estimated_minutes:-4}).error||"",/Estimate/);
 assert.match(validateV2("task",{followup_date:"2026-02-31"}).error||"",/Invalid/);
 assert.equal(validateV2("project",{name:"New batch",target_date:"2026-11-17",status:"active"}).error,undefined);
});
test("V2 API uses verified session and server-selected actor ID",()=>{
 for(const path of ["../../../app/api/tasks/v2/areas/route.ts","../../../app/api/tasks/v2/projects/route.ts","../../../app/api/tasks/v2/items/[id]/route.ts"]){
  const src=readFileSync(new URL(path,import.meta.url),"utf8");
  assert.match(src,/taskSession\(request\)/);
  assert.match(src,/p_actor_id:session\.userId/);
  assert.doesNotMatch(src,/service_role/i);
 }
});
test("migration retains existing task data and adds RLS to private areas and projects",()=>{
 const sql=readFileSync(new URL("../../../database/tasks/10_v2_foundation.sql",import.meta.url),"utf8");
 assert.match(sql,/alter table tasks\.areas enable row level security/);
 assert.match(sql,/alter table tasks\.projects enable row level security/);
 assert.match(sql,/revoke all on tasks\.areas, tasks\.projects from public,anon,authenticated/);
 assert.doesNotMatch(sql,/truncate\s+tasks\./i);
 assert.doesNotMatch(sql,/delete\s+from\s+tasks\.items/i);
});
