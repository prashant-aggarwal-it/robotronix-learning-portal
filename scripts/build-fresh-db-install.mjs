// Build the Learning Portal's canonical fresh-install SQL from the explicit
// ordered source manifest. Source SQL remains in portal and is
// NEVER copied into other canonical packages.
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dbRoot=path.join(root,'database');
const manifest=JSON.parse(fs.readFileSync(path.join(dbRoot,'portal/manifest.json'),'utf8'));
const targetPath=path.join(dbRoot,manifest.generatedOutput);
const fileRx=/^portal\/(schema|reference)\/\d\d_[a-z0-9_]+\.sql$/;

function loadModules(group){
 const files=manifest[group];
 if(!Array.isArray(files)||files.length===0)throw new Error('Missing Portal '+group+' manifest entries');
 const seen=new Set();
 for(const file of files){
  if(!fileRx.test(file)||!file.startsWith('portal/'+group+'/'))throw new Error('Invalid Portal module path: '+file);
  if(seen.has(file))throw new Error('Duplicate Portal module: '+file);
  seen.add(file);
 }
 const dir=path.join(dbRoot,'portal',group);
 const actual=fs.readdirSync(dir).filter(file=>/^\d\d_[a-z0-9_]+\.sql$/.test(file)).sort().map(file=>'portal/'+group+'/'+file);
 if(JSON.stringify([...files].sort())!==JSON.stringify(actual))throw new Error('Portal '+group+' manifest must include every source SQL module exactly once');
 const combined=files.map(file=>{
  const content=fs.readFileSync(path.join(dbRoot,file),'utf8');
  if(!content.trim())throw new Error('Empty Portal SQL module: '+file);
  return content;
 }).join('');
 return {files,combined};
}
if(manifest.kind!=='portal-core'||manifest.freshInstallOnly!==true)throw new Error('Invalid canonical Portal package');
const schema=loadModules('schema');
const reference=loadModules('reference');
const header=[
 '-- ROBOTRONIX FRESH INSTALL — GENERATED; EMPTY SUPABASE PROJECTS ONLY.',
 '-- DO NOT run this on an existing database. Backup and migration plans are separate.',
 '-- Canonical source order: database/portal/manifest.json.',
 '-- Schema modules retain their sequential execution order and dependencies.',
 '',
 '-- PART 1: SCHEMA',
].join('\n');
const freshGuard="DO $portal_fresh_guard$ BEGIN IF to_regclass('public.profiles') IS NOT NULL THEN RAISE EXCEPTION 'Learning Portal already installed; fresh installer cannot be rerun'; END IF; END $portal_fresh_guard$;";
const output=header+'\n'+freshGuard+'\n'+schema.combined+'\n-- PART 2: REFERENCE DATA\n'+reference.combined+'\n';
fs.mkdirSync(path.dirname(targetPath),{recursive:true});
fs.writeFileSync(targetPath,output,'utf8');
if(fs.readFileSync(targetPath,'utf8')!==output)throw new Error('Fresh SQL generation mismatch.');
console.log('Generated '+path.relative(root,targetPath)+' from '+schema.files.length+' schema and '+reference.files.length+' canonical Portal modules.');
