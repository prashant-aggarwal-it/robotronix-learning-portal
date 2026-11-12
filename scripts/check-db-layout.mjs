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
