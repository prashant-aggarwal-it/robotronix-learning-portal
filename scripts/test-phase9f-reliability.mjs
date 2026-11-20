import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("reliability endpoint enforces platform-admin access and no caching",()=>{
 const api=read("app/api/platform-admin/reliability/route.ts");
 for(const token of ["requirePlatformAdmin(","saas_platform_reliability_v1","no-store","Authorization"])assert.ok(api.includes(token),token);
});
test("reliability function is service-only and does not assert backups exist",()=>{
 const sql=read("database/saas/98_phase9f_reliability.sql");
 for(const token of ["security invoker","from public,anon,authenticated","to service_role","pg_database_size","unverified","not_configured","not_instrumented"])assert.ok(sql.includes(token),token);
 assert.ok(!sql.includes("credential_reference"));
});
test("UI provides honest reliability status and responsive navigation",()=>{
 const ui=read("app/platform-admin/PlatformReliability.tsx");
 for(const token of ["Not verified","Not tested","Not monitored","database.sizeBytes","Refresh checks"])assert.ok(ui.includes(token),token);
 const shell=read("app/platform-admin/PlatformSystemHealth.tsx");
 assert.ok(shell.includes('panel==="recovery"&&<PlatformReliability/>'));
});
test("platform monitoring routes enforce server-side authorization",()=>{
 for(const name of ["service-health","worker-health","customer-health","incidents","incident-scan","reliability","email-health","administrators"]){
  const api=read("app/api/platform-admin/"+name+"/route.ts");
  assert.ok(api.includes("requirePlatformAdmin("),name);
 }
});
