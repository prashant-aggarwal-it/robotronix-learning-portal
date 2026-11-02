import fs from "node:fs";
import assert from "node:assert/strict";

// Regression checks for the action inconsistencies found on 2 November 2026.
// This is a static contract; run visual checks across roles before release.
const read = path => fs.readFileSync(path, "utf8");
const common = read("app/globals.css");
const theme = read("app/theme.css");
const zoom = read("app/admin/zoom/zoom-admin.css");
const alerts = read("app/admin/alerts/page.tsx");
assert.match(common, /\\.button\\s*\\{/);
assert.match(common, /\\.button\\.ghost/);
assert.match(theme, /\\[data-portal-theme="ai-flow"\\] \\.button:not\\(\\.ghost\\):not\\(\\.secondary\\)/);
assert.match(zoom, /\\[data-portal-theme="ai-flow"\\] \\.zoomAdminRefresh \\.zoomActionPrimary/);
assert.doesNotMatch(zoom, /\\.zoomActionPrimary\\{background:#087ea3/);
assert.match(zoom, /\\.zoomActionOutline\\{background:#fff/);
assert.match(alerts, /className="tableAction alertRowManageAction"/);
assert.match(common, /\\.alertRowManageAction:focus-visible/);
assert.match(connect, /disabled=\\{!confirmed\\}/);
console.log("Action button regression contracts: OK (visual review still required)");
