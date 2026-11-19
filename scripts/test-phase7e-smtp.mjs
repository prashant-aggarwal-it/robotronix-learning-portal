import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("SMTP secret table is restricted to service role",()=>{
 const s=read("database/saas/89_phase7e_academy_smtp_credentials.sql");
 assert.ok(s.includes("enable row level security"));
 assert.ok(s.includes("from public,anon,authenticated"));
});
test("SMTP transport requires TLS and blocks private addresses",()=>{
 const s=read("lib/server/saas/academy-smtp-transport.ts");
 for(const x of ["requireTLS:!s.secure","rejectUnauthorized:true","resolvePublicSmtpHost","publicIPv4","transport.verify()","result.accepted"])assert.ok(s.includes(x),x);
});
test("SMTP connection requires tenant authorization and encrypted secrets",()=>{
 const s=read("lib/server/saas/academy-smtp.ts");
 for(const x of ['roleHasCapability(org.role,"academy.settings.manage")',"seal(settings.password)","unseal(credential.encrypted_password)","verifyAcademySmtp","senderEmail.toLowerCase()!==settings.username.toLowerCase()"])assert.ok(s.includes(x),x);
 assert.ok(!s.includes("SMTP_FROM_EMAIL"));
});
test("SMTP route has no unauthenticated send endpoint",()=>{
 const s=read("app/api/academy/email-connections/smtp/route.ts");
 assert.ok(s.includes("readBearerToken"));
 assert.ok(s.includes("connectAcademySmtp"));
 assert.ok(s.includes("disconnectAcademySmtp"));
 assert.ok(!s.includes("sendAcademySmtp"));
});
