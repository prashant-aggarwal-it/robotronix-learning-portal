#!/usr/bin/env node
// Audit-only: compares static source references to catalog; never connects to a database.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(process.argv[2]||'artifacts/db-compatibility');
fs.mkdirSync(out,{recursive:true});
const snap=JSON.parse(fs.readFileSync('database/audit/dev_catalog_snapshot.json','utf8'));
const inventory='artifacts/db-call-inventory';
function parseCsv(str){
 const lines=str.trimEnd().split(/\r?\n/);return lines.slice(1).map(line=>{
  const vals=[];let val='',quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];
   if(c==='"'){if(quoted&&line[i+1]==='"'){val+='"';i++}else quoted=!quoted}
   else if(c===','&&!quoted){vals.push(val);val=''}else val+=c;
  }vals.push(val);return Object.fromEntries(lines[0].split(',').map((k,i)=>[k,vals[i]??'']));
 });
}
const calls=parseCsv(fs.readFileSync(path.join(inventory,'call_sites.csv'),'utf8'));
const manual=parseCsv(fs.readFileSync(path.join(inventory,'manual_review.csv'),'utf8'));
const tables=new Set(snap.tables.map(x=>x.schema+'.'+x.name));
const functions=new Set(snap.functions.map(x=>x.name));
const results=[];
for(const x of calls){
 if(x.kind==='supabase.from'){
  const candidates=x.object.includes('.')?[x.object]:['public.'+x.object,'connect.'+x.object,'tasks.'+x.object];
  results.push({...x,status:candidates.some(c=>tables.has(c))?'found':'missing',note:'table name existence only'});
 }else if(x.kind==='supabase.rpc'){
  results.push({...x,status:functions.has(x.object)?'found':'missing',note:'name-only; signature/args and response untested'});
 }
}
const dynamic=manual.filter(x=>/\.\s*(?:from|rpc|schema)\s*\(/.test(x.excerpt)&&!/\b(?:Array|Buffer|Object)\.from\(/.test(x.excerpt)&&!/\b(?:\.from\(new Set|\.from\(\{length)/.test(x.excerpt));
const grouped=Object.groupBy(results,x=>x.status);
const notFound=grouped.missing||[];
const csv=(arr,keys)=>[keys.join(','),...arr.map(r=>keys.map(k=>'"'+String(r[k]??'').replaceAll('"','""')+'"').join(','))].join('\n')+'\n';
fs.writeFileSync(path.join(out,'matched_calls.csv'),csv(results,['file','line','kind','object','status','note']));
fs.writeFileSync(path.join(out,'manual_review.csv'),csv(dynamic,['file','line','excerpt']));
fs.writeFileSync(path.join(out,'unmatched_calls.csv'),csv(notFound,['file','line','kind','object','status']));
const summary={
 baseline:{tables:new Set(snap.tables.map(x=>x.schema+'.'+x.name)).size,columns:snap.tables.length,functions:snap.functions.length,policies:snap.policies.length,triggers:snap.triggers.length},
 source:{literal_calls:results.length,table_calls:results.filter(x=>x.kind==='supabase.from').length,rpc_calls:results.filter(x=>x.kind==='supabase.rpc').length},
 missing:notFound.length,dynamic_review:dynamic.length,
 caveats:['Name existence only; function argument/default/result matching requires further verification','Dynamic calls and indirect SQL/trigger references require manual inspection','Not a full-security test, runtime regression test or clean-install certificate']
};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if(notFound.length)process.exitCode=1;
