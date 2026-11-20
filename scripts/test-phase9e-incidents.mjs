import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("incident access uses platform authorization and service-only database RPC",()=>{
 const sql=read("database/saas/97_phase9e_incidents.sql");
 for(const token of ["security invoker","enable row level security","revoke all on function","to service_role","platform_incidents_open_fingerprint_idx","platform_incident_history","saas_is_platform_admin_v1"])assert.ok(sql.includes(token),token);
 const api=read("app/api/platform-admin/incidents/route.ts");
 assert.ok(api.includes("requirePlatformAdmin("));
 assert.ok(api.includes("saas_platform_incidents_v1"));
 assert.ok(api.includes("no-store"));
 assert.ok(!api.includes("credential_reference"));
});
test("incident scan is explicitly triggered and limited to grounded failures",()=>{
 const scan=read("app/api/platform-admin/incident-scan/route.ts");
 for(const token of ["requirePlatformAdmin(","staleSending","oldestWaitMinutes","customer?.deliveries?.failed","saas_platform_incidents_v1"])assert.ok(scan.includes(token),token);
 assert.ok(scan.includes("Stale heartbeat alone is not an incident"));
});
test("incident actions retain history and block invalid state transitions",()=>{
 const sql=read("database/saas/97_phase9e_incidents.sql");
 assert.ok(sql.includes("Incident already resolved"));
 assert.ok(sql.includes("Incident not found"));
 assert.ok(sql.includes("acknowledged_at"));
 assert.ok(sql.includes("resolved_at"));
 const ui=read("app/platform-admin/PlatformIncidents.tsx");
 for(const term of ["Scan operational signals","Acknowledge","Resolve","window.confirm","No incidents recorded"])assert.ok(ui.includes(term),term);
 const layout=read("app/platform-admin/PlatformSystemHealth.tsx");
 assert.ok(layout.includes('panel==="security"&&<div className="platformHealthStack"><PlatformIncidents/>'));
});
