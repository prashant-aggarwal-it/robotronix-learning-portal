import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const path="app/api/platform/organizations/[organizationId]/members/route.ts";
const code=fs.readFileSync(path,"utf8");
test("membership API validator accepts canonical 8-4-4-4-12 UUID",()=>{
 const literal=code.match(/const uuid=(\/\^[^\n]+\/i);/)?.[1];
 assert.ok(literal,"UUID validation expression must remain present");
 const match=literal.match(/^\/\^([^/]+)\$\/i$/);
 assert.ok(match);
 const uuid=new RegExp("^"+match[1]+"$","i");
 assert.equal(uuid.test("a92ec51d-fc2c-45cd-ba7a-b3386922e1b3"),true);
 assert.equal(uuid.test("00000000-0000-4000-8000-000000000001"),true);
 assert.equal(uuid.test("a92ec51d-fc2c-45cd-b3386922e1b3"),false);
 assert.equal(uuid.test("not-a-uuid"),false);
});
