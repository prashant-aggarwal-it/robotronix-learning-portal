// Build optional Phase 3D database upgrades. Never execute migrations here.
import fs from "node:fs";
import path from "node:path";
const root=process.cwd(),target=path.join(root,"database/generated");
fs.mkdirSync(target,{recursive:true});
const upgrades=[
 {name:"PHASE3D_CRM_TASKS_UPGRADE.sql",files:["45_phase3d_crm_tasks_owner_sync_guard.sql"],
  banner:"CRM + Tasks integration already installed. Do not apply to CRM-only or Tasks-only deployments."},
 {name:"PHASE3D_SAAS_ACADEMY_TASKS_UPGRADE.sql",files:["46_phase3d_schedule_task_scope.sql"],
  banner:"SaaS Academy and full-suite Tasks link implementation required. Not for standalone Portal+Tasks."}
];
for(const upgrade of upgrades){
 const bodies=upgrade.files.map(file=>{
  const full=path.join(root,"database/saas",file);
  const sql=fs.readFileSync(full,"utf8").trim();
  if(!sql||/saas_qa_phase3d|dev_only\//.test(sql))throw new Error("Unsafe upgrade input "+file);
  return "-- Canonical "+file+"\n"+sql+"\n";
 });
 fs.writeFileSync(path.join(target,upgrade.name),
  "-- ROBOTRONIX PHASE 3D OPTIONAL ADDITIVE UPGRADE\n"+
  "-- "+upgrade.banner+"\n"+
  "-- Requires explicit authorization before any production application.\n\n"+
  bodies.join("\n"));
 console.log("Generated "+upgrade.name+" from "+upgrade.files.join(", "));
}
