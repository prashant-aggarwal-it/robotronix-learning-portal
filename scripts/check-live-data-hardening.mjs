import fs from "node:fs";
import {readCanonicalSql} from "./read-canonical-sql.mjs";

const required=[
 "hooks/useLiveRefresh.ts",
 "database/01_install/modules/schema/01_core_schema.sql",
 "app/api/zoom/retention/route.ts",
 "netlify/functions/zoom-retention.mts"
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing live-data hardening file: "+file);

const migration=readCanonicalSql();
for(const marker of ["supabase_realtime","schedule_events","onboarding_submissions","class_attendance","student_invoices","trainer_earnings"])if(!migration.includes(marker))throw new Error("Live-data migration missing: "+marker);

const hook=fs.readFileSync("hooks/useLiveRefresh.ts","utf8");
for(const marker of ["postgres_changes","visibilitychange","online","focus","setInterval(","60000","running=false,pending=false","document.visibilityState"])if(!hook.includes(marker))throw new Error("Live refresh hook missing recovery behavior: "+marker);

const pages=[
 "app/admin/onboarding/page.tsx","app/admin/schedule/page.tsx","app/admin/classes/page.tsx","app/admin/progress/page.tsx",
 "app/admin/invoices/page.tsx","app/admin/zoom/page.tsx","app/admin/demos/page.tsx",
 "app/trainer/schedule/page.tsx","app/trainer/classes/page.tsx","app/trainer/progress/page.tsx","app/trainer/earnings/page.tsx",
 "app/parent/page.tsx","app/parent/calendar/page.tsx","app/student/page.tsx","app/student/calendar/page.tsx"
];
for(const page of pages){const text=fs.readFileSync(page,"utf8");if(!text.includes("useLiveRefresh"))throw new Error("Operational page not wired for live refresh: "+page)}

const retention=fs.readFileSync("app/api/zoom/retention/route.ts","utf8");
for(const marker of ["protected_from_deletion","retain_until","action=trash","INTERNAL_CRON_SECRET"])if(!retention.includes(marker))throw new Error("Retention cleanup missing: "+marker);

const demoAdmin=fs.readFileSync("app/admin/demos/page.tsx","utf8");
if(demoAdmin.includes('subscribeNotifications("admin",()=>void load())'))throw new Error("Admin demos must not independently refetch for every notification.");
console.log("Live data and retention hardening checks: OK");
