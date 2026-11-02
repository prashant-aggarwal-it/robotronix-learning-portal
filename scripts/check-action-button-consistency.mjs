import fs from "node:fs";
import assert from "node:assert/strict";

// Static regression contract: complete rendered QA is handled by qa:all-roles-visual.
const read = path => fs.readFileSync(path, "utf8");
const common = read("app/globals.css");
const theme = read("app/theme.css");
const zoom = read("app/admin/zoom/zoom-admin.css");
const alerts = read("app/admin/alerts/page.tsx");
for(const [name,source,fragment] of [
 ["shared button",common,".button {"],
 ["shared ghost button",common,".button.ghost"],
 ["AI Flow primary",theme,'.button:not(.ghost):not(.secondary)'],
 ["Zoom AI Flow primary",zoom,'.zoomAdminRefresh .zoomActionPrimary'],
 ["Zoom outlined secondary",zoom,'.zoomActionOutline{background:#fff'],
 ["Alerts compact action",alerts,'className="tableAction alertRowManageAction"'],
 ["Alerts focus styling",common,'.alertRowManageAction:focus-visible'],
]){
 assert.ok(source.includes(fragment),name+" regression");
}
assert.ok(!zoom.includes(".zoomActionPrimary{background:#087ea3"),"Zoom must not use the old teal primary style");
console.log("Action button style contracts: OK");
