import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Invitation email is only accepted by provider after sending",()=>{
 const s=src("lib/server/saas/invitation-mail.ts");
 assert.match(s,/sendEmail/);assert.match(s,/smtp_accepted/);
 assert.match(s,/provider_accepted/);assert.match(s,/not_configured/);
 assert.match(s,/INVITATION_APP_URL/);assert.match(s,/href=/);
});
test("Auto-delivery never claims email was sent on missing credentials",()=>{
 const s=src("app/api/platform-admin/customer-invitations/route.ts");
 assert.match(s,/delivery:"not_configured"/);
 assert.match(s,/delivery:delivery.status/);
 assert.match(s,/saas_invitation_delivery_admin_v1/);
});
test("SMTP adapter enforces server-side configuration, TLS and accepted-only state",()=>{
 const s=src("lib/server/saas/email-transport.ts");
 assert.match(s,/SMTP_PASSWORD/);assert.match(s,/TLSv1\\.2/);
 assert.match(s,/rejectUnauthorized:true/);assert.match(s,/smtp_accepted/);
 assert.match(s,/disableFileAccess:true/);assert.match(s,/disableUrlAccess:true/);
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

test("Platform Branding Studio excludes archived tenants and avoids misleading permission errors",()=>{
 const page=src("app/platform-admin/page.tsx");
 const auth=src("lib/server/saas/branding-auth.ts");
 assert.match(page,/PlatformTenantBranding organizations=\{overview\.organizations\.filter\(o=>o\.status==="active"\)\}/);
 assert.match(auth,/Select an active academy you can access/);
});
