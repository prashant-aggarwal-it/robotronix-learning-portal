import {test,expect} from "@playwright/test";
import fs from "node:fs";

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
  const source=fs.readFileSync("database/01_install/01_CREATE_SCHEMA.sql","utf8");
  for(const name of ["generate_enrollment_schedule_v2","generate_cohort_schedule_v2","reassign_enrollment_trainer_v2","reassign_cohort_trainer_v2","resolve_class_cancellation_v2"]){
   expect(source).toContain("revoke all on function public."+name+"(");
   const i=source.toLowerCase().indexOf("create or replace function public."+name+"(");
   expect(i).toBeGreaterThan(-1);
   expect(source.slice(i,i+1600)).toContain("public.is_admin()");
  }
 });
});
