// Validate the FINAL-STATE schema package without connecting to any database.
// This does not replace an isolated clean-install execution test.
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd(),"database/canonical");
const files={
 tasksSchema:"02_tasks_schema.sql",
 crmSchema:"03_crm_schema.sql",
 tasksFunctions:"04_tasks_functions.sql",
 crmFunctions:"05_crm_functions.sql",
 security:"06_triggers_security.sql"
};
function read(name){return fs.readFileSync(path.join(root,files[name]),"utf8")}
const src=Object.fromEntries(Object.keys(files).map(k=>[k,read(k)]));
const schema=src.tasksSchema+"\n"+src.crmSchema;
const functions=src.tasksFunctions+"\n"+src.crmFunctions;
const security=src.security;
let failed=0;
function check(label,actual,expected){const ok=actual===expected;console.log((ok?"PASS":"FAIL")+" "+label+": "+actual+" (expected "+expected+")");if(!ok)failed++;}
function matches(source,re){return [...source.matchAll(re)]}
check("Tasks tables",matches(src.tasksSchema,/^CREATE TABLE tasks\\.\"[^\"]+\" \\(/gm).length,21);
check("CRM tables",matches(src.crmSchema,/^CREATE TABLE connect\\.\"[^\"]+\" \\(/gm).length,66);
check("Foreign keys",matches(schema,/^ALTER TABLE (?:tasks|connect)\\.\"[^\"]+\" ADD CONSTRAINT /gm).length,172);
check("Explicit indexes",matches(schema,/^CREATE (?:UNIQUE )?INDEX /gm).length,82);
check("Functions",matches(functions,/^CREATE (?:OR REPLACE )?FUNCTION /gm).length,150);
check("Module triggers",matches(security,/^CREATE TRIGGER /gm).length,11);
check("RLS policies",matches(security,/^CREATE POLICY /gm).length,15);
const fnNames=matches(functions,/^CREATE (?:OR REPLACE )?FUNCTION (?:public|tasks|connect)\\.([a-z_0-9]+)/gmi).map(m=>m[1]);
check("Function definitions without duplicate names",new Set(fnNames).size,fnNames.length);
for(const [name,text] of Object.entries(src)){
  if(/\\bALTER TABLE\\s+[^;]*\\bADD COLUMN\\b/i.test(text)) {console.error("FAIL historical column patch in "+name);failed++}
  if(/\\b(?:DROP TABLE|TRUNCATE TABLE|cron\\.schedule)\\b/i.test(text)) {console.error("FAIL destructive/job statement in "+name);failed++}
  if(/\\bJOIN auth\\.users\\b/i.test(text)) {console.error("FAIL direct Auth table join in "+name);failed++}
  if(!/^BEGIN;/m.test(text)||!/^COMMIT;/m.test(text)){console.error("FAIL missing transaction boundary "+name);failed++}
}
if(failed){console.error("Canonical SQL checks FAILED: "+failed);process.exit(1)}
console.log("Canonical SQL structural checks PASS. A clean-database install test is still required.");
