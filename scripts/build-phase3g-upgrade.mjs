// Phase 3G additive privileged RPC tenant-scope DEV upgrade; offline assembly only.
import fs from "node:fs";
import path from "node:path";
const files=[
 "53_phase3g_family_payment_tenant_scope.sql",
 "54_phase3g_privileged_schedule_tenant_scope.sql",
 "55_phase3g_cohort_schedule_tenant_scope.sql",
 "56_phase3g_class_enrollment_rpc_tenant_scope.sql",
 "57_phase3g_trainer_finance_communication_scope.sql"
];
const parts=files.map((file,i)=>{
 const body=fs.readFileSync(path.join("database/saas",file),"utf8").trim();
 if(!body.startsWith("--") || !body.includes("CREATE OR REPLACE FUNCTION"))throw new Error("Invalid source "+file);
 return "-- Phase 3G step "+(i+1)+": "+file+"\n"+body+"\n";
});
const destination="database/generated/SAAS_PHASE3G_SECURITY_UPGRADE.sql";
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,
 "-- Robotronix Phase 3G additive security upgrade. DEV tested; production NOT certified.\n"+
 "-- Run only after the previous Phase 3E SaaS upgrade in an approved environment.\n"+
 "-- Requires separate staging verification, backups and explicit production authorization.\n\n"+
 parts.join("\n"));
console.log("Generated "+destination+"; "+files.length+" ordered security migrations.");
