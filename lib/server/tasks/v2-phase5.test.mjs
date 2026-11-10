import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Weekly Planner is canonical and reachable from the unified Tasks app",()=>{
 const page=source("../../../app/tasks/planner/page.tsx");
 assert.match(page,/TasksV2Planner/);
 assert.match(page,/planner\.css/);
 for(const path of ["../../../features/tasks/v2/TasksV2Dashboard.tsx",
  "../../../features/tasks/v2/TasksV2Board.tsx",
  "../../../features/tasks/v2/TasksV2Focus.tsx"]){
  assert.match(source(path),/href="\/tasks\/planner"/);
 }
 assert.match(source("../../../app/tasks/page.tsx"),/TasksV2Dashboard/);
});
test("Planner supports drag-to-day, Someday, batch changes and overdue recovery",()=>{
 const ui=source("../../../features/tasks/v2/TasksV2Planner.tsx");
 for(const pattern of [/onDragStart/,/onDragOver/,/onDrop/,/selectedIds/,
  /\/api\/tasks\/v2\/planner/,/Someday \/ Maybe/,/Overdue recovery/,
  /Replan old planned tasks/,/Math\.min\(recoveryOwned\.length,50\)/,
  /Weekly review/,/recurrence:"weekly"/]){
  assert.match(ui,pattern);
 }
});
test("Planner separates hard deadline from planned date including in Someday",()=>{
 const ui=source("../../../features/tasks/v2/TasksV2Planner.tsx");
 const migration=source("../../../database/tasks/20_v2_week_planner.sql");
 assert.match(ui,/const overdue=visible\.filter\(t=>/);
 assert.match(ui,/dateAt\(t\.due_at\)&&dateAt\(t\.due_at\)<today/);
 assert.match(ui,/const upcoming=visible\.filter\(t=>/);
 assert.match(migration,/scheduled_date=case when p_action='plan'/);
 assert.doesNotMatch(migration,/set\s+due_at=/i);
 assert.doesNotMatch(migration,/set\s+reminder_at=/i);
 assert.doesNotMatch(migration,/set\s+recurrence=/i);
});
test("Planner and optional Matrix RPCs use verified actor and enforce input constraints",()=>{
 for(const path of ["../../../app/api/tasks/v2/planner/route.ts",
  "../../../app/api/tasks/v2/items/[id]/matrix/route.ts"]){
  const api=source(path);
  assert.match(api,/taskSession\(request\)/);
  assert.match(api,/p_actor_id:session\.userId/);
  assert.match(api,/Array\.isArray|typeof data\.important/);
 }
 const plan=source("../../../database/tasks/20_v2_week_planner.sql");
 const matrix=source("../../../database/tasks/21_v2_priority_matrix.sql");
 assert.match(plan,/cardinality\(p_task_ids\)>50/);
 assert.match(plan,/i\.owner_user_id=p_actor_id/);
 assert.match(plan,/count\(distin/);
 assert.match(plan,/if updated_count<>expected_count/);
 assert.match(plan,/revoke all on function/);
 assert.match(matrix,/owner_user_id=p_actor_id/);
 assert.match(matrix,/important=p_important,urgent=p_urgent/);
 assert.match(matrix,/revoke all on function/);
});
test("Importance and urgency remain independent, not inferred from a due date",()=>{
 const ui=source("../../../features/tasks/v2/TasksV2Planner.tsx");
 assert.match(ui,/const quadrant=\(t:V2Task\)=>t\.important\?/);
 assert.match(ui,/important:index===0\|\|index===1/);
 assert.match(ui,/urgent:index===0\|\|index===2/);
 assert.match(ui,/not automatically make a task important/);
});
test("Shared drawer updates recurrence and reminders via original task pipeline",()=>{
 const drawer=source("../../../features/tasks/v2/TaskV2DetailDrawer.tsx");
 const api=source("../../../app/api/tasks/v2/items/[id]/detail/route.ts");
 const sql=source("../../../database/tasks/22_v2_recurrence_reminders.sql");
 for(const text of ["Reminder","Repeat","Daily","Weekly","Monthly"])assert.ok(drawer.includes(text));
 assert.match(drawer,/reminder_at:reminder\?/);
 assert.match(drawer,/recurrence,reminder_at/);
 assert.match(api,/"reminder_at","recurrence"/);
 assert.match(sql,/public\.task_update\(p_actor_id,p_task_id,legacy\)/);
 assert.match(sql,/- 'reminder_at' - 'recurrence'/);
});
test("Someday remains separate from Inbox and recurrence carries V2 context",()=>{
 const day=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 const plan=source("../../../database/tasks/20_v2_week_planner.sql");
 const recur=source("../../../database/tasks/24_v2_recurrence_context.sql");
 assert.match(day,/const inbox=active\.filter\(t=>!t\.someday/);
 assert.match(plan,/focus_date=case when p_action='someday' then null/);
 assert.match(plan,/focus_rank=case when p_action='someday' then null/);
 assert.match(recur,/new\.area_id:=coalesce/);
 assert.match(recur,/new\.project_id:=coalesce/);
 assert.match(recur,/new\.done_definition:=prior\.done_definition/);
 assert.match(recur,/new\.resume_note:=''/);
});
test("Phase 5 responsive UI stays isolated from Classic Tasks",()=>{
 const css=source("../../../app/tasks/v2/planner/planner.css");
 assert.match(css,/\.mt2-planner-days/);
 assert.match(css,/\.mt2-matrix-grid/);
 assert.match(css,/@media\(max-width:580px\)/);
 assert.doesNotMatch(css,/\.tw-shell/);
});
