import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("The canonical Tasks board renders Kanban and old V2 route redirects",()=>{
 const page=source("../../../app/tasks/board/page.tsx");
 const classic=source("../../../app/tasks/page.tsx");
 const day=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 const old=source("../../../app/tasks/v2/board/page.tsx");
 assert.match(page,/TasksV2Board/);
 assert.match(page,/board\.css/);
 assert.match(classic,/TasksV2Dashboard/);
 assert.match(day,/href="\/tasks\/board"/);
 assert.match(old,/redirect\("\/tasks\/board"\)/);
});
test("Board shows visual Kanban and supports native drag-and-drop plus control fallbacks",()=>{
 const board=source("../../../features/tasks/v2/TasksV2Board.tsx");
 for(const pattern of [/onDragStart/,/onDragOver/,/onDrop/,/draggable=\{movable\}/,
   /arrowMove/,/aria-label=\{"Move "/,/setGroup/,/visibleByColumn/,
   /subtask_total/,/subtask_done/,/TaskV2DetailDrawer/]){
  assert.match(board,pattern);
 }
 for(const grouping of ['"status"','"area"','"project"','"person"'])assert.ok(board.includes(grouping));
});
test("Board RPC validates the current account and rejects unapproved updates",()=>{
 const move=source("../../../app/api/tasks/v2/items/[id]/move/route.ts");
 const listing=source("../../../app/api/tasks/v2/board/route.ts");
 const detail=source("../../../app/api/tasks/v2/items/[id]/detail/route.ts");
 for(const src of [move,listing,detail]){
  assert.match(src,/taskSession\(request\)/);
  assert.match(src,/p_actor_id:session\.userId/);
 }
 assert.match(move,/p_position:data\.position/);
 assert.match(detail,/validateTask\(standard,true\)/);
 assert.match(detail,/validateV2\("task",meta\)/);
 assert.match(listing,/task_v2_board_list/);
});
test("Shared drawer supports checklist progress and definition of done",()=>{
 const drawer=source("../../../features/tasks/v2/TaskV2DetailDrawer.tsx");
 for(const text of ["Definition of done","Park & resume note","Checklist","Waiting for","Estimated minutes","Follow up on"]){
  assert.ok(drawer.includes(text),text+" missing");
 }
 assert.match(drawer,/\/subtasks/);
 assert.match(drawer,/subtask_total|const total=subtasks\.length/);
 assert.match(drawer,/!canEdit/);
 assert.match(drawer,/task_v2|\/api\/tasks\/v2\/items\//);
});
test("Database moves and full details preserve old status transitions and CRM safety",()=>{
 const sql=source("../../../database/tasks/12_v2_board_and_details.sql");
 const capture=source("../../../database/tasks/16_v2_capture_order_fix.sql");
 const snapshot=source("../../../database/tasks/14_v2_board_snapshot.sql");
 assert.match(sql,/public\.task_v2_board_move/);
 assert.match(sql,/public\.task_update\(p_actor_id,p_task_id/);
 assert.match(sql,/public\.task_v2_patch\(p_actor_id,p_task_id/);
 assert.match(sql,/v\.owner_user_id<>p_actor_id/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(capture,/pg_advisory_xact_lock/);
 assert.match(capture,/board_rank/);
 assert.match(snapshot,/subtask_total/);
 assert.match(snapshot,/tasks\.can_read\(p_actor_id,i\.id\)/);
 assert.match(sql,/revoke all on function/);
 assert.doesNotMatch(sql,/drop table|truncate\s+tasks\./i);
});
test("Styling is isolated to V2 and supports small screens",()=>{
 const css=source("../../../app/tasks/v2/board/board.css");
 const shared=source("../../../app/tasks/v2/v2.css");
 assert.match(css,/\.mt2-board-columns/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(shared,/\.mt2-drawer-backdrop/);
 assert.match(shared,/@media\(max-width:520px\)/);
});
