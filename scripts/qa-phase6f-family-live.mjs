import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",anon=process.env.E2E_SUPABASE_ANON_KEY||"",secret=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV-only");
assert.ok(anon&&secret,"DEV secrets missing");
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],orgs=[],students=[];
async function user(label){
 const email="phase6f-family-"+label+"-"+randomUUID().slice(0,8)+"@example.com",password=randomUUID()+"Aa9!";
 const added=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(added.error);const id=added.data.user?.id;assert.ok(id);
 users.push({id,label,email});
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await client.auth.signInWithPassword({email,password});
 assert.ifError(auth.error);assert.ok(auth.data.session?.access_token);
 return {id,email,client,token:auth.data.session.access_token};
}
async function call(path,actor,method="GET",body=null){
 const headers={};if(actor)headers.Authorization="Bearer "+actor.token;
 if(body)headers["Content-Type"]="application/json";
 const res=await fetch("http://127.0.0.1:3000"+path,{headers,method,
  body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(40000)});
 return {status:res.status,body:await res.json().catch(()=>null)};
}
async function onboard(actor,label){
 const slug="phase6f-family-"+label+"-"+randomUUID().slice(0,8);
 const res=await call("/api/platform/onboard",actor,"POST",{
  name:"Phase 6F Family "+label,slug,kind:"academy",modules:["academy"],requestKey:randomUUID()});
 assert.equal(res.status,200,"Onboard "+JSON.stringify(res.body));
 const id=res.body?.organizationId;assert.ok(id);orgs.push({id,slug});return {id,slug};
}
try{
 const owner=await user("owner"),other=await user("outside");
 const a=await onboard(owner,"a"),b=await onboard(other,"b");
 const created=await call("/api/platform/academy/students",owner,"POST",{
  organizationId:a.id,full_name:"Phase 6F Synthetic Learner",grade:"8",school:"QA Synthetic School"});
 assert.equal(created.status,201,"Create DEV QA student "+JSON.stringify(created.body));
 const studentId=created.body?.data?.id;assert.ok(studentId);students.push(studentId);
 for(const role of ["parent","student"]){
  const invitee=await user(role);
  const token=randomUUID().replaceAll("-","")+randomUUID().replaceAll("-","");
  const {data:inv,error:inviteError}=await owner.client.rpc("saas_invite_academy_family",{
   p_organization_id:a.id,p_student_id:studentId,p_email:invitee.email,p_access_role:role,
   p_token_sha256:createHash("sha256").update(token).digest("hex")
  });
  assert.ifError(inviteError);assert.ok(inv,"Invitation "+role);
  const accepted=await invitee.client.rpc("saas_accept_academy_family_invite",{
   p_token_sha256:createHash("sha256").update(token).digest("hex")
  });
  assert.ifError(accepted.error);
  assert.equal(accepted.data?.organizationId,a.id);
  assert.equal(accepted.data?.accessRole,role);
  const discovery=await call("/api/platform/organizations",invitee);
  assert.equal(discovery.status,200,"Family discovery "+role+" "+JSON.stringify(discovery.body));
  assert.ok(discovery.body.organizations.some(o=>o.id===a.id));
  const branding=await call("/api/tenant-branding?organizationId="+a.id,invitee);
  assert.equal(branding.status,200,"Family branded context "+role+" "+JSON.stringify(branding.body));
  assert.equal(branding.body.branding.level,"standard");
  assert.equal(branding.body.branding.logoUrl,"");
  assert.equal(branding.body.branding.theme.primary,"#6d3cc9");
  assert.equal((await call("/api/platform/branding-entitlements?organizationId="+a.id,invitee)).status,200);
  assert.equal((await call("/api/tenant-branding?organizationId="+b.id,invitee)).status,403);
  assert.equal((await call("/api/branding-studio?organizationId="+a.id,invitee)).status,403);
  assert.equal((await call("/api/branding-studio",invitee,"POST",{
   organizationId:a.id,tagline:"Do not permit",logoUrl:"",
   primary:"#235ce2",secondary:"#e83d8c",accent:"#14b8a6"
  })).status,403);
  console.log("PASS real authenticated family "+role+" invitation, membership, tenant branding, cross-tenant and edit denial");
 }
 console.log("PASS Phase6F real DEV Parent and Student branding API acceptance");
}finally{
 console.log("PHASE6F_FAMILY_QA_USERS="+JSON.stringify(users.map(({id,label})=>({id,label}))));
 console.log("PHASE6F_FAMILY_QA_ORGS="+JSON.stringify(orgs));
 console.log("PHASE6F_FAMILY_QA_STUDENTS="+JSON.stringify(students));
 // Exact-scope database and Auth cleanup runs after QA; last-owner trigger remains enforced.
}
