import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("My Tasks opens the new dashboard without Classic UI",()=>{
 const page=source("../../../app/tasks/page.tsx");
 const layout=source("../../../app/tasks/layout.tsx");
 const redirect=source("../../../app/tasks/v2/page.tsx");
 assert.match(page,/TasksV2Dashboard/);
 assert.match(layout,/v2\/v2\.css/);
 assert.match(layout,/collaboration\.css/);
 assert.match(redirect,/redirect\("\/tasks"\)/);
});
test("Quick capture authenticates, validates and uses the atomic database RPC",()=>{
 const route=source("../../../app/api/tasks/v2/capture/route.ts");
 const migration=source("../../../database/tasks/11_v2_capture.sql");
 assert.match(route,/taskSession\(request\)/);
 assert.match(route,/p_actor_id:session.userId/);
 assert.match(route,/validateTask\(base\)/);
 assert.match(route,/validateV2\("task",extra\)/);
 assert.match(route,/rpc\("task_v2_capture"/);
 assert.match(migration,/public\.task_create\(p_actor_id/);
 assert.match(migration,/public\.task_v2_patch\(p_actor_id/);
 assert.match(migration,/revoke all on function public.task_v2_capture\(uuid,jsonb\) from public,anon,authenticated/);
});
test("Visual My Day reads real tasks and supports capture, completion, Top 3 and details",()=>{
 const ui=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 for(const endpoint of ["/api/tasks?limit=100&offset=","/api/tasks/v2/areas","/api/tasks/v2/projects","/api/tasks/v2/capture"])
  assert.ok(ui.includes(endpoint),endpoint+" is missing");
 for(const phrase of ["Today's Top 3","Completed today","Areas at a glance","Coming up next","All Tasks","Inbox"])
  assert.ok(ui.includes(phrase),phrase+" is missing");
 assert.match(ui,/const toggleDone=/);
 assert.match(ui,/const markFocus=/);
 assert.match(ui,/const openDetail=/);
 assert.match(ui,/TaskV2DetailDrawer/);
 assert.match(ui,/onChanged=\{refresh\}/);
 assert.match(ui,/mt2-done/);
});
test("Visual dashboard is responsive and does not change classic styles",()=>{
 const css=source("../../../app/tasks/v2/v2.css");
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.mt2-shell/);
 assert.doesNotMatch(css,/\.tw-shell/);
});
test("Development-only demo mapping cannot touch untagged tasks or another owner",()=>{
 const sql=source("../../../database/tasks/DEV_ONLY_v2_demo_areas.sql");
 assert.match(sql,/where t.owner_user_id=demo_owner/);
 assert.match(sql,/t.description like '\[DEMO DATA\]%'/);
 assert.match(sql,/Never run in Production/);
});
