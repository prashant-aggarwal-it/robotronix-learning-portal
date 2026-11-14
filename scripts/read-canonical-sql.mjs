import fs from 'node:fs';
import path from 'node:path';

/** Read the exact ordered canonical Portal sources defined by its manifest.
 * The retired database/01_install/modules folder must never be recreated.
 */
export function readCanonicalSql(group='schema'){
 if(!['schema','reference'].includes(group))throw new Error('Unknown canonical SQL group: '+group);
 const manifestPath=path.resolve('database/portal/manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const entries=manifest[group];
 if(!Array.isArray(entries)||!entries.length)throw new Error('Canonical Portal SQL group missing: '+group);
 return entries.map(file=>{
  if(!/^portal\/(schema|reference)\/[a-z0-9_]+\.sql$/.test(file))throw new Error('Unsafe or unexpected Portal SQL path: '+file);
  return fs.readFileSync(path.resolve('database',file),'utf8');
 }).join('\n');
}
