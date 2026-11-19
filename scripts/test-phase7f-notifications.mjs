import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("tenant queue has idempotency, RLS, opt-in defaults and retry index",()=>{
 const s=read("database/saas/90_phase7f_notification_queue.sql");
 for(const t of ["unique(organization_id,idempotency_key)","enable row level security","default false","academy_email_jobs_due_idx","from public,anon,authenticated"])assert.ok(s.includes(t),t);
});
test("worker atomically claims due jobs with row locks",()=>{
 const s=read("database/saas/91_phase7f_atomic_claim.sql");
 for(const t of ["for update skip locked","attempts<5","status='sending'","to service_role"])assert.ok(s.includes(t),t);
});
test("worker uses academy providers only, opt-in, retries and terminal failure",()=>{
 const s=read("lib/server/saas/academy-notifications.ts");
 for(const t of ["sendAcademyGmail","sendAcademySmtp","pref?.enabled","provider_unavailable","idempotency_key","terminal?\"failed\":\"retry\""])assert.ok(s.includes(t.replaceAll("\\","")),t);
 assert.ok(!s.includes("SMTP_FROM_EMAIL"));
});
test("worker endpoint requires a separate secret",()=>{
 const s=read("app/api/internal/academy-notifications/process/route.ts");
 assert.ok(s.includes("ACADEMY_NOTIFICATION_WORKER_SECRET"));
 assert.ok(s.includes("expected.length<32"));
});
test("preferences require tenant owner/admin and verified provider",()=>{
 const s=read("app/api/academy/email-notifications/preferences/route.ts");
 for(const t of ["roleHasCapability","academy.settings.manage","sender_verified_at","enabledEvents"])assert.ok(s.includes(t),t);
});
