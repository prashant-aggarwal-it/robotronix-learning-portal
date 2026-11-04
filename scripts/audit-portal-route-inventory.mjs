import fs from "node:fs";
import path from "node:path";
const app=path.join(process.cwd(),"app");
const roles=["admin","trainer","parent","student"];
const all=[];
function visit(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())visit(file);
  else if(entry.name==="page.tsx"){
   const route="/"+path.relative(app,dir).replaceAll(path.sep,"/");
   const role=roles.find(r=>route==="/"+r||route.startsWith("/"+r+"/"))||"public";
   all.push({role,route,dynamic:route.includes("[")});
  }
 }
}
visit(app);
const summary=Object.fromEntries([...roles,"public"].map(role=>[role,{static:all.filter(p=>p.role===role&&!p.dynamic).length,dynamic:all.filter(p=>p.role===role&&p.dynamic).length}]));
const report={generatedAt:new Date().toISOString(),total:all.length,summary,all:all.sort((a,b)=>a.route.localeCompare(b.route))};
fs.mkdirSync("artifacts",{recursive:true});
fs.writeFileSync("artifacts/portal-ui-route-inventory.json",JSON.stringify(report,null,2));
console.log("Portal route inventory:",JSON.stringify(summary));
console.log("Total:",all.length,"| static role routes automatically exercised by qa:all-roles-visual:",roles.reduce((n,r)=>n+summary[r].static,0));
console.log("Dynamic routes are covered by specialized workflow tests only when seeded IDs are supplied; inventory is not proof of pass.");
