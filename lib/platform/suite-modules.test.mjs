import test from "node:test";
import assert from "node:assert/strict";
import {suiteModules,suiteModuleById,routeMatches} from "./suite-modules.ts";

test("one unique registry entry for each installed core product",()=>{
 assert.deepEqual(suiteModules.map(x=>x.id),["portal","crm","tasks"]);
 assert.equal(new Set(suiteModules.map(x=>x.id)).size,suiteModules.length);
 for(const m of suiteModules){
  assert.ok(m.label&&m.href.startsWith("/")&&m.entitlement);
  assert.equal(new Set(m.navigation.map(n=>n.href)).size,m.navigation.length);
 }
});
test("nested route matching never confuses sibling modules",()=>{
 assert.equal(routeMatches("/admin/students/123","/admin/students"),true);
 assert.equal(routeMatches("/admin/students-other","/admin/students"),false);
 assert.equal(routeMatches("/connect","/admin"),false);
 assert.equal(suiteModuleById("tasks").entitlement,"tasks");
});
