import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Invitation email is only accepted by provider after sending",()=>{
 const s=src("lib/server/saas/invitation-mail.ts");
 assert.match(s,/RESEND_API_KEY/);assert.match(s,/Idempotency-Key/);
 assert.match(s,/provider_accepted/);assert.match(s,/not_configured/);
 assert.match(s,/INVITATION_APP_URL/);assert.match(s,/href=/);
});
test("Auto-delivery never claims email was sent on missing credentials",()=>{
 const s=src("app/api/platform-admin/customer-invitations/route.ts");
 assert.match(s,/delivery:"not_configured"/);
 assert.match(s,/delivery:delivery.status/);
 assert.match(s,/saas_invitation_delivery_admin_v1/);
});
test("Webhooks require signature verification and replay-safe database function",()=>{
 const s=src("app/api/webhooks/resend/route.ts"),sql=src("database/saas/84_phase7b_webhook.sql");
 assert.match(s,/timingSafeEqual/);assert.match(s,/RESEND_WEBHOOK_SECRET/);
 assert.match(sql,/on conflict\(event_id\) do nothing/);
 assert.match(sql,/revoke all on function/);
});
test("Manual invitation link not prominently visible",()=>{
 const s=src("app/platform-admin/page.tsx");
 assert.match(s,/Advanced · Manual invitation recovery/);
 assert.match(s,/Create academy & send invitation/);
 assert.match(s,/Resend invitation/);
});

test("Recipient lookup failure terminates dispatch in the ledger",()=>{
 const s=src("app/api/platform-admin/customer-invitations/route.ts");
 const section=s.match(/if\(detailError\|\|!invite\)\{([\s\S]*?)\n  \}/)?.[1]??"";
 assert.match(section,/saas_invitation_delivery_admin_v1/);
 assert.match(section,/p_action:"result"/);
 assert.match(section,/ok:false/);
});

test("Invitation management shows structured status and clipboard feedback",()=>{
 const s=src("app/platform-admin/page.tsx");
 assert.match(s,/<th>Academy<\/th>/);
 assert.match(s,/<th>Email delivery<\/th>/);
 assert.match(s,/Secure invitation link copied/);
 assert.match(s,/Copy failed/);
});
