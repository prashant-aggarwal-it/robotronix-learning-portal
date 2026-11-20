import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("service health endpoint is privileged and never cached",()=>{
 const s=read("app/api/platform-admin/service-health/route.ts");
 assert.match(s,/requirePlatformAdmin\(/);
 assert.match(s,/Cache-Control.*no-store/);
 assert.match(s,/Vary.*Authorization/);
 assert.match(s,/saas_platform_monitor_read_v1/);
 assert.ok(!s.includes('.schema("saas")'));
});
test("probe does not invent uptime/error history",()=>{
 const s=read("app/api/platform-admin/service-health/route.ts");
 for(const x of ["performance.now()","historicalMetrics","uptimePercent:null","errorRatePercent:null","p95LatencyMs:null","databaseMs"])assert.ok(s.includes(x),x);
});
test("services panel displays measured data and honest unknown states",()=>{
 const s=read("app/platform-admin/PlatformServiceHealth.tsx");
 for(const x of ["service-health","Run checks","latencyMs","Health unknown","not measured yet"])assert.ok(s.includes(x),x);
 const parent=read("app/platform-admin/PlatformSystemHealth.tsx");
 assert.ok(parent.includes('panel==="services"&&<div className="platformHealthStack"><PlatformServiceHealth/>'));
});
