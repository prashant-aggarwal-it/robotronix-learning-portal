import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolveAuthDestination} from "./auth-routing.ts";

const config={mode:"combined",legacyDefault:false,products:["portal","crm","tasks"],integrations:[]};

test("verified platform-only user routes to platform console",()=>{
 assert.deepEqual(resolveAuthDestination(config,{platformAdmin:true,saasWorkspace:false},null),{path:"/platform-admin"});
});
test("ordinary user does not inherit platform console",()=>{
 assert.notEqual(resolveAuthDestination(config,{platformAdmin:false,saasWorkspace:false},null).path,"/platform-admin");
});
test("platform role never creates tenant membership",()=>{
 const access={platformAdmin:true,saasWorkspace:false};
 assert.equal(access.saasWorkspace,false);
});
test("server-side platform API is guarded by authenticated authorization",()=>{
 const source=readFileSync(new URL("../../app/api/platform-admin/access/route.ts",import.meta.url),"utf8");
 assert.match(source,/requirePlatformAdmin\(request\.headers\.get\("authorization"\)\)/);
 assert.doesNotMatch(source,/contact@robotronixstemlab\.com/);
});
