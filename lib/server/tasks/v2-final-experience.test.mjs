import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");

test("All six user-facing Tasks screens use one progressive navigation",()=>{
 const nav=source("../../../features/tasks/v2/TasksPrimaryNav.tsx");
 const paths=[
  "../../../features/tasks/v2/TasksV2Dashboard.tsx",
  "../../../features/tasks/v2/TasksV2Planner.tsx",
  "../../../features/tasks/v2/TasksV2Board.tsx",
  "../../../features/tasks/v2/TasksV2Focus.tsx",
  "../../../features/tasks/v2/TasksV2Connected.tsx",
  "../../../features/tasks/v2/TasksV2Settings.tsx"
 ];
 for(const p of paths)assert.match(source(p),/TasksPrimaryNav section=/,p);
 for(const label of ["My Day","Inbox","All Tasks","Weekly Planner","Visual Board","Focus & Finish","Connected Work","Settings & Data"])assert.ok(nav.includes(label));
 const order=["id:"+'"day"',"id:"+'"inbox"',"id:"+'"all"',"id:"+'"planner"',"id:"+'"board"',"id:"+'"focus"',"id:"+'"connected"',"id:"+'"settings"'];
 let previous=-1;for(const s of order){const position=nav.indexOf(s);assert.ok(position>previous,"Navigation must follow capture, organize, plan, execute, collaborate");previous=position;}
 assert.match(nav,/href:"\/tasks\?view=inbox"/);
 assert.match(nav,/aria-current=\{active\?"page":undefined\}/);
 assert.match(source("../../../features/tasks/v2/TasksV2Dashboard.tsx"),/router\.replace\(next==="day"\?"\/tasks":"\/tasks\?view="\+next/);
});
test("Daily dashboard uses live source data rather than hardcoded chart totals",()=>{
 const day=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 assert.match(day,/const completedToday=done\.filter/);
 assert.match(day,/const completionPercent=Math\.round/);
 assert.match(day,/const estimatedToday=todayOpen\.reduce/);
 assert.match(day,/const weekOutlook=Array\.from\(\{length:7\}/);
 assert.match(day,/active\.filter\(t=>!t\.someday/);
 assert.match(day,/mt2-momentum-ring/);
 assert.match(day,/role="img" aria-label=\{completionPercent/);
 assert.match(day,/mt2-weekly-bars/);
 assert.match(day,/mt2-weekly-summary/);
 assert.match(day,/onClick=\{\(\)=>openDetail\(recommended\)\}/);
 assert.match(day,/href="\/tasks\/planner"/);
 assert.match(day,/const completedToday=done\.filter\(t=>t\.completed_at/);
 assert.doesNotMatch(day,/mt2-progress-panel|mt2-areas-panel/);
});
test("All Tasks filters are actionable, show accurate counts, and keep complete records",()=>{
 const day=source("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 assert.match(day,/taskFilter==="overdue"/);
 assert.match(day,/taskFilter==="high"/);
 assert.match(day,/taskFilter==="waiting"/);
 assert.match(day,/mt2-smart-filters/);
 assert.match(day,/setTaskFilter\(id\)/);
 assert.match(day,/Show more tasks/);
 assert.match(day,/dailyOpen\.filter\(t=>t\.status!=="done"\)|const dailyOpen=chosen\.filter\(t=>t\.status!=="done"\)/);
});
test("Board avoids dead empty lanes yet preserves a fallback and explicit display control",()=>{
 const board=source("../../../features/tasks/v2/TasksV2Board.tsx");
 assert.match(board,/const displayColumns=columns\.filter/);
 assert.match(board,/filtered\.length===0&&i===0/);
 assert.match(board,/showEmpty/);
 assert.match(board,/Empty groups/);
 assert.match(board,/columns\.map\(c=><option/);
 assert.match(board,/onDragOver=/);
 assert.match(board,/onDrop=/);
});
test("Connected Work does not render two empty delegation cards in Overview",()=>{
 const connected=source("../../../features/tasks/v2/TasksV2Connected.tsx");
 assert.match(connected,/assigned\.some\(t=>t\.status!=="done"\)\|\|delegated\.some/);
 assert.match(connected,/mt2-handoff-empty/);
 assert.match(connected,/Manage team spaces/);
 assert.match(connected,/view==="teams"&&<section className="mt2-connected-team"/);
});
test("Product UI is responsive, works without animations and does not rewrite platform-wide CSS",()=>{
 const css=source("../../../app/tasks/product-experience.css");
 const layout=source("../../../app/tasks/layout.tsx");
 assert.match(layout,/import "\.\/product-experience\.css"/);
 for(const sel of ["mt2-primary-nav","mt2-momentum-ring","mt2-weekly-bars","mt2-smart-filters","mt2-handoff-empty"])assert.ok(css.includes(sel),sel);
 for(const bp of ["1250px","1050px","700px","420px"])assert.ok(css.includes(bp),"Missing breakpoint "+bp);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/(?:\bbody|\bhtml)\s*\{/);
});