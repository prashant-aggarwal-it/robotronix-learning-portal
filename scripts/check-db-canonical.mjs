// Static guard for independently installable Tasks and CRM core SQL.
// Full disposable-environment SQL execution is still required for release certification.
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd(),"database");
const names={
 tasksSchema:"canonical/02_tasks_schema.sql",
 crmSchema:"canonical/03_crm_schema.sql",
 tasksFunctions:"canonical/04_tasks_functions.sql",
 crmFunctions:"canonical/05_crm_functions.sql",
 tasksSecurity:"canonical/06_tasks_security.sql",
 crmSecurity:"canonical/07_crm_security.sql",
 crmPortal:"integrations/01_crm_portal.sql",
 tasksCrm:"integrations/02_tasks_crm.sql",
 tasksCrmLinks:"integrations/03_tasks_crm_links.sql",
 tasksPortal:"integrations/04_tasks_portal_notifications.sql",
 fullSuite:"integrations/05_full_suite_task_links.sql",
 portalTasksLinks:"integrations/06_tasks_portal_links.sql"
};
const sql=Object.fromEntries(Object.entries(names).map(([key,file])=>[key,fs.readFileSync(path.join(root,file),"utf8")]));
let failures=0;
function assertCount(label,actual,expected){
 const ok=actual===expected;
 console.log((ok?"PASS ":"FAIL ")+label+": "+actual+" (expected "+expected+")");
 if(!ok)failures++;
}
function assertNo(label,value,rx){
 if(rx.test(value)){console.error("FAIL "+label);failures++;}
 else console.log("PASS "+label);
}
const count=(value,rx)=>[...value.matchAll(rx)].length;
// SQL-language functions are validated at CREATE time. Their referenced helper
// functions must be defined earlier in the same fresh-install script.
function assertSqlFunctionOrder(label, source) {
 const declarations=[...source.matchAll(/^CREATE (?:OR REPLACE )?FUNCTION\s+((?:public|tasks|connect)\.[a-z_0-9]+)\s*\(/gmi)]
  .map(match=>({name:match[1].toLowerCase(),start:match.index}));
 const positions=new Map(declarations.map((item,index)=>[item.name,index]));
 const errors=[];
 for(let i=0;i<declarations.length;i++){
  const body=source.slice(declarations[i].start,i+1<declarations.length?declarations[i+1].start:source.length);
  if(!/\bLANGUAGE\s+sql\b/i.test(body))continue;
  const functionBody=body.match(/\bAS\s+(\$[a-z_0-9]*\$)([\s\S]*?)\1\s*;/i)?.[2] ?? body;
  const refs=[...functionBody.matchAll(/\b(?:public|tasks|connect)\.[a-z_0-9]+(?=\s*\()/gi)];
  for(const ref of refs){
   const name=ref[0].toLowerCase();
   if(positions.has(name)&&positions.get(name)>i)errors.push(declarations[i].name+" requires later "+name);
  }
 }
 if(errors.length){console.error("FAIL "+label+": "+errors.join("; "));failures++;}
 else console.log("PASS "+label);
}
function assertCompletePolicies(label,source){
 const statements=source.split("\n").filter(line=>/^CREATE POLICY /i.test(line));
 const incomplete=statements.filter(line=>!line.trimEnd().endsWith(";"));
 if(incomplete.length){console.error("FAIL "+label+": "+incomplete.length+" incomplete CREATE POLICY statement(s)");failures++;}
 else console.log("PASS "+label);
}
assertSqlFunctionOrder("Tasks SQL-language helper creation order",sql.tasksFunctions);
assertSqlFunctionOrder("CRM SQL-language helper creation order",sql.crmFunctions);
assertCompletePolicies("Tasks security policy statement completeness",sql.tasksSecurity);
assertCount("Tasks tables",count(sql.tasksSchema,/^CREATE TABLE tasks\."[^"]+" \(/gm),21);
assertCount("CRM tables",count(sql.crmSchema,/^CREATE TABLE connect\."[^"]+" \(/gm),66);
assertCount("All module FKs",count(sql.tasksSchema+"\n"+sql.crmSchema,/^ALTER TABLE (?:tasks|connect)\."[^"]+" ADD CONSTRAINT /gm),172);
assertCount("All explicit indexes",count(sql.tasksSchema+"\n"+sql.crmSchema,/^CREATE (?:UNIQUE )?INDEX /gm),82);
assertCount("Core Tasks functions",count(sql.tasksFunctions,/^CREATE (?:OR REPLACE )?FUNCTION /gm),60);
assertCount("Core CRM functions",count(sql.crmFunctions,/^CREATE (?:OR REPLACE )?FUNCTION /gm),76);
assertCount("Optional CRM/Portal functions",count(sql.crmPortal,/^CREATE (?:OR REPLACE )?FUNCTION /gm),10);
assertCount("Optional Tasks/CRM sync functions",count(sql.tasksCrm,/^CREATE (?:OR REPLACE )?FUNCTION /gm),2);
assertCount("CRM+Tasks-only task link functions",count(sql.tasksCrmLinks,/^CREATE (?:OR REPLACE )?FUNCTION /gm),2);
assertCount("Full-suite task link functions",count(sql.fullSuite,/^CREATE (?:OR REPLACE )?FUNCTION /gm),2);
assertCount("Portal+Tasks-only task link functions",count(sql.portalTasksLinks,/^CREATE (?:OR REPLACE )?FUNCTION /gm),2);
assertCount("Tasks triggers",count(sql.tasksSecurity,/^CREATE TRIGGER /gm),3);
assertCount("CRM triggers",count(sql.crmSecurity,/^CREATE TRIGGER /gm),5);
assertCount("Tasks policies",count(sql.tasksSecurity,/^CREATE POLICY /gm),15);
assertCount("CRM policies",count(sql.crmSecurity,/^CREATE POLICY /gm),0);
assertCount("Optional integration triggers",count(sql.crmPortal+"\n"+sql.tasksCrm+"\n"+sql.tasksPortal,/^CREATE TRIGGER /gm),4);
const tableRef=/(?:\b(?:from|join|update|into)\s+|\breferences\s+)(?:public|connect|tasks)\.[a-z_0-9]+/gi;
assertNo("Tasks core does not read CRM/Portal tables",sql.tasksFunctions,/\b(?:from|join|update|into)\s+(?:connect\.|public\.(?:profiles|portal_notifications|schedule_events|trainers|onboarding_submissions))/i);
assertNo("CRM core does not read Tasks/Portal tables",sql.crmFunctions,/\b(?:from|join|update|into)\s+(?:tasks\.|public\.(?:profiles|portal_notifications|schedule_events|trainers|onboarding_submissions|demo_session_participants))/i);
assertNo("Tasks schema has no cross-product FK",sql.tasksSchema,/\bREFERENCES\s+(?:connect\.|public\.)/i);
assertNo("CRM schema has no cross-product FK",sql.crmSchema,/\bREFERENCES\s+(?:tasks\.|public\.)/i);
for(const [name,value] of Object.entries(sql)){
 assertNo(name+" has no historical table patches",value,/\bALTER TABLE\s+[^;]*\bADD COLUMN\b/i);
 assertNo(name+" has no destructive reset or recurring job",value,/\b(?:DROP TABLE|TRUNCATE TABLE|cron\.schedule)\b/i);
 assertNo(name+" has no direct auth.users SELECT",value,/\b(?:from|join)\s+auth\.users\b/i);
 if(!/^BEGIN;/m.test(value)||!/^COMMIT;/m.test(value)){console.error("FAIL missing transaction for "+name);failures++;}
}
const coreNames=[...((sql.tasksFunctions+"\n"+sql.crmFunctions).matchAll(/^CREATE (?:OR REPLACE )?FUNCTION (?:public|tasks|connect)\.([a-z_0-9]+)/gmi))].map(m=>m[1]);
assertCount("Unique core function names",new Set(coreNames).size,coreNames.length);
if(failures){console.error("Canonical SQL checks FAILED: "+failures);process.exit(1);}
console.log("Core module isolation checks PASS. Clean install and application end-to-end tests remain necessary.");
