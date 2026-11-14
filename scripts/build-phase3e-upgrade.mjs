// Phase 3E additive multi-customer SaaS upgrade; no DB connection or side effects.
import fs from "node:fs";
import path from "node:path";
const files=[
 "48_phase3e_multi_active_crm_portal.sql",
 "49_phase3e_crm_portal_access_scope.sql",
 "50_phase3e_guard_legacy_portal_installs.sql"
];
const parts=files.map((file,i)=>{
 const body=fs.readFileSync(path.join("database/saas",file),"utf8").trim();
 if(!body||/saas_qa_|dev_only\//.test(body))throw new Error("Unsafe source "+file);
 return "-- Phase 3E step "+(i+1)+": "+file+"\n"+body+"\n";
});
const destination="database/generated/SAAS_PHASE3E_MULTI_CUSTOMER_UPGRADE.sql";
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,
"-- Robotronix Education Suite: additive Phase 3E DEV-certified migration package.\n"+
"-- Requires existing Phase 3D SaaS + CRM + Academy schemas and live tenant mapping.\n"+
"-- Production use requires an approved backup, staging simulation, and migration window.\n\n"+
parts.join("\n"));
console.log("Generated "+destination+"; "+files.length+" ordered source migrations.");
