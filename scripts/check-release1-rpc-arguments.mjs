#!/usr/bin/env node
// Offline signature audit: argument NAME existence only, not runtime/type/permission semantics.
import fs from 'node:fs';
import path from 'node:path';
const snap=JSON.parse(fs.readFileSync('database/audit/dev_catalog_snapshot.json','utf8'));
const root=process.cwd(),target=path.resolve(process.argv[2]||'artifacts/release1-rpc-signatures');
fs.mkdirSync(target,{recursive:true});
const functionArgs=new Map();
for(const fn of snap.functions){
 const keys=[...fn.args.matchAll(/(?:^|,)\s*([a-z][a-z0-9_]*)\s+[\w\s.\[\]]+(?=,|$)/g)].map(x=>x[1]);
 if(!functionArgs.has(fn.name))functionArgs.set(fn.name,[]);
 functionArgs.get(fn.name).push({schema:fn.schema,keys,signature:fn.args});
}
const dirs=['app','lib','netlify'];
const files=[];
function walk(d){if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){
 const p=path.join(d,e.name);if(e.isDirectory()&&!['node_modules','.next','.git'].includes(e.name))walk(p);
 else if(e.isFile()&&/\.(?:ts|tsx|mjs|mts)$/.test(e.name))files.push(p);
}}
dirs.forEach(walk);
const rows=[],unknown=[];
for(const file of files){
 const text=fs.readFileSync(file,'utf8'),rx=/\.rpc\(\s*(['"])([a-z_][a-z0-9_]*)\1\s*,\s*\{([^{}]{0,2500})\}/g;
 for(const match of text.matchAll(rx)){
  const name=match[2],src=match[3],keys=[...src.matchAll(/(?:^|,)\s*([a-z][a-z0-9_]*)\s*:/g)].map(x=>x[1]);
  const signatures=functionArgs.get(name)||[];
  const compatible=signatures.some(s=>keys.every(k=>s.keys.includes(k)));
  const relative=file.replaceAll('\\','/');
  const line=text.slice(0,match.index).split('\n').length;
  rows.push({file:relative,line,name,sourceArgs:keys.join('|'),compatible,signature:signatures.map(s=>s.signature).join(' OR ')});
  if(!compatible)unknown.push({file:relative,line,name,keys,signatures});
 }
}
const header=['file','line','name','sourceArgs','compatible','signature'];
fs.writeFileSync(path.join(target,'statically_checked_calls.csv'),[header.join(','),...rows.map(x=>header.map(k=>'"'+String(x[k]).replaceAll('"','""')+'"').join(','))].join('\n')+'\n');
const summary={checked:rows.length,compatible:rows.filter(x=>x.compatible).length,requiresReview:unknown.length,unmatched:unknown,limits:['Only inline literal RPC calls with object literals: nested expressions and dynamically composed args omitted','Does not check required-but-omitted parameters, types, defaults, JSON returns, DB privileges or behaviour','Signature matching uses a conservative parser; flagged mismatches require source/SQL review before changes']};
fs.writeFileSync(path.join(target,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({checked:summary.checked,compatible:summary.compatible,requiresReview:summary.requiresReview},null,2));
if(unknown.length)process.exitCode=1;
