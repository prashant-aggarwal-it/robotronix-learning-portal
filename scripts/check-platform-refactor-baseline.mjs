#!/usr/bin/env node
/**
 * Robotronix legacy-contract baseline gate.
 * Non-mutating source-level guard for the first stage of domain refactoring.
 * This is not a substitute for runtime/E2E/security tests.
 */
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";

const root=process.cwd();
const failures=[];
const checks=[
 ["lib/platform/deployment.ts",[
  ["all three product IDs",/PRODUCT_IDS\s*=\s*\[\s*["']portal["']\s*,\s*["']crm["']\s*,\s*["']tasks["']/],
  ["explicit deployment switch",/function resolveDeploymentConfig\(/],
  ["disabled integration guard",/required\[id\]/],
  ["route availability",/function isRouteAvailable\(/],
  ["legacy default behaviour",/legacyDefault/]
 ]],
 ["lib/platform/auth-routing.ts",[
  ["safe redirect allowlist",/function safeAuthNext\(/],
  ["role-based destination",/function resolveAuthDestination\(/],
  ["legacy disabled-profile rule",/legacyDefault\s*&&\s*portal\?\.state\s*===\s*["']disabled["']/]
 ]],
 ["lib/platform/server-access.ts",[
  ["server module guard",/function checkServerModule\(/],
  ["server integration guard",/function checkServerCapability\(/]
 ]],
 ["app/api/platform/my-products/route.ts",[
  ["Portal role lookup",/\.from\(["']profiles["']\)/],
  ["CRM workspace lookup",/connect_my_workspaces/],
  ["Tasks account lookup",/task_account_get/]
 ]],
 ["lib/server/connect-auth.ts",[
  ["authenticated CRM session",/function connectSession\(/],
  ["CRM RPC boundary",/function invokeConnect/]
 ]],
 ["lib/server/tasks/auth.ts",[
  ["authenticated Tasks session",/function taskSession\(/],
  ["Tasks account guard",/task_account_get/]
 ]]
];
let passed=0;
for(const [file, expectations] of checks){
 const path=resolve(root,file);
 if(!existsSync(path)){failures.push(file+" (missing)");continue;}
 const source=readFileSync(path,"utf8");
 for(const [name,regex] of expectations){
  if(!regex.test(source))failures.push(file+": "+name);
  else passed++;
 }
}
const manifest=resolve(root,"database/packages.json");
if(!existsSync(manifest))failures.push("database/packages.json missing");
else {
 try {
  const packages=JSON.parse(readFileSync(manifest,"utf8"));
  for(const name of ["portal-only","crm-only","tasks-only","crm-tasks","portal-crm","portal-tasks","full-suite"]){
   if(!Array.isArray(packages.packages?.[name]) || !packages.packages[name].length)failures.push("missing deployment package: "+name);
   else passed++;
  }
  if(packages.rules?.productionExecutionAllowed!==false)failures.push("productionExecutionAllowed must be false");
  else passed++;
 } catch(error){failures.push("invalid package manifest: "+error.message);}
}
const jobPath=resolve(root,"config/scheduled-jobs.json");
if(!existsSync(jobPath))failures.push("config/scheduled-jobs.json missing");
else {
 try {
  const jobs=JSON.parse(readFileSync(jobPath,"utf8")).jobs;
  for(const name of ["process-reminders","zoom-auto-reconcile","zoom-retention","process-task-reminders","connect-reminders","connect-history-drain","connect-portal-ops"]){
   if(!Array.isArray(jobs) || !jobs.some(job=>job.name===name))failures.push("missing scheduler contract: "+name);
   else passed++;
  }
 }catch(error){failures.push("invalid scheduler inventory: "+error.message);}
}
if(failures.length){
 console.error("Platform baseline FAILED ("+passed+" checks passed):\n"+failures.map(x=>" - "+x).join("\n"));
 process.exitCode=1;
}else console.log("Platform baseline PASSED ("+passed+" source and manifest checks).");
