// Validate package manifests and mutually exclusive optional integrations.
// No external database is changed. Run alongside db:check-canonical.
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd(),"database");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"packages.json"),"utf8"));
const portalManifestPath=manifest.rules.portalManifest;
const portal=JSON.parse(fs.readFileSync(path.join(root,portalManifestPath),"utf8"));
if(portal.kind!=="portal-core"||portal.freshInstallOnly!==true)throw new Error("Invalid canonical Portal manifest");
for(const group of ["schema","reference"]){
 const files=portal[group];
 if(!Array.isArray(files)||files.length===0)throw new Error("Missing Portal "+group+" modules");
 const expected=fs.readdirSync(path.join(root,"01_install/modules",group))
  .filter(n=>/^\d\d_[a-z0-9_]+\.sql$/.test(n)).sort()
  .map(n=>"01_install/modules/"+group+"/"+n);
 if(new Set(files).size!==files.length || JSON.stringify([...files].sort())!==JSON.stringify(expected))
  throw new Error("Portal "+group+" manifest does not cover exact source module set");
 if(JSON.stringify(files)!==JSON.stringify([...files].sort()))
  throw new Error("Portal "+group+" must use deterministic filename order");
}
if(!fs.existsSync(path.join(root,portal.verification)))throw new Error("Missing Portal verification SQL");
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
 if(name.startsWith("portal-")||name==="full-suite") {
  if(!seen.has(portalManifestPath))fail(name+" is missing Portal canonical manifest");
  if(seen.has("01_install/README.md"))fail(name+" uses a README instead of an install manifest");
 }
 if(name==="full-suite"&&!files.includes("integrations/05_full_suite_task_links.sql"))fail("full suite missing final task links");
 if(name==="portal-tasks"&&!files.includes("integrations/06_tasks_portal_links.sql"))fail("Portal+Tasks missing independent task links");
 console.log("Checked package "+name+": "+files.length+" files");
}
if(failures)process.exit(1);
console.log("All customer database package manifests passed static validation. Isolated clean-install testing remains required.");
