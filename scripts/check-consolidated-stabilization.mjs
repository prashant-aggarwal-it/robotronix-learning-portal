import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const checks={
 "app/admin/trainers/[id]/page.tsx":["PayoutReview","reviewTrainerFinanceRequest"],
 "components/finance/PayoutReview.tsx":["Approved on file","proposed change","request_correction","Reveal for authorized review"],
 "app/api/admin/system-logs/route.ts":["getUser","active","role!==\"admin\"","no-store"],
 "app/admin/system-logs/page.tsx":["/api/admin/system-logs","System Logs"],
 "lib/server/system-log.ts":["SUPABASE_SERVICE_ROLE_KEY","portal_system_logs","reference_id"],
 "database/01_install/06_PORTAL_SYSTEM_LOGS.sql":["enable row level security","revoke all","public.is_admin()"],
 "app/api/admin/portal-access/route.ts":["logSystemEvent","Reference:"],
 "docs/CONSOLIDATED_STABILIZATION_BACKLOG.md":["FIN-PAY-02","AUTH-01","ZOOM-01","DOC-02","LOG-01"]
};
let failures=0;
for(const [file,needles] of Object.entries(checks)){
 const data=read(file);
 const missing=needles.filter(needle=>!data.includes(needle));
 if(missing.length){console.error("FAIL",file,missing.join(","));failures++;}
 else console.log("PASS",file);
}
if(failures)process.exitCode=1;
