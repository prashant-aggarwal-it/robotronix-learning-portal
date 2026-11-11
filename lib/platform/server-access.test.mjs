import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import {schedulerCapabilityEnabled} from "./scheduler-capabilities.mjs";

// Test typed server gates without starting Next.js, a database, or a scheduler.
const compile=s=>ts.transpileModule(s,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const data=s=>"data:text/javascript;base64,"+Buffer.from(compile(s)).toString("base64");
const deployment=data(fs.readFileSync("lib/platform/deployment.ts","utf8"));
const serverSource=fs.readFileSync("lib/platform/server-access.ts","utf8")
 .replace('from "./deployment"','from "'+deployment+'"');
const {checkServerModule,checkServerCapability}=await import(data(serverSource));
const matrix=[
 {env:{PRODUCT_MODE:"portal"},allow:["portal"],reject:["crm","tasks","crmPortal","crmTasks","portalTasks"]},
 {env:{PRODUCT_MODE:"crm"},allow:["crm"],reject:["portal","tasks","crmPortal","crmTasks"]},
 {env:{PRODUCT_MODE:"tasks"},allow:["tasks"],reject:["portal","crm","crmPortal","crmTasks"]},
 {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"crm,tasks",ENABLED_INTEGRATIONS:"crmTasks"},allow:["crm","tasks","crmTasks"],reject:["portal","crmPortal","portalTasks"]},
 {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,crm",ENABLED_INTEGRATIONS:"crmPortal"},allow:["portal","crm","crmPortal"],reject:["tasks","crmTasks","portalTasks"]},
 {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,tasks",ENABLED_INTEGRATIONS:"portalTasks"},allow:["portal","tasks","portalTasks"],reject:["crm","crmTasks","crmPortal"]},
 {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,crm,tasks",ENABLED_INTEGRATIONS:"crmPortal,crmTasks,portalTasks"},allow:["portal","crm","tasks","crmPortal","crmTasks","portalTasks"],reject:[]},
 {env:{},allow:["portal","crm","tasks","crmPortal","crmTasks","portalTasks"],reject:[]}
];
for(const {env,allow,reject} of matrix){
 test("server/worker capability parity "+JSON.stringify(env),()=>{
  for(const id of allow){
   assert.equal(checkServerCapability(id,env).ok,true,id);
   assert.equal(schedulerCapabilityEnabled(id,env),true,id);
  }
  for(const id of reject){
   assert.deepEqual(checkServerCapability(id,env),{ok:false,status:404,message:"Module unavailable"},id);
   assert.equal(schedulerCapabilityEnabled(id,env),false,id);
  }
 });
}
test("core entry point routes require installed product even outside Next Proxy",()=>{
 const env={PRODUCT_MODE:"crm"};
 assert.equal(checkServerModule("/api/connect/workspaces",env).ok,true);
 assert.equal(checkServerModule("/api/tasks",env).status,404);
 assert.equal(checkServerModule("/api/zoom/hosts",env).status,404);
 assert.equal(checkServerModule("/api/connect/workspaces/id/admissions",env).status,404);
 assert.equal(checkServerModule("/api/connect/webhooks/meta",env).ok,true);
});
test("bad configuration fails closed on direct APIs and workers",()=>{
 const env={PRODUCT_MODE:"crm",ENABLED_INTEGRATIONS:"crmPortal"};
 assert.equal(checkServerModule("/api/connect/workspaces",env).status,503);
 assert.equal(checkServerCapability("crm",env).status,503);
 assert.equal(schedulerCapabilityEnabled("crm",env),false);
});
test("every CRM/Tasks API route passes through a shared module guard or signed session",()=>{
 function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
   const f=dir+"/"+e.name;return e.isDirectory()?walk(f):[f];
  });
 }
 const routes=walk("app/api").filter(p=>p.endsWith("/route.ts"));
 const crm=routes.filter(p=>p.startsWith("app/api/connect/"));
 const tasks=routes.filter(p=>p.startsWith("app/api/tasks/"));
 assert.ok(crm.length>=40 && tasks.length>=25,"expected current module route surface");
 const offenders=[];
 for(const p of crm){
  const s=fs.readFileSync(p,"utf8");
  if(!/connectSession\(|portalBridgeAccess\(|requireServerCapability\(/.test(s))offenders.push(p);
 }
 for(const p of tasks){
  const s=fs.readFileSync(p,"utf8");
  if(!/taskSession\(|checkServerModule\(/.test(s))offenders.push(p);
 }
 assert.deepEqual(offenders,[],"all CRM/Tasks routes must apply independently verified guards");
});
test("cross-module RPCs and scheduler entry points have direct gates",()=>{
 const source=p=>fs.readFileSync(p,"utf8");
 for(const p of [
  "lib/server/connect-portal-access.ts",
  "app/api/connect/workspaces/[tenantId]/portal-integration/route.ts",
  "app/api/admission/handoff/[token]/route.ts",
  "app/api/tasks/module-links/route.ts"
 ])assert.match(source(p),/checkServerCapability\(/,p);
 for(const p of [
  "app/api/connect/webhooks/email/route.ts",
  "app/api/connect/webhooks/meta/route.ts",
  "app/api/connect/public/forms/[formKey]/route.ts",
  "app/api/connect/jobs/reminders/route.ts",
  "app/api/connect/jobs/whatsapp-history/route.ts"
 ])assert.match(source(p),/requireServerCapability\(/,p);
 for(const p of [
  "netlify/functions/connect-reminders.mjs",
  "netlify/functions/connect-portal-ops.mjs",
  "netlify/functions/process-task-reminders.mjs"
 ])assert.match(source(p),/schedulerCapabilityEnabled\(/,p);
});
