import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("All Tasks and Inbox use the full content width and progressive task disclosure",()=>{
 const ui=src("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 assert.match(ui,/mt2-lower-grid--wide/);
 assert.match(ui,/mt2-task-list--grid/);
 assert.match(ui,/setListLimit\(n=>n\+16\)/);
 assert.match(ui,/Show more tasks/);
 assert.match(ui,/Show remaining today/);
 assert.match(ui,/setTodayLimit\(n=>n\+8\)/);
 assert.match(ui,/view==="day"\&\&<div className="mt2-right-stack"/);
 const css=src("../../../app/tasks/ui-polish.css");
 assert.match(css,/\.mt2-lower-grid--wide\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.mt2-task-list--grid\{display:grid;grid-template-columns:repeat\(2/);
});
test("My Day's completed panel only shows finished tasks and Top 3 is not listed twice",()=>{
 const ui=src("../../../features/tasks/v2/TasksV2Dashboard.tsx");
 assert.match(ui,/Daily momentum/);
 assert.match(ui,/completedToday\.length/);
 assert.match(ui,/mt2-momentum-ring/);
 assert.match(ui,/!focus\.some\(f=>f\.id===t\.id\)/);
 assert.doesNotMatch(ui,/Today's diary/);
});
test("Focus preferences and history live in the main column beneath the focus controls",()=>{
 const ui=src("../../../features/tasks/v2/TasksV2Focus.tsx");
 const a=ui.indexOf('className="mt2-focus-grid"');
 const b=ui.indexOf('className="mt2-focus-primary"',a);
 const c=ui.indexOf('mt2-focus-session',b);
 const d=ui.indexOf('className="mt2-focus-bottom"',c);
 const e=ui.indexOf('className="mt2-focus-aside"',d);
 assert.ok(a>=0&&b>a&&c>b&&d>c&&e>d);
 const css=src("../../../app/tasks/ui-polish.css");
 assert.match(css,/\.mt2-focus-session\{min-height:0\}/);
 assert.match(css,/\.mt2-focus-primary\{display:grid/);
});
test("Connected Work overview links to Team Spaces without rendering full team forms",()=>{
 const ui=src("../../../features/tasks/v2/TasksV2Connected.tsx");
 assert.match(ui,/mt2-workspace-preview/);
 assert.match(ui,/view==="overview"\&\&<section className="mt2-panel mt2-workspace-preview"/);
 assert.match(ui,/view==="teams"\&\&<section className="mt2-connected-team"/);
 assert.match(ui,/Manage team spaces/);
 assert.match(src("../../../app/tasks/ui-polish.css"),/\.mt2-connected-panes>\.mt2-panel\{min-height:0\}/);
});
test("Kanban shows active lanes first and avoids duplicate group controls",()=>{
 const board=src("../../../features/tasks/v2/TasksV2Board.tsx");
 assert.match(board,/useState\(false\)/);
 assert.match(board,/const displayColumns=columns\.filter/);
 assert.match(board,/showEmpty/);
 assert.match(board,/groupOptions\.map/);
 assert.doesNotMatch(board,/onClick=\{\(\)=>setGroup\("area"\)\}/);
 assert.match(board,/Move .*to a different column/);
});
test("One shared visual layer provides responsive professional layout and keyboard focus",()=>{
 const layout=src("../../../app/tasks/layout.tsx");
 const css=src("../../../app/tasks/ui-polish.css");
 assert.match(layout,/import "\.\/ui-polish\.css"/);
 assert.match(css,/\.mt2-shell button:focus-visible/);
 for(const bp of ["1200px","1000px","700px","450px"])assert.ok(css.includes(bp));
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css,/(?:\bbody|\bhtml)\s*\{/);
});
