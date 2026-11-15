import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Import through TypeScript stripping when the task QA script is run with Node.
const source=readFileSync(new URL("./validation.ts",import.meta.url),"utf8");
test("task input validation has an explicit field allowlist",()=>{
 assert.match(source,/const allowed=new Set/);
 assert.doesNotMatch(source,/owner_user_id/);
});
test("task API enforces owner scoping",()=>{
 const routes=["../../../app/api/tasks/route.ts","../../../app/api/tasks/[id]/route.ts","../../../app/api/tasks/categories/route.ts"];
 for(const route of routes){
  const content=readFileSync(new URL(route,import.meta.url),"utf8");
  assert.match(content,/task_(list|create|update|archive|categories_list|category_create)/);
  assert.match(content,/taskSession/);
 }
});
test("private canonical Tasks schema enables RLS and revokes direct client access",()=>{
 const schema=readFileSync(new URL("../../../database/tasks/01_schema.sql",import.meta.url),"utf8");
 const security=readFileSync(new URL("../../../database/tasks/03_security.sql",import.meta.url),"utf8");
 assert.match(schema,/REVOKE ALL ON SCHEMA tasks FROM PUBLIC, anon, authenticated/i);
 for(const table of ["categories","items","user_preferences"]){
  assert.match(schema,new RegExp('CREATE TABLE tasks\\."?'+table+'"?\\s*\\(','i'),table+" declared");
 }
 for(const text of [schema,security]){
  assert.match(text,/nspname\s*=\s*'tasks'/i);
  assert.match(text,/format\('ALTER TABLE tasks\.%I ENABLE ROW LEVEL SECURITY'/i);
  assert.match(text,/format\('REVOKE ALL ON TABLE tasks\.%I FROM PUBLIC,anon,authenticated'/i);
 }
});
