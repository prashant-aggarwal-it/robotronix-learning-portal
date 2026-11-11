import fs from "node:fs";
import {resolveDeploymentConfig,defaultProductPath} from "../lib/platform/deployment.ts";
import {checkDeploymentReadiness} from "../lib/platform/deployment-readiness.mjs";
const profiles=JSON.parse(fs.readFileSync("config/deployment-profiles.json","utf8")).profiles;
const packages=JSON.parse(fs.readFileSync("database/packages.json","utf8")).packages;
const seen=new Set();let failed=false;
for(const p of profiles){
 const env={PRODUCT_MODE:p.mode,ENABLED_PRODUCTS:p.products.join(","),...(p.integrations.length?{ENABLED_INTEGRATIONS:p.integrations.join(",")}:{})};
 try{
  if(seen.has(p.id))throw Error("duplicate profile");seen.add(p.id);
  const config=resolveDeploymentConfig(env);
  if(JSON.stringify(config.products)!==JSON.stringify(p.products)||JSON.stringify(config.integrations)!==JSON.stringify(p.integrations))throw Error("capability mismatch");
  if(defaultProductPath(config)!==p.landing)throw Error("landing mismatch");
  if(!packages[p.databasePackage])throw Error("database package missing");
  if(checkDeploymentReadiness(env,config,{requireCredentials:false}).length)throw Error("non-explicit mode");
  console.log("PASS "+p.id+" -> "+p.databasePackage+" / "+p.landing);
 }catch(e){failed=true;console.error("FAIL "+p.id+": "+e.message);}
}
if(profiles.length!==7){failed=true;console.error("FAIL expected seven supported profiles");}
if(failed)process.exit(1);
console.log("Deployment profile matrix PASS. Live environment and database installation are not certified.");
