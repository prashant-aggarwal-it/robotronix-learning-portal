import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const sql=read("database/connect/saas/58_portal_lifecycle_renewals.sql");
const route=read("app/api/connect/workspaces/[tenantId]/lifecycle/route.ts");
const ui=read("features/connect/components/ConnectLifecycleDashboard.tsx");
const nav=read("features/connect/model.ts");

for(const name of ["portal_lifecycle_summaries","portal_renewal_signals","connect_sync_portal_lifecycle","connect_portal_lifecycle"])
 assert.ok(sql.includes(name),`Missing ${name}`);
assert.match(sql,/h\.status='enrollment_confirmed'/,"Only confirmed handoffs can sync");
assert.match(sql,/h\.verified_at is not null/,"Only verified guardian mappings can sync");
assert.match(sql,/i\.status='active'/,"Disabled integrations cannot sync");
assert.match(sql,/owner_membership_id=v_member/,"Counsellor data limited to assigned opportunities");
assert.match(sql,/when v_role in \('owner','admin','manager'\) then l\.payment_attention else null/,"Hide finance data from counsellors");
assert.match(sql,/revoke all on function public\.connect_portal_lifecycle.*from public,anon,authenticated/,"RPC must stay service-role-only");
assert.match(sql,/primary key \(tenant_id,enrollment_id,cycle_key\)/,"Renewal per package cycle idempotency");
assert.match(route,/portalBridgeAccess\(request,tenantId,true\)/,"POST requires write permission");
assert.match(route,/noStore/,"Private data cannot be cached");
assert.match(ui,/Mark contacted/);
assert.match(ui,/Dismiss/);
assert.match(nav,/Learner lifecycle/);
console.log("Connect Phase D static contracts passed (13 checks).");
