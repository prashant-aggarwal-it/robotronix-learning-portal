import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Phase 6 is opt-in, V2 pages link to Connected Work and Classic Tasks stays available",()=>{
 const page=source("../../../app/tasks/v2/connected/page.tsx");
 const component=source("../../../features/tasks/v2/TasksV2Connected.tsx");
 assert.match(page,/TasksV2Connected/);
 assert.match(page,/connected\.css/);
 assert.match(source("../../../app/tasks/v2/layout.tsx"),/tasks\.css/);
 for(const path of [
  "../../../features/tasks/v2/TasksV2Dashboard.tsx",
  "../../../features/tasks/v2/TasksV2Board.tsx",
  "../../../features/tasks/v2/TasksV2Focus.tsx",
  "../../../features/tasks/v2/TasksV2Planner.tsx"
 ]){
  assert.match(source(path),/href="\/tasks\/v2\/connected"/);
 }
 assert.match(component,/TeamSpaces/);
 assert.match(source("../../../app/tasks/page.tsx"),/TasksWorkspace/);
});
test("Connected hub uses existing authenticated workspace and source-link API contracts",()=>{
 const ui=source("../../../features/tasks/v2/TasksV2Connected.tsx");
 for(const endpoint of [
  "/api/tasks/collaboration?scope=workspaces",
  "/api/tasks/module-links",
  "/api/tasks/v2/board?limit=250&offset=",
  "/api/tasks/v2/areas","/api/tasks/v2/projects"
 ])assert.ok(ui.includes(endpoint),endpoint+" not wired");
 assert.match(ui,/getSupabaseBrowserClient\(\)\?\.auth\.getUser/);
 assert.match(ui,/Authorization:"Bearer "\+session\.access_token/);
 assert.match(ui,/owner_user_id!==userId&&t\.assignee_user_id===userId/);
 assert.match(ui,/owner_user_id===userId&&t\.assignee_user_id!==null/);
 assert.match(ui,/TeamSpaces request=\{request\}/);
});
test("Collaboration drawer reuses checked permissions, comments, attachments and history",()=>{
 const drawer=source("../../../features/tasks/v2/TaskV2DetailDrawer.tsx");
 const panel=source("../../../features/tasks/v2/TaskV2CollaborationPanel.tsx");
 const classic=source("../../../features/tasks/TaskCollaboration.tsx");
 assert.match(drawer,/People & connections/);
 assert.match(drawer,/TaskV2CollaborationPanel/);
 assert.match(panel,/TaskCollaborationDetail/);
 assert.match(classic,/scope=access/);
 assert.match(classic,/scope=comments/);
 assert.match(classic,/scope=activity/);
 assert.match(classic,/scope=attachments/);
 assert.match(classic,/comment_add/);
 assert.match(classic,/invite_accept/);
 assert.match(classic,/file.*attachments/);
});
test("Linked-source tasks cannot be reshared using the new collaboration drawer",()=>{
 const panel=source("../../../features/tasks/v2/TaskV2CollaborationPanel.tsx");
 const classic=source("../../../features/tasks/TaskCollaboration.tsx");
 assert.match(panel,/sharingDisabled=\{links\.length>0\|\|Boolean\(error\)\}/);
 assert.match(panel,/task\.owner_user_id===userId/);
 assert.match(panel,/link\.task_id===task\.id/);
 assert.match(classic,/access\.owner&&!sharingDisabled/);
 const api=source("../../../app/api/tasks/module-links/route.ts");
 assert.match(api,/taskSession\(request\)/);
 assert.match(api,/p_actor_id:session\.userId/);
});
test("Assigned collaborators can only change status using the existing permission-checked API",()=>{
 const hub=source("../../../features/tasks/v2/TasksV2Connected.tsx");
 const panel=source("../../../features/tasks/v2/TaskV2CollaborationPanel.tsx");
 const legacy=source("../../../app/api/tasks/[id]/route.ts");
 assert.match(hub,/userId\|\|task\.assignee_user_id!==userId/);
 assert.match(hub,/JSON\.stringify\(\{status\}\)/);
 assert.match(panel,/userId!==task\.assignee_user_id/);
 assert.match(panel,/JSON\.stringify\(\{status:next\}\)/);
 assert.match(legacy,/taskSession\(request\)/);
 assert.match(legacy,/rpc\("task_update"/);
});
test("Linked tasks open only existing module routes and use role-safe learning entry",()=>{
 const hub=source("../../../features/tasks/v2/TasksV2Connected.tsx");
 const panel=source("../../../features/tasks/v2/TaskV2CollaborationPanel.tsx");
 for(const code of [hub,panel]){
  assert.match(code,/getCurrentProfile/);
  assert.match(code,/\/trainer\/schedule/);
  assert.match(code,/\/admin\/schedule/);
  assert.match(code,/\/connect/);
 }
 assert.doesNotMatch(hub,/window\.location\.href\s*=\s*link\.resource_id/);
});
test("Existing CRM/Learning link buttons now deep-link into V2 without removing Classic Tasks",()=>{
 const widget=source("../../../features/tasks/ModuleTaskWidgets.tsx");
 assert.match(widget,/connectFetch<\{item\?:\{task_id:string\}\}>/);
 assert.match(widget,/\/api\/tasks\/module-links/);
 assert.match(widget,/\/tasks\/v2\/connected\?task=/);
 assert.match(widget,/Classic ↗/);
 assert.match(widget,/Open in V2 ↗/);
 const hub=source("../../../features/tasks/v2/TasksV2Connected.tsx");
 assert.match(hub,/openedDeepLink/);
 assert.match(hub,/setSelected\(match\)/);
});
test("Responsive Connected Work layouts and drawer styles load in every V2 route",()=>{
 const css=source("../../../app/tasks/v2/connected/connected.css");
 const shared=source("../../../app/tasks/v2/v2.css");
 const board=source("../../../app/tasks/v2/board/board.css");
 assert.match(css,/\.mt2-connected-metrics/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(shared,/\.mt2-drawer-tabs/);
 assert.match(shared,/\.mt2-drawer-people/);
 assert.match(board,/\.mt2-shared-chip/);
 assert.match(board,/\.mt2-source-mini/);
});
