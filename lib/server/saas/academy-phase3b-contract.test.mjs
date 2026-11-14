import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync("app/saas/academy/page.tsx","utf8");
const report=fs.readFileSync("database/saas/13_academy_ownership_preflight_readonly.sql","utf8");
test("Academy organization switching invalidates stale data before loading new tenant",()=>{
 assert.match(page,/generation\.current\+\+/);
 assert.match(page,/requestedGeneration===generation\.current/);
 assert.match(page,/setRows\(empty\)/);
 assert.match(page,/setDraft\(\{\}\)/);
});
test("Academy ownership preflight never performs destructive SQL",()=>{
 assert.match(report,/saas\.academy_courses/);
 assert.match(report,/WHERE l\.course_id IS NULL/);
 assert.doesNotMatch(report,/\b(?:DELETE|DROP|TRUNCATE|UPDATE|INSERT)\s+(?:FROM\s+|INTO\s+)?(?:public|saas)\./i);
});
