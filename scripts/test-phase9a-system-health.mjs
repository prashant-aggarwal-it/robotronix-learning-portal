import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Phase 9A has navigable monitoring with hash deep link",()=>{
 const p=read("app/platform-admin/page.tsx");
 assert.ok(p.includes('"system-health"'));
 assert.ok(p.includes('href="#system-health"'));
 assert.ok(p.includes('<PlatformSystemHealth/>'));
 assert.ok(p.includes('activeSection==="system-health"'));
});
test("email health and administrator audit are no longer on Overview",()=>{
 const page=read("app/platform-admin/page.tsx");
 assert.ok(!page.includes("<PlatformEmailHealth/>"));
 assert.ok(!page.includes("<PlatformAdminSafety/>"));
 const monitor=read("app/platform-admin/PlatformSystemHealth.tsx");
 assert.ok(monitor.includes('panel==="email"&&<div className="platformHealthStack"><PlatformEmailHealth/>'));
 assert.ok(monitor.includes('<PlatformAdminSafety/>'));
});
test("monitoring navigation preserves implemented service and worker sections",()=>{
 const s=read("app/platform-admin/PlatformSystemHealth.tsx");
 for(const value of ["On-demand API and database probes","Scheduled execution not verified","<PlatformWorkerHealth/>"])assert.ok(s.includes(value));
 assert.ok(!s.includes("All systems operational"));
});
test("Phase 8 monitoring APIs still have service-only authorization",()=>{
 const api=["email-health","administrators","operations-summary"];
 for(const name of api){
  const s=read("app/api/platform-admin/"+name+"/route.ts");
  assert.ok(s.includes("requirePlatformAdmin("));
  assert.ok(s.includes("saas_platform_monitor_read_v1"));
 }
});
