import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Bundle two pure TS modules in memory for Node 22 tests without introducing
// an extra production runtime/test dependency or changing Next.js imports.
const compile=source=>ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const asUrl=source=>"data:text/javascript;base64,"+Buffer.from(compile(source)).toString("base64");
const deploymentUrl=asUrl(fs.readFileSync("lib/platform/deployment.ts","utf8"));
const routing=fs.readFileSync("lib/platform/auth-routing.ts","utf8")
 .replace('from "./deployment"','from "'+deploymentUrl+'"');
const {resolveDeploymentConfig}=await import(deploymentUrl);
const {safeAuthNext,resolveAuthDestination}=await import(asUrl(routing));
const config=env=>resolveDeploymentConfig(env);

test("Tasks-only users have independent onboarding and suspension routes",()=>{
 const c=config({PRODUCT_MODE:"tasks"});
 assert.deepEqual(resolveAuthDestination(c,{tasks:"active"},"/tasks"),{path:"/tasks"});
 assert.deepEqual(resolveAuthDestination(c,{tasks:"unlinked"},null),{path:"/tasks/welcome"});
 assert.match(resolveAuthDestination(c,{tasks:"suspended"},"/tasks").denied,/suspended/i);
 assert.equal(resolveAuthDestination(c,{tasks:"active"},"/connect").path,"/tasks");
});
test("CRM-only users never require a Portal account",()=>{
 const c=config({PRODUCT_MODE:"crm"});
 assert.equal(resolveAuthDestination(c,{crmWorkspace:true},"/connect").path,"/connect");
 assert.equal(resolveAuthDestination(c,{crmWorkspace:false},null).path,"/connect");
 assert.equal(safeAuthNext("/admin",c),null);
});
test("Portal-only users retain role and disabled account policy",()=>{
 const c=config({PRODUCT_MODE:"portal"});
 assert.equal(resolveAuthDestination(c,{portal:{state:"active",role:"trainer"}},null).path,"/trainer");
 assert.match(resolveAuthDestination(c,{portal:{state:"disabled"}},"/tasks").denied,/disabled/);
 assert.equal(resolveAuthDestination(c,{portal:{state:"unlinked"}},null).path,"/onboarding");
});
test("Explicit combined uses only installed modules and independent memberships",()=>{
 const c=config({PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"crm,tasks",ENABLED_INTEGRATIONS:"crmTasks"});
 assert.equal(resolveAuthDestination(c,{tasks:"active",crmWorkspace:true},"/connect").path,"/connect");
 assert.equal(resolveAuthDestination(c,{tasks:"active",crmWorkspace:false},null).path,"/tasks");
 assert.equal(resolveAuthDestination(c,{tasks:"unlinked",crmWorkspace:false},null).path,"/tasks/welcome");
 assert.equal(resolveAuthDestination(c,{tasks:"unlinked",crmWorkspace:false},"/connect").path,"/connect");
 assert.equal(resolveAuthDestination(c,{tasks:"unlinked",crmWorkspace:false},"/tasks").path,"/tasks/welcome");
});
test("Legacy Portal-first routing remains compatible with missing optional modules",()=>{
 const c=config({});
 assert.equal(resolveAuthDestination(c,{portal:{state:"active",role:"parent"}},null).path,"/parent");
 assert.match(resolveAuthDestination(c,{portal:{state:"disabled"}},null).denied,/disabled/);
 assert.match(resolveAuthDestination(c,{portal:{state:"unlinked"},tasks:"unlinked"},null).denied,/not linked/);
 assert.equal(resolveAuthDestination(c,{portal:{state:"unlinked"},tasks:"unlinked"},null,"callback").path,"/onboarding");
});
test("OAuth callback only honors exact allowed relative paths",()=>{
 const c=config({PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"portal,crm,tasks",ENABLED_INTEGRATIONS:"crmPortal,crmTasks,portalTasks"});
 for(const attack of ["https://evil.example","//evil.example","/%2f%2fevil","/tasks?next=//evil","/connect#x","/admin","/tasks\\evil","/tasks/../admin"]){
  assert.equal(safeAuthNext(attack,c),null,attack);
 }
 assert.equal(safeAuthNext("/connect",c),"/connect");
 assert.equal(safeAuthNext("/tasks/welcome",c),"/tasks/welcome");
 assert.equal(safeAuthNext("/zoom/connect",c),"/zoom/connect");
 assert.equal(resolveAuthDestination(c,{portal:{state:"active",role:"trainer"},crmWorkspace:false},"/zoom/connect").path,"/trainer");
 assert.equal(resolveAuthDestination(c,{portal:{state:"active",role:"admin"}},"/zoom/connect").path,"/zoom/connect");
});
test("Tasks API and onboarding depend on Portal profiles only in legacy branch",()=>{
 const auth=fs.readFileSync("lib/server/tasks/auth.ts","utf8");
 const onboarding=fs.readFileSync("app/api/tasks/onboarding/route.ts","utf8");
 assert.match(auth,/if\(deployment\.legacyDefault\)[\s\S]*?\.from\("profiles"\)/);
 assert.match(onboarding,/if\(deployment\.legacyDefault\)[\s\S]*?\.from\("profiles"\)/);
 assert.match(onboarding,/if\(resolveDeploymentConfig\(process\.env\)\.legacyDefault\)[\s\S]*?\.from\("profiles"\)/);
 assert.doesNotMatch(onboarding,/logSystemEvent|portal_system_logs/);
});

test("Standalone CRM registration is verified and workspace access is membership-scoped",()=>{
 const auth=fs.readFileSync("lib/server/connect-auth.ts","utf8");
 const login=fs.readFileSync("app/login/page.tsx","utf8");
 const crm=fs.readFileSync("app/connect/page.tsx","utf8");
 const entry=fs.readFileSync("app/api/connect/workspaces/route.ts","utf8");
 assert.match(auth,/!actorEmailVerified/);
 assert.match(auth,/admin\.auth\.getUser\(token\)/);
 assert.match(login,/canRegister/);
 assert.match(login,/createProductAccount\(email,password\)/);
 assert.match(crm,/onCreateWorkspace/);
 assert.match(crm,/onAcceptInvitation/);
 assert.match(entry,/connect_create_workspace/);
});
