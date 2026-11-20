import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("monitoring reads are privileged and metadata-only",()=>{
 const s=read("app/api/platform-admin/worker-health/route.ts");
 for(const v of ["requirePlatformAdmin(","saas_platform_worker_health_v1","Cache-Control","no-store","staleSending","oldestWaitMinutes"])assert.ok(s.includes(v),v);
 assert.ok(!s.includes('.schema("saas")'));
});
test("heartbeat recording only follows authenticated worker entry",()=>{
 const s=read("app/api/internal/academy-notifications/process/route.ts");
 assert.ok(s.indexOf('req.headers.get("authorization")')<s.indexOf('await heartbeat("started")'));
 for(const v of ['heartbeat("started")','heartbeat("success"','heartbeat("failed")','ACADEMY_NOTIFICATION_WORKER_SECRET'])assert.ok(s.includes(v),v);
});
test("worker RPCs are service-only, invoker and return redacted aggregate data",()=>{
 const s=read("database/saas/95_phase9c_worker_health.sql");
 for(const v of ["security invoker","from public,anon,authenticated","to service_role","staleSending","oldestWaitMinutes","worker_key text primary key","enable row level security"])assert.ok(s.includes(v),v);
 assert.ok(!s.includes("recipient_email"));
});
test("worker UI does not claim unknown heartbeat is healthy",()=>{
 const s=read("app/platform-admin/PlatformWorkerHealth.tsx");
 for(const v of ["No heartbeat recorded yet","Scheduled execution has not been verified","last_started_at","Refresh","Failed","Retrying"])assert.ok(s.includes(v),v);
 const nav=read("app/platform-admin/PlatformSystemHealth.tsx");
 assert.ok(nav.includes('panel==="services"&&<div className="platformHealthStack"><PlatformServiceHealth/><PlatformWorkerHealth/>'));
});
