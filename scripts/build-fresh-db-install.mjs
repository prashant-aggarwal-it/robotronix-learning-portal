import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const modulesRoot = path.join(root,'database/01_install/modules');
const targetPath = path.join(root,'database/generated/ROBOTRONIX_FRESH_INSTALL.sql');

function loadModules(group){
 const dir=path.join(modulesRoot,group);
 const files=fs.readdirSync(dir).filter(file=>/^\d\d_[a-z0-9_]+\.sql$/.test(file)).sort();
 if(!files.length)throw new Error('No canonical '+group+' SQL modules found.');
 const combined=files.map(file=>{
  const content=fs.readFileSync(path.join(dir,file),'utf8');
  if(!content.trim())throw new Error('Empty SQL module: '+file);
  return content;
 }).join('');
 return {files,combined};
}
const schema=loadModules('schema');
const reference=loadModules('reference');
const header=[
 '-- ROBOTRONIX FRESH INSTALL — GENERATED; EMPTY SUPABASE PROJECTS ONLY.',
 '-- DO NOT run this on an existing database. Backup and migration plans are separate.',
 '-- Canonical ordered sources: database/01_install/modules/schema and modules/reference.',
 '-- Schema modules retain their sequential execution order and dependencies.',
 '',
 '-- PART 1: SCHEMA',
].join('\n');
const output=header+'\n'+schema.combined+'\n-- PART 2: REFERENCE DATA\n'+reference.combined+'\n';
fs.mkdirSync(path.dirname(targetPath),{recursive:true});
fs.writeFileSync(targetPath,output,'utf8');
if(fs.readFileSync(targetPath,'utf8')!==output)throw new Error('Fresh SQL generation mismatch.');
console.log('Generated '+path.relative(root,targetPath)+' from '+schema.files.length+' schema and '+reference.files.length+' reference modules.');
