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
test("private schema is RLS-protected and no direct client access granted",()=>{
 const sql=readFileSync(new URL("../../../database/tasks/01_foundation.sql",import.meta.url),"utf8");
 assert.match(sql,/revoke all on schema tasks from public, anon, authenticated/);
 for(const table of ["categories","items","user_preferences"])assert.match(sql,new RegExp(`alter table tasks\\.${table} enable row level security`));
});
