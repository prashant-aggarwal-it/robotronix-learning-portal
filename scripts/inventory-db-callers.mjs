#!/usr/bin/env node
// Read-only, deterministic, best-effort caller inventory. It does not connect to a database.
import fs from 'node:fs';
import path from 'node:path';
const roots=['app','lib','netlify','scripts','database'];
const extensions=new Set(['.ts','.tsx','.js','.mjs','.mts','.sql']);
const out=path.resolve(process.argv[2]||'artifacts/db-call-inventory');
fs.mkdirSync(out,{recursive:true});
const rows=[],unresolved=[];
const quoted=(s)=>s.replaceAll('"','""');
const csv=(list,keys)=>[keys.join(','),...list.map(o=>keys.map(k=>'"'+quoted(String(o[k]??''))+'"').join(','))].join('\n')+'\n';
function walk(dir){
 if(!fs.existsSync(dir))return;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()){if(!['node_modules','.next','.git','generated'].includes(entry.name))walk(full);continue}
  if(!entry.isFile()||!extensions.has(path.extname(full)))continue;
  const content=fs.readFileSync(full,'utf8'),lines=content.split(/\r?\n/);
  for(let n=0;n<lines.length;n++){
   const line=lines[n], patterns=[
    ['supabase.from',/\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g],
    ['supabase.rpc',/\.rpc\(\s*(['"`])([^'"`]+)\1/g],
    ['db.schema',/\.schema\(\s*(['"`])([^'"`]+)\1/g],
    ['sql.object',/\b(?:public|connect|tasks|platform|auth)\.[a-z_][a-z0-9_]*/gi],
   ];
   let found=false;
   for(const [kind,re] of patterns){for(const m of line.matchAll(re)){found=true;rows.push({file:full.replaceAll('\\','/'),line:n+1,kind,object:kind==='sql.object'?m[0]:m[2],excerpt:line.trim().slice(0,240)})}}
   if(!found && /\.(?:from|rpc|schema)\s*\(/.test(line))unresolved.push({file:full.replaceAll('\\','/'),line:n+1,excerpt:line.trim().slice(0,240),reason:'dynamic or multiline call; manual review'});
  }
 }
}
roots.forEach(walk);
rows.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.kind.localeCompare(b.kind));
unresolved.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
fs.writeFileSync(path.join(out,'call_sites.csv'),csv(rows,['file','line','kind','object','excerpt']));
fs.writeFileSync(path.join(out,'manual_review.csv'),csv(unresolved,['file','line','reason','excerpt']));
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({call_sites:rows.length,manual_review:unresolved.length,files:new Set([...rows,...unresolved].map(x=>x.file)).size,scope:roots,limitations:['Static text matching; does not resolve symbols, dynamic SQL or all indirect function references','Not a verified feature-parity test','Database metadata must be joined separately']},null,2)+'\n');
console.log('Database caller inventory:',rows.length,'references;',unresolved.length,'manual-review candidates');
