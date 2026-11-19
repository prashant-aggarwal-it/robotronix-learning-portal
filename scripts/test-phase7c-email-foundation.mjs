import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("academy email credentials and event tables are service-role only",()=>{
 const sql=src("database/saas/86_phase7c_academy_email_foundation.sql");
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/revoke all on saas.academy_email_connections from public,anon,authenticated/);
 assert.match(sql,/revoke all on saas.academy_email_delivery_events from public,anon,authenticated/);
 assert.match(sql,/unique\(organization_id,idempotency_key\)/);
 assert.match(sql,/connected_requires_verified_sender/);
});
test("academy sender fails closed, never uses platform Hostinger transport",()=>{
 const s=src("lib/server/saas/academy-email.ts");
 assert.match(s,/getAuthorizedOrganizations/);
 assert.match(s,/resolveAuthorizedOrganization/);
 assert.match(s,/Connect and verify your academy email account/);
 assert.doesNotMatch(s,/sendEmail\(|SMTP_PASSWORD|SMTP_FROM_EMAIL/);
});
test("academy email status route is authenticated and read-only",()=>{
 const s=src("app/api/academy/email-connections/route.ts");
 assert.match(s,/readBearerToken/);
 assert.match(s,/academyEmailStatus/);
 assert.match(s,/no-store/);
 assert.doesNotMatch(s,/export async function POST|export async function PUT/);
});

test("delivery events cannot reference another tenant's connection",()=>{
 const sql=src("database/saas/87_phase7c_connection_tenant_integrity.sql");
 assert.match(sql,/foreign key \\(connection_id,organization_id\\)/i);
 assert.match(sql,/references saas\\.academy_email_connections\\(id,organization_id\\)/i);
});
test("email settings require academy settings capability",()=>{
 const s=src("lib/server/saas/academy-email.ts");
 assert.match(s,/roleHasCapability\\(organization\\.role,"academy\\.settings\\.manage"\\)/);
});
test("email settings screen cannot connect or send through an unverified provider",()=>{
 const s=src("app/[academySlug]/manage/email/page.tsx");
 assert.match(s,/Connection setup not yet available/);
 assert.match(s,/owner","admin/);
 assert.doesNotMatch(s,/sendEmail\\(|method:"POST"/);
});
