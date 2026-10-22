import {test,expect} from "@playwright/test";
import {loadQaEnv,isProductionSanity} from "./env";

/**
 * Non-destructive security HTTP checks, explicitly scoped to DEV/staging.
 * No credential guessing, enumeration, injection payloads or production testing.
 */
function devOrigin(){
 loadQaEnv();
 if(isProductionSanity()||process.env.QA_TARGET==="production")throw new Error("Refusing security HTTP tests on production");
 if(process.env.SECURITY_QA_DEV_ACK!=="I_UNDERSTAND_DEV_ONLY")throw new Error("DEV security test acknowledgment missing");
 const base=process.env.QA_BASE_URL||"";
 const expected=process.env.SECURITY_QA_DEV_APP_ORIGIN||"";
 if(!base||!expected||new URL(base).origin!==new URL(expected).origin)throw new Error("Configured DEV HTTP target origin mismatch");
 const hostname=new URL(base).hostname.toLowerCase();
 if(hostname==="portal.robotronixstemlab.com"||hostname==="robotronixstemlab.com")
   throw new Error("Production host not authorized for DEV security HTTP tests");
 return base.replace(/\/$/,"");
}
test.describe("DEV-only negative HTTP security checks",()=>{
 test.beforeAll(()=>{devOrigin()});
 test("anonymous Admin logs request is rejected",async({request})=>{
  const res=await request.get(devOrigin()+"/api/admin/system-logs");
  expect([401,503]).toContain(res.status());
  expect((await res.text()).toLowerCase()).not.toContain("service_role");
 });
 test("anonymous Zoom schedule mutation is rejected",async({request})=>{
  const res=await request.post(devOrigin()+"/api/zoom/schedule/sync",{data:{scheduleEventId:"00000000-0000-4000-8000-000000000099",action:"sync"}});
  expect([401,503]).toContain(res.status());
 });
 test("Razorpay webhook rejects oversized payload without processing",async({request})=>{
  const res=await request.post(devOrigin()+"/api/razorpay/webhook",{
   headers:{"content-type":"application/json"},
   data:"x".repeat(1024*1024+1)
  });
  expect(res.status()).toBe(413);
 });
 test("application sends clickjacking and MIME security headers",async({request})=>{
  const res=await request.get(devOrigin()+"/login");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
 });
});
