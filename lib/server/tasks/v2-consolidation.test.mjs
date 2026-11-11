import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
const source=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const exists=p=>existsSync(new URL(p,import.meta.url));

test("My Tasks root opens the unified dashboard and canonical sections",()=>{
 assert.match(source("../../../app/tasks/page.tsx"),/TasksV2Dashboard/);
 for(const [path,render] of [
  ["../../../app/tasks/board/page.tsx","TasksV2Board"],
  ["../../../app/tasks/focus/page.tsx","TasksV2Focus"],
  ["../../../app/tasks/planner/page.tsx","TasksV2Planner"],
  ["../../../app/tasks/connected/page.tsx","TasksV2Connected"]
 ])assert.match(source(path),new RegExp(render));
});
test("Obsolete Classic UI components and stylesheet are deleted",()=>{
 for(const path of [
  "../../../features/tasks/TasksWorkspace.tsx",
  "../../../features/tasks/TaskDataTools.tsx",
  "../../../features/tasks/TaskInboxBell.tsx",
  "../../../app/tasks/tasks.css"
 ])assert.equal(exists(path),false,path+" should be removed");
 const layout=source("../../../app/tasks/layout.tsx");
 assert.match(layout,/v2\/v2\.css/);
 assert.match(layout,/collaboration\.css/);
 assert.doesNotMatch(layout,/["']\.\/tasks\.css["']/);
 const dashboard=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 assert.doesNotMatch(dashboard,/Try the new|Classic Board|Classic Tasks|Classic<\/small>/);
});
test("Previous deep links redirect while onboarding remains supported",()=>{
 const oldRoutes={
  "../../../app/tasks/v2/page.tsx":"/tasks",
  "../../../app/tasks/v2/board/page.tsx":"/tasks/board",
  "../../../app/tasks/v2/focus/page.tsx":"/tasks/focus",
  "../../../app/tasks/v2/planner/page.tsx":"/tasks/planner",
  "../../../app/tasks/v2/connected/page.tsx":"/tasks/connected"
 };
 for(const [path,to] of Object.entries(oldRoutes))assert.ok(source(path).includes('redirect("'+to+'")'),path);
 const dynamic=source("../../../app/tasks/[view]/page.tsx");
 assert.match(dynamic,/view==="inbox"/);
 assert.match(dynamic,/view==="all"/);
 assert.match(dynamic,/redirect\("\/tasks\/connected\?task="/);
 assert.match(source("../../../app/tasks/welcome/page.tsx"),/\/api\/tasks\/onboarding/);
});
test("Navigation uses canonical URLs without changing existing versioned API endpoints",()=>{
 const pages=[
  "../../../features/tasks/v2/TasksV2Dashboard.tsx",
  "../../../features/tasks/v2/TasksV2Board.tsx",
  "../../../features/tasks/v2/TasksV2Focus.tsx",
  "../../../features/tasks/v2/TasksV2Planner.tsx",
  "../../../features/tasks/v2/TasksV2Connected.tsx"
 ];
 for(const p of pages){
  const s=source(p);
  assert.doesNotMatch(s,/href="\/tasks\/v2(?:\/|")/);
  assert.doesNotMatch(s,/Classic Tasks|Try V2|Try the new visual My Day/);
  assert.match(s,/href="\/tasks"/);
  assert.match(s,/\/api\/tasks\/v2\//);
 }
 assert.match(source("../../../features/tasks/ModuleTaskWidgets.tsx"),/\/tasks\/connected\?task=/);
 assert.match(source("../../../features/tasks/v2/TaskV2DetailDrawer.tsx"),/Open in Connected Work/);
});
test("Collaboration and CRM/Learning integrations remain intact",()=>{
 const collab=source("../../../app/tasks/collaboration.css");
 const ui=source("../../../features/tasks/TaskCollaboration.tsx");
 assert.match(collab,/\.tw-team-grid/);
 assert.match(collab,/\.tw-collaboration-detail/);
 assert.match(collab,/@media/);
 assert.match(ui,/TaskCollaborationDetail/);
 assert.match(ui,/TeamSpaces/);
 assert.match(source("../../../features/tasks/v2/TaskV2CollaborationPanel.tsx"),/TaskCollaborationDetail/);
 assert.match(source("../../../features/tasks/v2/TasksV2Connected.tsx"),/\/api\/tasks\/module-links/);
});
