import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("app/auth/callback/page.tsx","utf8");
test("callback distinguishes signup confirmation from OAuth",()=>{
 assert.match(source,/signupConfirmation=fragment\.get\("type"\)==="signup"/);
 assert.match(source,/exchangeCodeForSession\(code\)/);
 assert.match(source,/if\(signupConfirmation\)/);
});
test("verified message requires a checked Supabase user",()=>{
 assert.match(source,/supabase\.auth\.getUser\(\)/);
 assert.match(source,/!user\?\.email_confirmed_at/);
 assert.match(source,/Email verified successfully!/);
 assert.match(source,/await supabase\.auth\.signOut\(\)/);
});
test("invalid and reused verification links have actionable feedback",()=>{
 assert.match(source,/error_code/);
 assert.match(source,/otp_expired/);
 assert.match(source,/already verified/);
 assert.match(source,/Go to sign in/);
 assert.match(source,/window\.history\.replaceState/);
});
