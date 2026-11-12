// Active database layout guard. No Supabase connection and no data changes.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const db=path.join(root,'database');
const required=[
 'README.md','packages.json','portal/manifest.json','portal/verify.sql',
 'portal/first_admin_example.sql','tasks/01_schema.sql','tasks/02_functions.sql',
 'tasks/03_security.sql','tasks/04_verify.sql','crm/01_schema.sql',
 'crm/02_functions.sql','crm/03_security.sql','crm/04_verify.sql',
 'shared/preflight.sql','shared/DEV_RESET_APP_SCHEMAS.sql'
];
const retired=['01_install','02_qa','03_verify','99_dev_tools','canonical','integrations'];
const errors=[];
for(const name of required)if(!fs.existsSync(path.join(db,name)))errors.push('Required current DB source missing: '+name);
for(const name of retired)if(fs.existsSync(path.join(db,name)))errors.push('Retired DB root folder still exists: '+name);
// Application roots contain only final source files, not historical phase migrations.
const allowedRootSql={
 tasks:new Set(['01_schema.sql','02_functions.sql','03_security.sql','04_verify.sql']),
 crm:new Set(['01_schema.sql','02_functions.sql','03_security.sql','04_verify.sql']),
 portal:new Set(['verify.sql','first_admin_example.sql'])
};
for(const [app,allowed] of Object.entries(allowedRootSql)){
 const names=fs.readdirSync(path.join(db,app)).filter(name=>name.endsWith('.sql'));
 for(const name of names)if(!allowed.has(name))errors.push('Unexpected non-canonical SQL in '+app+'/: '+name);
}
const portalSchema=fs.readdirSync(path.join(db,'portal/schema')).filter(name=>name.endsWith('.sql')).sort();
if(portalSchema.length!==13||portalSchema.some((name,i)=>Number(name.slice(0,2))!==i+1))
 errors.push('Portal schema files must have unique sequential 01–13 prefixes');
const scriptsDir=path.join(root,'scripts');
const oldPrefix=/database\/(?:01_install|02_qa|03_verify|99_dev_tools|canonical|integrations)\//g;
for(const file of fs.readdirSync(scriptsDir).filter(name=>/^(?:check-|build-).*\.mjs$/.test(name))){
 const content=fs.readFileSync(path.join(scriptsDir,file),'utf8');
 if(oldPrefix.test(content))errors.push('Stale DB path in '+file);
 oldPrefix.lastIndex=0;
}
if(errors.length){
 for(const issue of errors)console.error('FAIL '+issue);
 process.exitCode=1;
}else console.log('PASS application-based database layout, required source files and script paths');
