import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV-only cleanup guard");
assert.ok(key,"QA secret missing");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const ids=["228bf20c-ad9c-4cac-b85c-8f7f80aa6b21","150322c4-7082-47a0-abcd-3521088fe770","fb270ea3-927e-4060-a9f3-3448151838ee","5902ccc0-ec49-46e4-aafa-85b7a109bf7c"];
for(const id of ids){
 const {data,error}=await admin.auth.admin.getUserById(id);
 if(error&&/not found/i.test(error.message)){console.log("Already cleaned",id);continue;}
 assert.ifError(error);
 const user=data?.user;
 assert.ok(user&&/^phase6f-family-(owner|outside|parent|student)-/.test(user.email||""),"Refusing to delete non-Phase6F QA user");
 const res=await admin.auth.admin.deleteUser(id);
 assert.ifError(res.error);
 console.log("Cleaned Phase6F disposable QA user",id);
}
console.log("PASS exact-scope DEV role auth fixtures removed");
