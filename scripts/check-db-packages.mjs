// Validate package manifests and mutually exclusive optional integrations.
// No external database is changed. Run alongside db:check-canonical.
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd(),"database");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"packages.json"),"utf8"));
let failures=0;
const fail=m=>{console.error("FAIL "+m);failures++};
for(const [name,files] of Object.entries(manifest.packages)){
 if(!Array.isArray(files)||!files.length){fail(name+" has no files");continue}
 const seen=new Set();
 for(const file of files){
  if(seen.has(file))fail(name+" duplicated "+file);
  seen.add(file);
  if(!fs.existsSync(path.join(root,file)))fail(name+" missing "+file);
 }
 for(const group of manifest.rules.exclusiveGroups||[]){
  if(group.filter(file=>seen.has(file)).length>1)fail(name+" includes mutually exclusive integrations");
 }
 if(name==="crm-only"||name==="tasks-only"){
  if(files.some(f=>f.startsWith("integrations/")||f.startsWith("01_install/")))fail(name+" includes another product");
 }
 if(name==="full-suite"&&!files.includes("integrations/05_full_suite_task_links.sql"))fail("full suite missing final task links");
 if(name==="portal-tasks"&&!files.includes("integrations/06_tasks_portal_links.sql"))fail("Portal+Tasks missing independent task links");
 console.log("Checked package "+name+": "+files.length+" files");
}
if(failures)process.exit(1);
console.log("All customer database package manifests passed static validation. Isolated clean-install testing remains required.");
