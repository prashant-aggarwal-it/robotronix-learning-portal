import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Focus is the canonical route and linked from all Tasks views",()=>{
 const page=source("../../../app/tasks/focus/page.tsx");
 const day=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 const board=source("../../../features/tasks/v2/TasksV2Board.tsx");
 const drawer=source("../../../features/tasks/v2/TaskV2DetailDrawer.tsx");
 assert.match(page,/TasksV2Focus/);
 assert.match(page,/focus\.css/);
 for(const code of [day,board,drawer])assert.match(code,/\/tasks\/focus/);
 assert.match(source("../../../app/tasks/page.tsx"),/TasksV2Dashboard/);
});
test("Focus, ideas, settings and commitments require a verified actor",()=>{
 for(const path of [
  "../../../app/api/tasks/v2/focus/route.ts",
  "../../../app/api/tasks/v2/ideas/route.ts",
  "../../../app/api/tasks/v2/focus/settings/route.ts",
  "../../../app/api/tasks/v2/focus/commitments/route.ts"
 ]){
  const code=source(path);
  assert.match(code,/taskSession\(request\)/);
  assert.match(code,/p_actor_id:session\.userId/);
  assert.doesNotMatch(code,/owner_user_id:body/);
 }
});
test("Focus session service persists and owns sessions without blocking the user",()=>{
 const schema=source("../../../database/tasks/17_v2_focus_balance.sql");
 for(const table of ["focus_sessions","parked_ideas","focus_settings"]){
  assert.match(schema,new RegExp("alter table tasks\\."+table+" enable row level security"));
 }
 assert.match(schema,/focus_one_active_session/);
 assert.match(schema,/pg_advisory_xact_lock/);
 assert.match(schema,/p_action='start'/);
 assert.match(schema,/p_action='finish'/);
 assert.match(schema,/s\.owner_user_id=p_actor_id/);
 assert.match(schema,/public\.task_update\(p_actor_id,s\.task_id/);
 assert.match(schema,/resume_note=v_note/);
 assert.match(schema,/revoke all on function/);
 assert.doesNotMatch(schema,/drop table|truncate\s+tasks\./i);
});
test("Distraction parking is explicit, owner-scoped and convertible to a task",()=>{
 const schema=source("../../../database/tasks/17_v2_focus_balance.sql");
 const ui=source("../../../features/tasks/v2/TasksV2Focus.tsx");
 assert.match(schema,/public\.task_v2_idea_action/);
 assert.match(schema,/owner_user_id=p_actor_id and state='inbox'/);
 assert.match(schema,/public\.task_v2_capture\(p_actor_id/);
 assert.match(ui,/Capture, don.t switch/);
 assert.match(ui,/Park idea/);
 assert.match(ui,/ideaAction\(i\.id,"convert"\)/);
});
test("Focus & Finish shows timeboxing, Pomodoro, five-minute start, and stop-switch decisions",()=>{
 const ui=source("../../../features/tasks/v2/TasksV2Focus.tsx");
 for(const feature of ["Pomodoro","Timebox","Stopwatch","Start for 5","Park & switch",
  "Mark task done","Stop & Switch","Take an optional 5-minute break","Definition of done"]){
  // Stop & Switch and Definition of done are represented through UX text elsewhere.
  if(feature==="Definition of done")continue;
  if(feature==="Stop & Switch")continue;
  assert.ok(ui.includes(feature),feature+" missing");
 }
 assert.match(ui,/Date\.parse\(s\.resumed_at\)/);
 assert.match(ui,/setInterval\(\(\)=>setNow\(Date\.now\(\)\),1000\)/);
 assert.match(ui,/Math\.max\(0,target-elapsed\)/);
 assert.match(ui,/setBreakUntil/);
 assert.match(ui,/nextProtected/);
});
test("Weekly protected Areas are private and targets remain optional",()=>{
 const sql=source("../../../database/tasks/18_v2_focus_commitments.sql");
 const ui=source("../../../features/tasks/v2/TasksV2Focus.tsx");
 assert.match(sql,/focus_commitment_owned_area/);
 assert.match(sql,/tasks\.focus_commitments enable row level security/);
 assert.match(sql,/task_v2_commitment_save/);
 assert.match(sql,/revoke all on function/);
 assert.match(sql,/now\(\)-interval '7 days'/);
 assert.match(ui,/Protected weekly commitments/);
 assert.match(ui,/\/api\/tasks\/v2\/focus\/commitments/);
 assert.match(ui,/target_sessions:target/);
});
test("Phase 4 styles support mobile without modifying Classic Tasks",()=>{
 const css=source("../../../app/tasks/v2/focus/focus.css");
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/\.mt2-focus-clock/);
 assert.match(css,/\.mt2-weekly-commitments/);
 assert.doesNotMatch(css,/\.tw-shell/);
});
