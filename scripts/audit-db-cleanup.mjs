// Read-only inventory of database files outside canonical installer sources.
// Outputs exact paths referenced by live code. Never modifies repository or database.
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(), db=path.join(root,'database');
const candidates=['src/migrations','audit','legacy','security_qa','connect'];
const scanDirs=['app','components','lib','scripts','qa','.github','docs','supabase'];
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>{const p=path.join(dir,x.name);return x.isDirectory()?walk(p):[p]})}
const textFiles=scanDirs.flatMap(x=>walk(path.join(root,x))).filter(p=>/\.(?:mjs|js|ts|tsx|json|md|ya?ml|sql)$/.test(p));
const content=textFiles.map(p=>({path:path.relative(root,p).replaceAll('\\','/'),text:fs.readFileSync(p,'utf8')}));
const rows=[];
for(const folder of candidates)for(const full of walk(path.join(db,folder))){
 const rel=path.relative(root,full).replaceAll('\\','/'),short=path.relative(db,full).replaceAll('\\','/');
 const refs=content.filter(x=>x.text.includes(rel)||x.text.includes(short)).map(x=>x.path);
 rows.push({file:rel,references:refs});
}
const referenced=rows.filter(x=>x.references.length);
console.log('Obsolete candidate files: '+rows.length+', explicitly referenced: '+referenced.length);
for(const r of referenced)console.log('REFERENCED '+r.file+' <- '+r.references.join(', '));
console.log('UNREFERENCED CANDIDATES:');
for(const r of rows.filter(x=>!x.references.length))console.log(r.file);
console.log('NOTE: absence of exact-string references does not prove an SQL file is unused; dynamic imports, external deployment and migration history require review.');
