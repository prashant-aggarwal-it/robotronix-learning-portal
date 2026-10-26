// Static guardrails for P2/P3 coverage. Runs without DEV credentials.
// Not a substitute for authenticated Supabase Realtime, RLS or Playwright tests.
import {readFileSync} from "node:fs";
import {readCanonicalSql} from "./read-canonical-sql.mjs";
const read=(p)=>p==="__CANONICAL_SCHEMA__"?readCanonicalSql():readFileSync(new URL("../"+p,import.meta.url),"utf8");
const required={
 "hooks/useLiveRefresh.ts":["postgres_changes","visibilitychange","setInterval","removeChannel","navigator.onLine"],
 "components/NotificationBell.tsx":["subscribeNotifications","visibilitychange","setInterval"],
 "components/NotificationCenter.tsx":["subscribeNotifications","visibilitychange","setInterval"],
 "app/trainer/profile/page.tsx":["useLiveRefresh","trainer_finance_change_requests","trainer_finance"],
 "app/admin/trainers/[id]/page.tsx":["useLiveRefresh","trainer_finance_change_requests"],
 "app/admin/enrollments/page.tsx":["useLiveRefresh","enrollments"],
 "app/admin/enrollments/[id]/page.tsx":["useLiveRefresh","enrollments"],
 "app/admin/trainer-finance/[trainerId]/page.tsx":["useLiveRefresh","trainer_earnings"],
 "app/admin/trainers/page.tsx":["useLiveRefresh","trainers"],
 "app/admin/students/page.tsx":["useLiveRefresh","enrollments"],
 "app/admin/trainer-finance/page.tsx":["useLiveRefresh","trainer_payouts"],
 "app/admin/page.tsx":["useLiveRefresh","onboarding_submissions"],
 "app/trainer/page.tsx":["useLiveRefresh","schedule_events"],
 "app/admin/alerts/page.tsx":["useLiveRefresh","schedule_events"],
 "app/parent/learner/[studentId]/page.tsx":["useLiveRefresh","class_attendance"],
 "__CANONICAL_SCHEMA__":["supabase_realtime","trainer_finance_change_requests","portal_notifications","communication_messages"]
};
let failures=0;
for(const [file,terms] of Object.entries(required)){
 const c=read(file);
 const missing=terms.filter(term=>!c.includes(term));
 if(missing.length){console.error("FAIL",file,"missing:",missing.join(", "));failures++;}
 else console.log("PASS",file);
}
if(failures)process.exitCode=1;
