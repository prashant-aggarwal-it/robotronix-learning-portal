// Generate one ordered, fresh-install SQL file per customer package.
// Canonical SQL stays authoritative; these files are disposable build outputs.
// This script never connects to Supabase or modifies a database.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const repoRoot=process.cwd();
const dbRoot=path.join(repoRoot,'database');
const packages=JSON.parse(fs.readFileSync(path.join(dbRoot,'packages.json'),'utf8'));
const portalManifestPath=packages.rules.portalManifest;
const portalManifest=JSON.parse(fs.readFileSync(path.join(dbRoot,portalManifestPath),'utf8'));

const outputPaths=packages.generatedOutputs;
const verificationFiles=new Set([
 portalManifest.verification,
 'canonical/tasks/04_verify.sql',
 'canonical/crm/04_verify.sql'
]);
const preflight='canonical/00_preflight.sql';
const generatedDir=path.join(dbRoot,'generated');

if(portalManifest.kind!=='portal-core'||portalManifest.freshInstallOnly!==true)
 throw new Error('Invalid Portal manifest');
if(JSON.stringify(Object.keys(packages.packages).sort())!==JSON.stringify(Object.keys(outputPaths).sort()))
 throw new Error('Missing or unexpected customer database package');
if(outputPaths['portal-only']!==portalManifest.generatedOutput)
 throw new Error('Portal generated output disagrees with its canonical manifest');
if(new Set(Object.values(outputPaths)).size!==Object.keys(outputPaths).length)
 throw new Error('Duplicate generated installer output');
for(const output of Object.values(outputPaths))
 if(!output.startsWith('generated/') || !/^[A-Z0-9_]+[.]sql$/.test(output.slice('generated/'.length)))
  throw new Error('Unsafe installer output path: '+output);

// Always regenerate the Portal source from its manifest so full-suite bundles
// cannot accidentally embed a stale Portal SQL file.
execFileSync(process.execPath,[path.join(repoRoot,'scripts/build-fresh-db-install.mjs')],{
 cwd:repoRoot,stdio:'inherit'
});
const portalSource=fs.readFileSync(path.join(dbRoot,portalManifest.generatedOutput),'utf8');
if(!portalSource.trim())throw new Error('Empty generated Portal installer');

const title={
 [preflight]:'Supabase prerequisites',
 [portalManifestPath]:'Learning Portal schema and reference data',
 'canonical/tasks/01_schema.sql':'My Tasks schema',
 'canonical/tasks/02_functions.sql':'My Tasks functions',
 'canonical/tasks/03_security.sql':'My Tasks security',
 'canonical/crm/01_schema.sql':'Connect CRM schema',
 'canonical/crm/02_functions.sql':'Connect CRM functions',
 'canonical/crm/03_security.sql':'Connect CRM security',
 'integrations/01_crm_portal.sql':'CRM and Portal integration',
 'integrations/02_tasks_crm.sql':'Tasks and CRM integration',
 'integrations/03_tasks_crm_links.sql':'CRM-only task links',
 'integrations/04_tasks_portal_notifications.sql':'Tasks and Portal notifications',
 'integrations/05_full_suite_task_links.sql':'Full-suite task links',
 'integrations/06_tasks_portal_links.sql':'Portal-only task links'
};
const readSource=file=>{
 if(file===portalManifestPath)return portalSource;
 if(!Object.hasOwn(title,file))throw new Error('Unexpected installer source: '+file);
 const content=fs.readFileSync(path.join(dbRoot,file),'utf8');
 if(!content.trim())throw new Error('Empty installer source: '+file);
 return content;
};

fs.mkdirSync(generatedDir,{recursive:true});
for(const [name,files] of Object.entries(packages.packages)){
 if(name==='portal-only'){
  console.log('Generated '+portalManifest.generatedOutput+' (Portal canonical manifest)');
  continue;
 }
 if(!Array.isArray(files)||files.length===0)throw new Error('Empty package '+name);
 // A single install file includes the preflight automatically. Keep read-only
 // verification scripts separate, as with the existing Portal installer.
 const sourceFiles=[preflight,...files.filter(file=>file!==preflight&&!verificationFiles.has(file))];
 if(new Set(sourceFiles).size!==sourceFiles.length)throw new Error('Duplicate source in '+name);
 if(sourceFiles.includes(portalManifestPath)&&sourceFiles.indexOf(portalManifestPath)!==1)
  throw new Error('Portal must be the first product installed in '+name);
 const groups=packages.rules.exclusiveGroups||[];
 for(const group of groups)
  if(group.filter(file=>sourceFiles.includes(file)).length>1)
   throw new Error('Mutually exclusive integrations in '+name);

 const installedChecks=[
  ...(sourceFiles.includes(portalManifestPath)?[["to_regclass('public.profiles') IS NOT NULL","Learning Portal"]]:[]),
  ...(sourceFiles.includes('canonical/tasks/01_schema.sql')?[["to_regnamespace('tasks') IS NOT NULL","My Tasks"]]:[]),
  ...(sourceFiles.includes('canonical/crm/01_schema.sql')?[["to_regnamespace('connect') IS NOT NULL","Connect CRM"]]:[])
 ];
 const freshGuard=[
  'DO $fresh_install_guard$ BEGIN',
  ...installedChecks.map(([condition,module])=>" IF "+condition+" THEN RAISE EXCEPTION '"+module+" already installed; fresh-install bundle cannot be rerun'; END IF;"),
  'END $fresh_install_guard$;',
  ''
 ].join('\n');
 const header=[
  '-- ROBOTRONIX '+name.toUpperCase()+' — GENERATED FRESH INSTALL.',
  '-- One file, ordered steps. Execute ONCE on a new/compatible DEV Supabase database.',
  '-- NOT a migration. Do not execute against existing production or a partially installed module.',
  '-- Canonical source of truth: database/packages.json and database/canonical/.',
  '-- Individual source files and historical migrations must NOT be run in addition to this installer.',
  '-- Read-only verification is deliberately separate; see database/canonical/README.md.',
  ''
 ].join('\n');
 const sections=sourceFiles.map((file,index)=>{
  const step=String(index+1).padStart(2,'0');
  return [
   '-- ============================================================================',
   '-- STEP '+step+' — '+title[file],
   '-- Source: database/'+file,
   '-- ============================================================================',
   (file===preflight?readSource(file).trimEnd()+'\n'+freshGuard:readSource(file).trimEnd()),
   ''
  ].join('\n');
 });
 const output=header+sections.join('\n')+'\n';
 const target=path.join(dbRoot,outputPaths[name]);
 fs.writeFileSync(target,output,'utf8');
 if(fs.readFileSync(target,'utf8')!==output)throw new Error('Generated SQL mismatch: '+name);
 const steps=[...output.matchAll(/^-- STEP (\d\d) — /gm)].map(match=>Number(match[1]));
 if(steps.length!==sourceFiles.length||steps.some((step,index)=>step!==index+1))
  throw new Error('Invalid sequential step numbering: '+name);
 console.log('Generated database/'+outputPaths[name]+' ('+sourceFiles.length+' ordered steps)');
}
console.log('All seven customer package installers are generated; live clean-install testing is still required.');
