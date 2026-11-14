// Build future-module draft installers and verify structural isolation.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const folder=path.join(root,'database','future');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
if(manifest.productionExecutionAllowed!==false||manifest.release1InstallerIncluded!==false)throw new Error('Future package must remain opt-in and non-production');
let combined='',total=0;
for(const mod of manifest.modules){
 if(!/^[a-z_]+$/.test(mod.name)||!Number.isInteger(mod.tables)||mod.tables<1)throw new Error('Bad module manifest');
 const source=fs.readFileSync(path.join(folder,mod.name,'01_schema.sql'),'utf8');
 if(source.includes('platform.organizations')) throw new Error('Retired platform identity reference: '+mod.name);
 const re=new RegExp('CREATE TABLE '+mod.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.','g');
 const tableNames=[...source.matchAll(new RegExp('CREATE TABLE '+mod.name+'\\.([a-z_]+)','g'))].map(x=>x[1]);
 if(tableNames.length!==mod.tables||new Set(tableNames).size!==mod.tables)throw new Error(mod.name+': table count or duplicate mismatch');
 for(const name of tableNames){
  if(!source.includes('ALTER TABLE '+mod.name+'.'+name+' ENABLE ROW LEVEL SECURITY;'))throw new Error('Missing RLS: '+mod.name+'.'+name);
  if(!source.includes('REVOKE ALL ON TABLE '+mod.name+'.'+name+' FROM PUBLIC, anon, authenticated;'))throw new Error('Missing grants guard: '+mod.name+'.'+name);
 }
 if(/GRANT\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\s+ON\s+TABLE.*\b(anon|authenticated)\b/i.test(source))throw new Error('Unreviewed client grant in '+mod.name);
 combined+='\n-- MODULE '+mod.name.toUpperCase()+'\n'+source+'\n';
 total+=mod.tables;
}
if(total!==35)throw new Error('Expected 35 future feature tables');
const dest=path.join(folder,'generated');
fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'FUTURE_FULL_DESIGN_INSTALL_DO_NOT_DEPLOY.sql'),'-- DRAFT: ONLY EXECUTE IN A TRANSACTION THAT IS ROLLED BACK UNTIL RLS TESTS ARE CERTIFIED.\n'+combined);
console.log('PASS: '+manifest.modules.length+' future modules, '+total+' tables, RLS deny-default checks');
