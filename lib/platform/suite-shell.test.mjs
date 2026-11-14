import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=path=>fs.readFileSync(path,"utf8");
test("all existing module headers share Suite identity without nesting duplicate shells",()=>{
 assert.match(source("components/AppShell.tsx"),/<SuiteContextLink module="portal"\/>/);
 assert.match(source("features/connect/ConnectTopbar.tsx"),/<SuiteContextLink module="crm"\/>/);
 assert.match(source("features/tasks/v2/TasksV2Dashboard.tsx"),/<SuiteContextLink module="tasks"\/>/);
});
test("organization switching is server authorized and reloads module-owned state",()=>{
 const sw=source("components/SuiteOrganizationSwitcher.tsx");
 assert.match(sw,/api\/platform\/organizations/);
 assert.match(sw,/Authorization.*Bearer/);
 assert.match(sw,/window\.location\.reload\(\)/);
 assert.doesNotMatch(sw,/localStorage\.setItem/);
});
test("suite discovery fails closed on unverified SaaS organization scope",()=>{
 const page=source("app/suite/page.tsx");
 assert.match(page,/organizationUnavailable/);
 assert.match(page,/!organizationUnavailable/);
 assert.match(page,/organization-modules/);
 assert.match(page,/my-products/);
});

test("Admin keeps existing routes within accessible collapsible work groups",()=>{
 const portal=source("components/AppShell.tsx");
 assert.match(portal,/suiteNavSection/);
 assert.match(portal,/<summary className="navGroupLabel">/);
 assert.match(portal,/navByRole\.admin\.filter/);
 for(const href of ["/admin/students","/admin/courses","/admin/enrollments","/admin/finance","/admin/trainer-finance","/admin/notifications"]){
  assert.ok(portal.includes('href:"'+href+'"'),"Missing retained Admin route "+href);
 }
});
