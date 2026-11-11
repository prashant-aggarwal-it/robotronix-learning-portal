import test from "node:test";
import assert from "node:assert/strict";
import {resolveDeploymentConfig,routeRequirement,isRouteAvailable,defaultProductPath} from "./deployment.ts";

const config=env=>resolveDeploymentConfig(env);
const cases=[
  {env:{PRODUCT_MODE:"portal"},products:["portal"],integrations:[],pass:["/","/admin","/api/zoom/hosts","/api/health"],block:["/connect","/tasks","/api/tasks","/api/connect/workspaces"]},
  {env:{PRODUCT_MODE:"crm"},products:["crm"],integrations:[],pass:["/connect","/api/connect/workspaces","/api/health","/login"],block:["/admin","/tasks","/api/tasks","/api/connect/workspaces/123/admissions","/api/connect/jobs/reminders"]},
  {env:{PRODUCT_MODE:"tasks"},products:["tasks"],integrations:[],pass:["/tasks","/tasks/planner","/api/tasks","/api/tasks/v2/board","/api/health"],block:["/connect","/admin","/api/tasks/module-links","/tasks/connected"]},
  {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"crm,tasks",ENABLED_INTEGRATIONS:"crmTasks"},products:["crm","tasks"],integrations:["crmTasks"],pass:["/connect","/tasks","/api/tasks/module-links","/tasks/connected"],block:["/admin","/api/connect/workspaces/123/admissions","/api/zoom/hosts"]},
  {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,crm",ENABLED_INTEGRATIONS:"crmPortal"},products:["portal","crm"],integrations:["crmPortal"],pass:["/admin","/connect","/api/connect/workspaces/id/portal-demos","/api/connect/workspaces/id/lifecycle","/api/connect/jobs/reminders"],block:["/tasks","/api/tasks/module-links"]},
  {env:{PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,tasks",ENABLED_INTEGRATIONS:"portalTasks"},products:["portal","tasks"],integrations:["portalTasks"],pass:["/admin","/tasks"],block:["/connect","/api/tasks/module-links","/api/connect/workspaces/id/admissions"]},
  {env:{PRODUCT_MODE:"combined",ENABLED_INTEGRATIONS:"crmPortal,crmTasks,portalTasks"},products:["portal","crm","tasks"],integrations:["crmPortal","crmTasks","portalTasks"],pass:["/connect","/admin","/tasks","/tasks/connected","/api/connect/workspaces/id/admissions"],block:[]}
];
for(const item of cases){
  test("mode "+JSON.stringify(item.env),()=>{
    const d=config(item.env);
    assert.deepEqual(d.products,item.products);
    assert.deepEqual(d.integrations,item.integrations);
    for(const path of item.pass)assert.equal(isRouteAvailable(d,path),true,path+" should pass");
    for(const path of item.block)assert.equal(isRouteAvailable(d,path),false,path+" should be blocked");
  });
}
test("unconfigured deployment preserves current combined route surface",()=>{
  const d=config({});
  assert.equal(d.mode,"combined");
  assert.equal(d.legacyDefault,true);
  assert.deepEqual(d.products,["portal","crm","tasks"]);
  assert.deepEqual(d.integrations,["crmPortal","crmTasks","portalTasks"]);
  assert.equal(isRouteAvailable(d,"/api/connect/workspaces/id/admissions"),true);
});
test("explicit combined does not silently enable integrations",()=>{
  const d=config({PRODUCT_MODE:"combined"});
  assert.deepEqual(d.integrations,[]);
  assert.equal(isRouteAvailable(d,"/api/connect/workspaces/id/admissions"),false);
});
test("case-sensitive, route-aware matching",()=>{
  assert.equal(routeRequirement("/api/connect/workspaces/x/portal-integration"),"crmPortal");
  assert.equal(routeRequirement("/api/connect/workspaces/x/contacts/directory"),"crm");
  assert.equal(routeRequirement("/api/tasks/module-links"),"crmTasks");
  assert.equal(routeRequirement("/api/zoom/meetings"),"portal");
  assert.equal(routeRequirement("/login"),"shared");
  assert.equal(routeRequirement("/auth/callback"),"shared");
});
test("redirect target determined only from enabled products",()=>{
  assert.equal(defaultProductPath(config({PRODUCT_MODE:"crm"})),"/connect");
  assert.equal(defaultProductPath(config({PRODUCT_MODE:"tasks"})),"/tasks");
  assert.equal(defaultProductPath(config({PRODUCT_MODE:"portal"})),"/");
});
for(const invalid of [
  {PRODUCT_MODE:"invalid"},
  {PRODUCT_MODE:"CRM"},
  {PRODUCT_MODE:"portal",ENABLED_PRODUCTS:"crm"},
  {PRODUCT_MODE:"crm",ENABLED_INTEGRATIONS:"crmPortal"},
  {PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"tasks",ENABLED_INTEGRATIONS:"crmTasks"},
  {PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,portal"},
  {PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,"},
  {PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"   "},
  {PRODUCT_MODE:"combined",ENABLED_INTEGRATIONS:"   "},
  {PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"other"},
  {PRODUCT_MODE:"combined",ENABLED_INTEGRATIONS:"unexpected"},
  {PRODUCT_MODE:"combined",ENABLED_INTEGRATIONS:"crmTasks,crmTasks"}
]){
  test("fail closed on invalid env "+JSON.stringify(invalid),()=>assert.throws(()=>config(invalid)));
}
