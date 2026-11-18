import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV-only cleanup guard");
assert.ok(key,"QA secret missing");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const ids=["2509e3bf-a5c5-4295-95a8-5a6ae9b2a898","cb45956f-bd80-4f2b-8388-5c5ac3fb6a76"];
for(const id of ids){
 const {data,error}=await admin.auth.admin.getUserById(id);
 if(error&&/not found/i.test(error.message)){console.log("Already cleaned",id);continue;}
 assert.ifError(error);
 const user=data?.user;
 assert.ok(user&&user.email?.startsWith("phase6f-owner-"),"Refusing to delete non-Phase6F QA user");
 const res=await admin.auth.admin.deleteUser(id);
 assert.ifError(res.error);
 console.log("Cleaned Phase6F disposable QA user",id);
}
console.log("PASS two orphaned disposable auth fixtures removed");
