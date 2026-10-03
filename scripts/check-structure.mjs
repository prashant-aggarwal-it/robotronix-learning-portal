import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const required=['package.json','app/layout.tsx','app/page.tsx','app/globals.css','lib/repository.ts','lib/supabase/browser.ts','supabase/production-v1-baseline.sql','.env.example','netlify.toml'];
let errors=[];
for(const f of required){if(!fs.existsSync(path.join(root,f))) errors.push(`Missing ${f}`)}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const files=walk(root).filter(f=>!f.includes('node_modules')&&!f.includes('.next'));
const source=files.filter(f=>/\.(ts|tsx)$/.test(f));
const imports=[];
for(const f of source){const s=fs.readFileSync(f,'utf8'); for(const m of s.matchAll(/from\s+["']@\/(.+?)["']/g)) imports.push([f,m[1]]);}
for(const [f,imp] of imports){const base=path.join(root,imp);const candidates=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')];if(!candidates.some(fs.existsSync)) errors.push(`Missing import ${imp} from ${path.relative(root,f)}`)}
const routes=source.filter(f=>f.endsWith(path.sep+'page.tsx')).map(f=>'/'+path.relative(path.join(root,'app'),path.dirname(f)).replaceAll(path.sep,'/')).map(r=>r==='/'?'/':r.replace(/\/page$/,'')).sort();
console.log(`Checked ${source.length} TS/TSX files.`);console.log(`Found ${routes.length} page routes.`);console.log(routes.join('\n'));
if(errors.length){console.error('\nFAILED');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('\nStructure check passed.');
