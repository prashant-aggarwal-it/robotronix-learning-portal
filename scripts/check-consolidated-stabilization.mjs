import {readFileSync,existsSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks={
 "app/admin/trainers/[id]/page.tsx":["PayoutReview","reviewTrainerFinanceRequest"],
 "components/finance/PayoutReview.tsx":["Approved on file","proposed change","request_correction","Reveal for authorized review"],
 "app/api/admin/system-logs/route.ts":["getUser","active","role!==\"admin\"","no-store"],
 "app/admin/system-logs/page.tsx":["/api/admin/system-logs","System Logs"],
 "lib/server/system-log.ts":["SUPABASE_SERVICE_ROLE_KEY","portal_system_logs","reference_id"],
 "database/01_install/01_CREATE_SCHEMA.sql":["enable row level security","revoke all","public.is_admin()"],
 "app/api/admin/portal-access/route.ts":["logSystemEvent","Reference:","action===\"provision\"","createUser","provisioned"],
 "components/admin/PortalAccessPanel.tsx":["Grant portal access","awaiting_first_login"],
 "app/login/page.tsx":["requestEmailSignInCode","verifyEmailSignInCode","Continue with Google"],
 "database/01_install/01_CREATE_SCHEMA.sql":["provisioned"],
 "database/01_install/01_CREATE_SCHEMA.sql":["effective_payroll_month","payout_instruction_version_id","trainer_payout_instruction_lock_trg"],
 "database/01_install/01_CREATE_SCHEMA.sql":["service_role","purge_old_portal_system_logs"],
 "app/admin/trainer-finance/[trainerId]/page.tsx":["Approve and lock the monthly payroll","netbanking transaction reference"],
 "app/admin/zoom/page.tsx":["Cloud recordings by meeting","<details"],
 "docs/PASSWORDLESS_PORTAL_ACCESS.md":["AUTH-01","AUTH-12","Token"],
 "docs/CONSOLIDATED_RELEASE_QA_HANDOVER.md":["SQL deployment policy","Zoom"],
 "docs/CONSOLIDATED_STABILIZATION_BACKLOG.md":["FIN-PAY-02","AUTH-01","ZOOM-01","DOC-02","LOG-01"]
};
let failures=0;
for(const [file,needles] of Object.entries(checks)){
 const data=read(file);
 const missing=needles.filter(needle=>!data.includes(needle));
 if(missing.length){console.error("FAIL",file,missing.join(","));failures++;}
 else console.log("PASS",file);
}
for(const id of ["04_PRIORITY1_ACTION_NOTIFICATIONS","05_P2_P3_REALTIME_PUBLICATION","06_PORTAL_SYSTEM_LOGS","07_TRAINER_PAYROLL_CUTOFF","08_PASSWORDLESS_PORTAL_ACCESS","09_SYSTEM_LOG_RETENTION"]){
 if(existsSync(new URL("../database/01_install/"+id+".sql",import.meta.url))){console.error("FAIL redundant incremental file remains:",id);failures++;}
}
if(failures)process.exitCode=1;
