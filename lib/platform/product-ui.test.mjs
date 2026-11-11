import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const compile=s=>ts.transpileModule(s,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const url=s=>"data:text/javascript;base64,"+Buffer.from(compile(s)).toString("base64");
const deployment=url(fs.readFileSync("lib/platform/deployment.ts","utf8"));
const brandSource=fs.readFileSync("lib/platform/branding.ts","utf8")
 .replace('from "./deployment"','from "'+deployment+'"');
const {getProductBrand}=await import(url(brandSource));
test("brand identity matches each deployment",()=>{
 const cases=[
  [{}, "Robotronix™ Learning Portal","/"],
  [{PRODUCT_MODE:"portal"},"Robotronix™ Learning Portal","/"],
  [{PRODUCT_MODE:"crm"},"Robotronix Connect CRM","/connect"],
  [{PRODUCT_MODE:"tasks"},"My Tasks","/tasks"],
  [{PRODUCT_MODE:"combined"},"Robotronix Workspace","/"],
  [{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"crm,tasks",ENABLED_INTEGRATIONS:"crmTasks"},"Robotronix Workspace","/"],
  [{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"crm"},"Robotronix Connect CRM","/connect"]
 ];
 for(const [env,title,landing] of cases){
  const brand=getProductBrand(env);
  assert.equal(brand.appName,title);
  assert.equal(brand.landing,landing);
  assert.ok(brand.description.length>20);
 }
});
test("navigation is based on signed-in access, never hard-coded three-product links",()=>{
 const sw=fs.readFileSync("components/ApplicationSwitcher.tsx","utf8");
 const hook=fs.readFileSync("lib/platform/use-authorized-products.ts","utf8");
 const route=fs.readFileSync("app/api/platform/my-products/route.ts","utf8");
 assert.match(sw,/useAuthorizedProducts\(/);
 assert.match(sw,/products\.length<2/);
 assert.match(sw,/product\.href/);
 assert.match(hook,/Authorization:"Bearer "/);
 assert.match(hook,/response\.ok/);
 assert.match(route,/auth\.getUser\(token\)/);
 assert.match(route,/connect_my_workspaces/);
 assert.match(route,/task_account_get/);
 assert.match(route,/from\("profiles"\)/);
 assert.match(route,/portalDestination\(profile\.role\)/);
 assert.doesNotMatch(sw,/href="\/admin"|href="\/connect"|href="\/tasks"/);
});
test("Portal role menus hide unauthorized Tasks shortcut, CRM switcher stays conditional",()=>{
 const portal=fs.readFileSync("components/AppShell.tsx","utf8");
 const crm=fs.readFileSync("features/connect/ConnectSidebar.tsx","utf8");
 assert.match(portal,/authorizedProducts\.some\(product=>product\.id==="tasks"\)/);
 assert.match(portal,/item\.href!=="\/tasks"\|\|hasTasksAccess/);
 assert.match(crm,/<ApplicationSwitcher current="connect"\/>/);
 assert.doesNotMatch(crm,/canOpenPortal&&<ApplicationSwitcher/);
});
test("standalone Tasks connected view does not unconditionally query Portal profile",()=>{
 const connected=fs.readFileSync("features/tasks/v2/TasksV2Connected.tsx","utf8");
 assert.match(connected,/config\.products\.includes\("portal"\)/);
 assert.match(connected,/config\.integrations\.includes\("portalTasks"\)/);
 assert.match(connected,/import\("@\/lib\/repository"\)/);
});
test("capability navigation endpoint is allowed in all deployment modes",async()=>{
 const {resolveDeploymentConfig,isRouteAvailable}=await import(deployment);
 for(const env of [{},{PRODUCT_MODE:"crm"},{PRODUCT_MODE:"tasks"},{PRODUCT_MODE:"portal"}]){
  assert.equal(isRouteAvailable(resolveDeploymentConfig(env),"/api/platform/my-products"),true);
 }
});
