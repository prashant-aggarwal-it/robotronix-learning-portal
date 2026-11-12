// Static guard for independently installable Tasks and CRM core SQL.
// Full disposable-environment SQL execution is still required for release certification.
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd(),"database");
const names={
 tasksSchema:"tasks/01_schema.sql",
 crmSchema:"crm/01_schema.sql",
 tasksFunctions:"tasks/02_functions.sql",
 crmFunctions:"crm/02_functions.sql",
 tasksSecurity:"tasks/03_security.sql",
 crmSecurity:"crm/03_security.sql",
 crmPortal:"shared/integrations/01_crm_portal.sql",
 tasksCrm:"shared/integrations/02_tasks_crm.sql",
 tasksCrmLinks:"shared/integrations/03_tasks_crm_links.sql",
 tasksPortal:"shared/integrations/04_tasks_portal_notifications.sql",
 fullSuite:"shared/integrations/05_full_suite_task_links.sql",
 portalTasksLinks:"shared/integrations/06_tasks_portal_links.sql"
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
// V2 coverage guard: historical phased scripts are archived, and these objects
// must continue to exist in the one-shot canonical Tasks sources.
const requiredV2Functions=[
 "task_v2_areas_list","task_v2_area_save","task_v2_projects_list",
 "task_v2_project_save","task_v2_patch","task_v2_capture","task_v2_board_move",
 "task_v2_detail_save","task_v2_board_list","task_v2_focus_get",
 "task_v2_focus_action","task_v2_idea_action","task_v2_focus_settings_save",
 "task_v2_commitment_save","task_v2_plan_move","task_v2_matrix_set"
];
const requiredV2Tables=["areas","projects","focus_sessions","parked_ideas","focus_settings","focus_commitments"];
const requiredV2ItemColumns=[
 "scheduled_date","someday","reschedule_count","urgent","important",
 "area_id","project_id","focus_date","focus_rank","board_rank",
 "estimated_minutes","done_definition"
];
for(const name of requiredV2Functions)
 if(!new RegExp("CREATE OR REPLACE FUNCTION public\\."+name+"\\s*\\(","i").test(sql.tasksFunctions)){
  console.error("FAIL V2 function absent from canonical Tasks: "+name);failures++;
 }
for(const name of requiredV2Tables)
 if(!sql.tasksSchema.includes('CREATE TABLE tasks."'+name+'"')){
  console.error("FAIL V2 table absent from canonical Tasks: "+name);failures++;
 }
for(const column of requiredV2ItemColumns)
 if(!sql.tasksSchema.includes('"'+column+'"')){
  console.error("FAIL V2 item column absent from canonical Tasks: "+column);failures++;
 }
if(!sql.tasksFunctions.includes("tasks.v2_inherit_recurring_context")||
   !sql.tasksSecurity.includes("tasks_v2_inherit_recurring_context")){
 console.error("FAIL V2 recurrence context function/trigger absent");failures++;
}
if(!failures)console.log("PASS Tasks V2 canonical object coverage (historical 10-25 scripts not required)");

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
