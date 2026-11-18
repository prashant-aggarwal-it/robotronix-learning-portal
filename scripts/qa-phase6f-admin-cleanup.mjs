import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV-only cleanup");
assert.ok(key,"Service role QA secret missing");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const org="05dd050f-dc92-4556-acca-b509917492a9",slug="phase6f-admin-a-10380373";
const path=org+"/logo-421c871a-7fda-4f0f-9e09-4d01a063f373.png";
const expected=[["722c2843-0582-440a-b1d8-1de0f1284d39","phase6f-privileged-owner-"],["e490eda3-f7dd-4487-91c6-8838d9c47fda","phase6f-privileged-outsider-"],["2c2e2dae-b3ed-4eb2-adb4-bae4a5ac2188","phase6f-platform-qa-"]];
const {error:removed}=await db.storage.from("tenant-brand-logos").remove([path]);
assert.ifError(removed);
console.log("PASS exact QA uploaded logo removed",slug);
for(const [id,prefix] of expected){
 const {data,error}=await db.auth.admin.getUserById(id);
 if(error&&/not found/i.test(error.message)){console.log("Already deleted",id);continue;}
 assert.ifError(error);
 assert.ok(data.user?.email?.startsWith(prefix)&&data.user.email.endsWith("@example.com"),
 "Refusing to remove an unexpected non-QA user");
 const out=await db.auth.admin.deleteUser(id);assert.ifError(out.error);
 console.log("PASS removed exact disposable QA auth user",prefix);
}
console.log("PASS Phase 6F real Super Admin fixture cleanup");
