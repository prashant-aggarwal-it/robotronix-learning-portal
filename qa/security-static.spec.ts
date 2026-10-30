import {test,expect} from "@playwright/test";
import fs from "node:fs";
import {readCanonicalSql} from "../scripts/read-canonical-sql.mjs";

test.describe("Security invariants (offline, no production network)",()=>{
 test("Admin API checks verified identity, active profile and role",()=>{
  const source=fs.readFileSync("lib/server/admin-api.ts","utf8");
  expect(source).toContain("admin.auth.getUser(token)");
  expect(source).toContain('profile?.role!=="admin"');
  expect(source).toContain("!profile.active");
 });
 test("Security headers prevent framing and content-type sniffing",()=>{
  const source=fs.readFileSync("next.config.ts","utf8");
  expect(source).toContain('key: "X-Frame-Options", value: "DENY"');
  expect(source).toContain('key: "X-Content-Type-Options", value: "nosniff"');
  expect(source).toContain("frame-ancestors 'none'");
 });
 test("Razorpay webhook verifies signed raw payload before processing",()=>{
  const source=fs.readFileSync("app/api/razorpay/webhook/route.ts","utf8");
  expect(source.indexOf("verifyRazorpayWebhook(raw,sig)")).toBeGreaterThan(0);
  expect(source.indexOf("verifyRazorpayWebhook(raw,sig)")).toBeLessThan(source.indexOf("JSON.parse(raw)"));
 });
 test("Scheduling RPCs are restricted and enforce roles server-side",()=>{
  const source=readCanonicalSql();
  for(const name of ["generate_enrollment_schedule_v2","generate_cohort_schedule_v2","reassign_enrollment_trainer_v2","reassign_cohort_trainer_v2","resolve_class_cancellation_v2"]){
   expect(source).toContain("revoke all on function public."+name+"(");
   const i=source.toLowerCase().indexOf("create or replace function public."+name+"(");
   expect(i).toBeGreaterThan(-1);
   expect(source.slice(i,i+1600)).toContain("public.is_admin()");
  }
 });
});

test.describe("Bounded webhook request reader",()=>{
 test("returns the precise signed UTF-8 payload under the limit",async()=>{
  const {readTextBodyLimited}=await import("../lib/server/read-limited-body");
  const body='{"note":"安全"}';
  expect(await readTextBodyLimited(new Request("https://example.test/webhook",{method:"POST",body}),64)).toBe(body);
 });
 test("refuses Content-Length above limit before processing",async()=>{
  const {readTextBodyLimited,RequestBodyTooLarge}=await import("../lib/server/read-limited-body");
  const req=new Request("https://example.test/webhook",{method:"POST",body:"x",headers:{"content-length":"4000"}});
  await expect(readTextBodyLimited(req,32)).rejects.toBeInstanceOf(RequestBodyTooLarge);
 });
 test("rejects oversize streaming body when Content-Length is absent",async()=>{
  const {readTextBodyLimited,RequestBodyTooLarge}=await import("../lib/server/read-limited-body");
  const req=new Request("https://example.test/webhook",{method:"POST",body:"x".repeat(33)});
  await expect(readTextBodyLimited(req,32)).rejects.toBeInstanceOf(RequestBodyTooLarge);
 });
});

test("Zoom token encryption enforces full AES-GCM authentication tag",()=>{
 const source=fs.readFileSync("lib/server/zoom.ts","utf8");
 expect(source).toContain('createCipheriv("aes-256-gcm",encryptionKey(),iv,{authTagLength:16})');
 expect(source).toContain('createDecipheriv("aes-256-gcm",encryptionKey(),iv,{authTagLength:16})');
 expect(source).toContain('tag.length!==16');
 expect(source).toContain('iv.length!==12');
});

test("Zoom privacy policy is a public, server-rendered route linked before sign-in",()=>{
 const page=fs.readFileSync("app/privacy/page.tsx","utf8");
 expect(page).toContain('https://portal.robotronixstemlab.com/privacy');
 expect(page).toContain('mailto:info@robotronixstemlab.com');
 expect(page).toContain('Zoom Trash');
 expect(page).toContain('Default retention: 60 days');
 expect(page).not.toContain('"use client"');
 expect(page).not.toContain('RoleGuard');
 expect(fs.readFileSync("app/page.tsx","utf8")).toContain('href="/privacy"');
 expect(fs.readFileSync("app/login/page.tsx","utf8")).toContain('href="/privacy"');
 expect(fs.readFileSync("app/onboarding/page.tsx","utf8")).toContain('href="/privacy"');
});


test.describe("Zoom authorization and privacy regressions",()=>{
 test("unmatched or ambiguous webhook participant identity is never guessed",()=>{
  const source=fs.readFileSync("app/api/zoom/webhook/route.ts","utf8");
  expect(source).toContain("matches.length===1?matches[0]:null");
  expect(source).not.toContain("||rows[0]||null");
 });
 test("recording endpoints do not expose provider or database errors",()=>{
  const source=fs.readFileSync("app/api/zoom/recordings/[recordingId]/route.ts","utf8");
  expect(source).toContain('error:"Unable to process recording request."');
  expect(source).not.toContain('error:error instanceof Error?error.message:String(error)');
 });
 test("OAuth callback does not disclose raw provider failure messages via redirect",()=>{
  const source=fs.readFileSync("app/api/zoom/oauth/callback/route.ts","utf8");
  expect(source).toContain('base.searchParams.set("zoom_error","Unable to connect Zoom account.');
  expect(source).not.toContain('base.searchParams.set("zoom_error",error instanceof Error?error.message:String(error))');
 });
});
