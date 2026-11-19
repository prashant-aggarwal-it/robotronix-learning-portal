import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("OAuth start uses PKCE, short-lived state and Gmail send-only scope",()=>{
 const s=read("lib/server/saas/google-email-oauth.ts");
 assert.ok(s.includes("code_challenge_method"));
 assert.ok(s.includes("gmail.send"));
 assert.ok(s.includes("600000"));
 assert.ok(s.includes("roleHasCapability"));
});
test("OAuth callback consumes state once and encrypts tokens",()=>{
 const s=read("app/api/academy/email-connections/google/callback/route.ts");
 for(const token of ['.delete()','code_verifier','seal(tokens.refresh_token)','email_verified','saas_authorized_organizations'])assert.ok(s.includes(token),token);
});
test("Gmail sender is separate from platform SMTP and refreshes tokens",()=>{
 const s=read("lib/server/saas/google-email-send.ts");
 for(const token of ["organization_id","gmail.googleapis.com/gmail/v1/users/me/messages/send","grant_type:\"refresh_token\"","unseal("])assert.ok(s.includes(token),token);
 assert.ok(!s.includes("SMTP_FROM_EMAIL"));
});
test("Private credential tables have RLS and no authenticated access",()=>{
 const s=read("database/saas/88_phase7d_google_oauth_secret_storage.sql");
 assert.ok(s.includes("enable row level security"));
 assert.ok(s.includes("from public,anon,authenticated"));
});
