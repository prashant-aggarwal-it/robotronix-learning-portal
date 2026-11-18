import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV-only cleanup guard");
assert.ok(key,"QA secret missing");
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const ids=["d5de4eec-a1fa-4a9b-8d6e-8926b2063c19","ca68272f-3378-4362-a6ac-e832cc57085e","e4acabf2-b824-481b-b4ad-c677a45db45e","b31dbbeb-1dca-48c1-a6ff-c18d89441542"];
for(const id of ids){
 const {data,error}=await admin.auth.admin.getUserById(id);
 if(error&&/not found/i.test(error.message)){console.log("Already cleaned",id);continue;}
 assert.ifError(error);
 const user=data?.user;
 assert.ok(user&&/^phase6f-(owner|admin|trainer)-/.test(user.email||""),"Refusing to delete non-Phase6F QA user");
 const res=await admin.auth.admin.deleteUser(id);
 assert.ifError(res.error);
 console.log("Cleaned Phase6F disposable QA user",id);
}
console.log("PASS exact-scope DEV role auth fixtures removed");
