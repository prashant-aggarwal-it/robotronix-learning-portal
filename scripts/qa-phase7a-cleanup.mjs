import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV-only exact cleanup");
assert.ok(key,"Missing QA secret");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[
 ["ee9366ef-0c5b-4fbf-8f87-ce552b2e9f79","phase7a-http-admin-dcfc79d1@example.com"],
 ["1080ee10-0312-46f5-b8b2-49744577c83c","phase7a-http-owner-b61c993b@example.com"],
 ["28a8bebd-c29d-479f-8f9d-1a0e5a88ac58","phase7a-http-foreign-b9168bcb@example.com"],
 ["e17f9c95-b2b5-40ce-9e5d-df15587267bc","phase7a-http-self-3955affc@example.com"]
];
for(const [id,email] of users){
 const {data,error}=await db.auth.admin.getUserById(id);
 if(error&&/not found/i.test(error.message)){console.log("Already absent",id);continue}
 assert.ifError(error);
 assert.equal(data.user?.email,email,"Never delete non-QA user");
 const result=await db.auth.admin.deleteUser(id);
 assert.ifError(result.error);
 console.log("PASS cleaned disposable Phase7A Auth user",id);
}
console.log("PASS Phase7A real DEV HTTP test account cleanup");
