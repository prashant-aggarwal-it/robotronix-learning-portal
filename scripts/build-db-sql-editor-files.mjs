// Create SQL Editor-sized, sequential, logical installation files from the
// existing generated Education Suite SQL. This script NEVER connects to a DB.
// Run only for a new empty DEV install; never on existing DEV / production.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const src=path.join(root,'database/generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql');
const out=path.join(root,'database/02_install/sql_editor');
const MAX=180*1024;
if(!fs.existsSync(src))throw Error('Generate the Education Suite bundle first.');
const sql=fs.readFileSync(src,'utf8');
// Split only at SQL statement semicolons, NEVER inside quoted strings,
// dollar-quoted bodies, line comments, or nested block comments.
function statements(input){
 let start=0,i=0,mode='plain',dollar='',depth=0;
 const result=[];
 while(i<input.length){
  const c=input[i],n=input[i+1];
  if(mode==='line'){if(c==='\n')mode='plain';i++;continue}
  if(mode==='block'){if(c==='/'&&n==='*'){depth++;i+=2;continue}if(c==='*'&&n==='/'){depth--;i+=2;if(!depth)mode='plain';continue}i++;continue}
  if(mode==='single'){if(c==="'"&&n==="'"){i+=2;continue}if(c==="'"&&input[i-1]!=='\\')mode='plain';i++;continue}
  if(mode==='double'){if(c==='"'&&n==='"'){i+=2;continue}if(c==='"')mode='plain';i++;continue}
  if(mode==='dollar'){if(input.startsWith(dollar,i)){i+=dollar.length;mode='plain'}else i++;continue}
  if(c==='-'&&n==='-'){mode='line';i+=2;continue}
  if(c==='/'&&n==='*'){mode='block';depth=1;i+=2;continue}
  if(c==="'"){mode='single';i++;continue}
  if(c==='"'){mode='double';i++;continue}
  if(c==='$'){const m=input.slice(i).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/);if(m){dollar=m[0];mode='dollar';i+=dollar.length;continue}}
  if(c===';'){result.push(input.slice(start,i+1));start=i+1}
  i++;
 }
 if(mode==='block'||mode==='single'||mode==='double'||mode==='dollar')throw Error('Unclosed SQL literal/comment: '+mode);
 if(start<input.length)result.push(input.slice(start));
 if(result.join('')!==input)throw Error('Statement splitting changed source bytes');
 return result;
}
const stmts=statements(sql);
const stripPrefix=s=>s.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/,'').trim();
const chunks=[];
let current=[],bytes=0,stage='Academy',counter=0;
const flush=()=>{if(!current.length)return;chunks.push({stage,content:current.join('')});current=[];bytes=0};
for(const statement of stmts){
 const heading=[...statement.matchAll(/--\s*STAGE\s+\d+:\s*([^\n]+)/g)];
 if(heading.length){const label=heading.at(-1)[1];let next=label.includes('SaaS ')?'SaaS':label.includes('Milestone')?'Onboarding':label.includes('Existing canonical')?'Academy_CRM_Tasks':label.includes('Fresh install guard')?'Preflight':stage;if(next!==stage){flush();stage=next}}
 // Top-level BEGIN/COMMIT statements are replaced with a per-file transaction;
 // retaining them across independent SQL Editor submissions is unsafe.
 const compact=stripPrefix(statement).replace(/;\s*$/,'').trim().toUpperCase();
 if(compact==='BEGIN'||compact==='COMMIT'||compact==='END TRANSACTION'){continue}
 const len=Buffer.byteLength(statement);
 if(len>MAX)throw Error('A single SQL statement is larger than '+MAX+' bytes; cannot safely split: '+len);
 if(bytes+len>MAX&&current.length)flush();
 current.push(statement);bytes+=len;
}
flush();
if(!chunks.length)throw Error('No SQL generated');
fs.mkdirSync(out,{recursive:true});
for(const f of fs.readdirSync(out).filter(f=>/^\d\d_.*\.sql$/.test(f)))fs.unlinkSync(path.join(out,f));
let manifest=[];
for(let i=0;i<chunks.length;i++){
 const part=chunks[i],name=String(i+1).padStart(2,'0')+'_'+part.stage+'_'+String(manifest.filter(x=>x.stage===part.stage).length+1).padStart(2,'0')+'.sql';
 const header='-- GENERATED / DEV EMPTY DATABASE ONLY. Run in numeric order.\n-- SQL Editor chunk '+(i+1)+' of '+chunks.length+'. DO NOT rerun after partial failure.\n';
 const payload=header+'BEGIN;\n'+part.content+'\nCOMMIT;\n';
 if(Buffer.byteLength(payload)>MAX+800)throw Error('Chunk too large: '+name);
 fs.writeFileSync(path.join(out,name),payload,'utf8');
 manifest.push({name,stage:part.stage,bytes:Buffer.byteLength(payload)});
}
const names=manifest.map(x=>x.name);
fs.writeFileSync(path.join(out,'ORDER.md'),'# SQL Editor installation (EMPTY DEV ONLY)\n\nRun files **one at a time, in exactly this order**, using Supabase SQL Editor. Each file is under 181 KB and is wrapped in its own transaction. **This changes the original transaction boundaries and requires an isolated fresh-install test before use.** Stop on ANY error; do not rerun or skip steps.\n\n'+names.map((n,i)=>(i+1)+'. `'+n+'`').join('\n')+'\n\nSource: `database/generated/ROBOTRONIX_EDUCATION_SUITE_FRESH_INSTALL_UNCERTIFIED.sql`. This split is for NEW installs, not upgrades or the already-installed DEV project.\n');
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({maxBytes:MAX,count:manifest.length,files:manifest},null,2)+'\n');
console.log('Generated '+chunks.length+' ordered SQL Editor files; max '+Math.max(...manifest.map(x=>x.bytes))+' bytes. SQL execution NOT certified.');
