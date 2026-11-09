import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const read=path=>readFileSync(join(process.cwd(),path),"utf8");
const route=read("app/api/connect/workspaces/[tenantId]/portal-demos/route.ts");
const install=read("app/api/connect/workspaces/[tenantId]/portal-integration/route.ts");
const access=read("lib/server/connect-portal-access.ts");
const domain=read("lib/server/portal-demo-booking.ts");
const admin=read("app/api/admin/demos/route.ts");
const calendar=read("features/connect/components/ConnectCalendar.tsx");
const bridge=read("database/connect/saas/51_portal_demo_private_rpc.sql");
const reserve=read("database/connect/saas/48_portal_demo_bridge.sql");
const move=read("database/connect/saas/49_portal_demo_move_slot.sql");

for(const action of ['"booking_context"','"begin"','"complete"','"fail"','"detail"','"change"']){
 assert.ok(bridge.includes(`'${action.slice(1,-1)}'`)||route.includes(action),`missing bridge action ${action}`);
}
assert.match(route,/portalBridgeAccess\(request,tenantId,true\)/);
assert.match(route,/createPortalDemoBooking/);
assert.match(route,/requestId/);
assert.match(route,/payloadHash/);
assert.match(route,/portal_demo_move_slot/);
assert.match(route,/PATCH\(/);
assert.match(install,/connect_portal_demo_bridge/);
assert.match(access,/connect_portal_demo_bridge/);
assert.doesNotMatch(access,/\.schema\("connect"\)/);
assert.match(bridge,/revoke all on function public\.connect_portal_demo_bridge.*public,anon,authenticated/);
assert.match(reserve,/pg_catalog\.pg_advisory_xact_lock/);
assert.match(move,/for update/);
assert.match(domain,/guest_token_hash/);
assert.match(admin,/createPortalDemoBooking/);
assert.match(calendar,/ConnectPortalDemos/);
console.log("Phase B code contracts OK (source checks; live Zoom/roles require authenticated UAT).");
