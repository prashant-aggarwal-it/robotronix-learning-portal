#!/usr/bin/env node
/**
 * Non-mutating integration contract gate for safe schema refactoring.
 * Source assertions only: does NOT prove runtime permissions, feature parity, or installation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
const failures=[];
let checked=0;
function read(file) { try { return readFileSync(join(process.cwd(),file),"utf8"); } catch { failures.push("Missing: "+file); return ""; } }
function requireText(file, fragments) {
 const source=read(file);
 for (const [description, fragment] of fragments) {
  checked++;
  if (!source.includes(fragment)) failures.push(file+": missing "+description+" ("+fragment+")");
 }
}
requireText("app/api/platform/my-products/route.ts",[
 ["Portal role resolution",'.from("profiles")'],
 ["CRM workspace access","connect_my_workspaces"],
 ["Tasks account access","task_account_get"]
]);
requireText("lib/server/connect-auth.ts",[
 ["verified caller identity","admin.auth.getUser(token)"],
 ["RPC invocation","session.admin.rpc(fn,args)"]
]);
requireText("lib/server/tasks/auth.ts",[
 ["verified caller identity","db.auth.getUser(token)"],
 ["Tasks account lookup","task_account_get"],
 ["legacy Portal behaviour","deployment.legacyDefault"]
]);
requireText("app/api/tasks/module-links/route.ts",[
 ["CRM source capability check", 'checkServerCapability("crmTasks")'],
 ["Academy source capability check", 'checkServerCapability("portalTasks")'],
 ["module links list RPC", "task_module_links_list"]
]);
requireText("database/tasks/02_functions.sql",[
 ["private task read guard","tasks.can_read"],
 ["Tasks module independence","Portal and CRM are optional integrations"]
]);
requireText("database/crm/02_functions.sql",[
 ["CRM workspace creation","connect_create_workspace"],
 ["CRM workspace lookup","connect_my_workspaces"]
]);
requireText("database/tasks/03_security.sql",[
 ["Tasks ownership policy","task_items_select"],
 ["Tasks sharing guard","tasks_prevent_module_link_sharing"]
]);
requireText("database/shared/integrations/05_full_suite_task_links.sql",[
 ["full suite integration prerequisites","to_regnamespace('connect')"],
 ["Portal schedule prerequisite","to_regclass('public.schedule_events')"]
]);
const p=JSON.parse(read("database/packages.json")||"{}");
for(const name of ["crm-only","tasks-only","portal-only","crm-tasks","portal-crm","portal-tasks","full-suite"]){
 checked++;
 if(!Array.isArray(p.packages?.[name]) || !p.packages[name].length)failures.push("Missing installer package: "+name);
}
checked++;
if(p.rules?.productionExecutionAllowed!==false)failures.push("Production execution guard changed");
if (failures.length) {
 console.error("Cross-module contract baseline FAILED:",failures.join("\n - "));
 process.exitCode=1;
} else console.log("Cross-module contract baseline passed: "+checked+" source/manifest assertions. This is NOT a runtime test.");
