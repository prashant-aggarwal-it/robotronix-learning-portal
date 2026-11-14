#!/usr/bin/env node
// Release 1 schema and package preflight. Does not access Supabase or modify databases.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const fail=[];
const out=path.resolve(process.argv[2]||'artifacts/release1-certification');
fs.mkdirSync(out,{recursive:true});
const packages=JSON.parse(fs.readFileSync('database/packages.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('database/portal/manifest.json','utf8'));
const snapshot=JSON.parse(fs.readFileSync('database/audit/dev_catalog_snapshot.json','utf8'));
const checked=[];
function checkPath(relative){
 const safe=!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..');
 const absolute=path.join(root,'database',relative);
 const exists=safe&&fs.existsSync(absolute)&&fs.statSync(absolute).isFile();
 checked.push({file:relative,exists});
 if(!exists)fail.push('Missing or unsafe canonical file: '+relative);
 return exists;
}
for(const [name,items] of Object.entries(packages.packages)){
 if(!Array.isArray(items)||!items.length){fail.push('Empty package: '+name);continue}
 for(const item of items){
  if(item==='portal/manifest.json'){for(const file of [...manifest.schema,...manifest.reference])checkPath(file)}
  else checkPath(item);
 }
}
if(packages.rules?.productionExecutionAllowed!==false)fail.push('Production execution must stay disabled before certification');
if(packages.status!=='static-validation-only-not-clean-install-certified')fail.push('Uncertified installer status must remain explicit');
const entries=packages.packages['full-suite'];
for(const required of ['portal/manifest.json','crm/01_schema.sql','tasks/01_schema.sql','shared/integrations/01_crm_portal.sql','shared/integrations/05_full_suite_task_links.sql']){
 if(!entries.includes(required))fail.push('Full-suite package missing required component '+required);
}
const snapshotTables=new Set(snapshot.tables.map(x=>x.schema+'.'+x.name));
const required=['public.profiles','public.students','public.enrollments','public.schedule_events','public.student_invoices','public.student_fee_payments','public.trainer_earnings','connect.tenants','connect.memberships','connect.opportunities','tasks.items','tasks.module_links'];
for(const table of required)if(!snapshotTables.has(table))fail.push('DEV baseline missing required table '+table);
const totals={packageCount:Object.keys(packages.packages).length,sourceFileChecks:checked.length,uniqueFileChecks:new Set(checked.map(x=>x.file)).size,baselineTables:snapshotTables.size,baselineColumns:snapshot.tables.length,failures:fail.length};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({totals,failures:fail,limits:['Manifest/source existence only: SQL execution order, clean installation, object equivalence and runtime RLS remain untested','Do not execute against existing DEV or production']},null,2)+'\n');
console.log(JSON.stringify(totals));if(fail.length){console.error(fail.join('\n'));process.exitCode=1}
