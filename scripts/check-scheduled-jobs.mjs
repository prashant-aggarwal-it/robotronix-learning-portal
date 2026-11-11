// Static Netlify cron ownership gate. Does not confirm live deployment execution.
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,"config/scheduled-jobs.json"),"utf8"));
const toml=fs.readFileSync(path.join(root,"netlify.toml"),"utf8");
const files=fs.readdirSync(path.join(root,"netlify/functions"));
let failures=0;
function fail(message){console.error("FAIL "+message);failures++;}
function escape(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
const names=new Set(),paths=new Set(),declared=new Set();
for(const job of manifest.jobs){
 if(names.has(job.name))fail("Duplicate job name: "+job.name);
 if(paths.has(job.file))fail("Duplicate worker file: "+job.file);
 names.add(job.name);
 paths.add(job.file);
 const filePath=path.join(root,job.file);
 if(!fs.existsSync(filePath)){fail("Worker missing: "+job.file);continue;}
 const code=fs.readFileSync(filePath,"utf8");
 const definitions=[...files].filter(f=>f.slice(0,f.lastIndexOf("."))===job.name);
 if(definitions.length!==1)fail("Ambiguous worker basename: "+job.name+" ("+definitions.join(", ")+")");
 const tomlSection=toml.match(new RegExp('\\[functions\\."'+escape(job.name)+'"\\]([\\s\\S]*?)(?=\\n\\[|$)'));
 const codeSchedule=code.match(/export const config\s*=\s*\{\s*schedule\s*:\s*["']([^"']+)["']/);
 let actual;
 if(job.source==="code"){
   if(tomlSection)fail("Schedule defined in both code and netlify.toml for "+job.name);
   actual=codeSchedule?.[1];
 }else if(job.source==="netlify.toml"){
   if(codeSchedule)fail("Schedule defined in both code and netlify.toml for "+job.name);
   actual=tomlSection?.[1].match(/schedule\s*=\s*"([^"]+)"/)?.[1];
 }else fail("Unknown schedule owner "+job.source);
 if(actual!==job.schedule)fail("Cron mismatch for "+job.name+": "+actual+" expected "+job.schedule);
 if(job.module!=="portal"&&job.enable.includes("=true")){
   const flag=job.enable.split("=true")[0].trim();
   if(!code.includes(flag))fail("Missing opt-in flag "+flag+" in "+job.name);
 }
 if(job.module==="crm-portal"&&!code.includes("CONNECT_PORTAL_JOBS_ENABLED"))
  fail("Combined module worker has no explicit enable guard: "+job.name);
 declared.add(job.name);
 console.log("Checked "+job.module+" scheduler "+job.name+" ["+job.schedule+"]");
}
for(const name of files){
 if(![".mjs",".mts",".js",".ts"].some(ext=>name.endsWith(ext)))continue;
 const text=fs.readFileSync(path.join(root,"netlify/functions",name),"utf8");
 const basename=name.slice(0,name.lastIndexOf("."));
 if(/export const config\s*=\s*\{\s*schedule\s*:/.test(text)||toml.includes('[functions."'+basename+'"]')){
  if(!declared.has(basename))fail("Uninventoried scheduled worker: "+name);
 }
}
if(failures){console.error("Scheduler checks FAILED: "+failures);process.exit(1);}
console.log("Scheduler inventory checks PASS. Netlify execution and database availability require separate live verification.");
