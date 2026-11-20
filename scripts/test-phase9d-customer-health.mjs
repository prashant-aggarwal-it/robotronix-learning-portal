import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("customer health access uses privileged server-only aggregates",()=>{
 const api=read("app/api/platform-admin/customer-health/route.ts");
 for(const term of ["requirePlatformAdmin(","saas_platform_customer_health_v1","no-store","Vary"])assert.ok(api.includes(term),term);
 assert.ok(!api.includes('.schema("saas")'));
 const sql=read("database/saas/96_phase9d_customer_health.sql");
 for(const term of ["security invoker","from public,anon,authenticated","to service_role","count(*)","not_instrumented"])assert.ok(sql.includes(term),term);
 assert.ok(!sql.includes("credential_reference"));
});
test("customer monitoring reports uninstrumented integrations clearly",()=>{
 const ui=read("app/platform-admin/PlatformCustomerHealth.tsx");
 for(const term of ["Not monitored","Connection records only","not included in Phase 9D","/api/platform-admin/customer-health"])assert.ok(ui.includes(term),term);
 const layout=read("app/platform-admin/PlatformSystemHealth.tsx");
 assert.ok(layout.includes('panel==="email"&&<div className="platformHealthStack"><PlatformEmailHealth/><PlatformCustomerHealth compact/>'));
});
