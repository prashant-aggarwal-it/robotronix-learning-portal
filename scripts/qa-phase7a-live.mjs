import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"",anon=process.env.E2E_SUPABASE_ANON_KEY||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","The test must use DEV only");
assert.ok(anon&&key,"DEV QA secrets are missing");
const root="http://127.0.0.1:3000";
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],orgs=[],pending=[];
async function actor(label){
 const email="phase7a-http-"+label+"-"+randomUUID().slice(0,8)+"@example.com";
 const password=randomUUID()+"Aa9!";
 const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(error);
 const id=data.user?.id;assert.ok(id);
 users.push({id,label,email});
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await auth.auth.signInWithPassword({email,password});
 assert.ifError(signed.error);assert.ok(signed.data.session?.access_token);
 return {id,email,token:signed.data.session.access_token};
}
async function call(path,user=null,method="GET",body=null){
 const headers={};
 if(user)headers.Authorization="Bearer "+user.token;
 if(body)headers["Content-Type"]="application/json";
 const res=await fetch(root+path,{headers,method,cache:"no-store",body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(45000)});
 const data=await res.json().catch(()=>null);
 return {status:res.status,body:data};
}
async function invitation(admin,owner,label){
 const slug="phase7a-http-"+label+"-"+randomUUID().slice(0,8);
 const sent=await call("/api/platform-admin/customer-invitations",admin,"POST",{
  name:"Phase7A Temporary "+label,slug,kind:"academy",modules:["academy"],ownerEmail:owner.email
 });
 assert.equal(sent.status,201,"Admin pending invite "+JSON.stringify(sent.body));
 assert.equal(sent.body.delivery,"manual");
 assert.equal(sent.body.invitation.status,"pending");
 const rawToken=new URL(sent.body.invitationUrl).searchParams.get("token");
 assert.match(rawToken||"",/^[0-9a-f]{64}$/);
 pending.push({id:sent.body.invitation.id,slug});
 return {slug,token:rawToken,id:sent.body.invitation.id};
}
async function accept(user,token){
 return call("/api/platform-admin/customer-invitations/accept",user,"POST",{token});
}
try{
 const admin=await actor("admin");
 const owner=await actor("owner");
 const foreign=await actor("foreign");
 const self=await actor("self");
 console.log("PHASE7A_ADMIN_QA_USER_ID="+admin.id);
 console.log("PHASE7A_QA_USERS="+JSON.stringify(users));
 console.log("Waiting for exact-scope DEV-only temporary Platform Admin grant");
 let allowed=false;
 for(let i=0;i<90;i++){
  const {data,error}=await service.rpc("saas_is_platform_admin_v1",{p_actor_id:admin.id});
  if(error)throw error;
  if(data===true){allowed=true;break;}
  await sleep(2000);
 }
 assert.ok(allowed,"BLOCKED: Temporary DEV QA Super Admin grant unavailable");
 assert.equal((await call("/api/platform-admin/customer-invitations",owner,"POST",{
  name:"Unauthorized",slug:"phase7a-wrong-actor",kind:"academy",modules:["academy"],ownerEmail:owner.email
 })).status,403);
 const first=await invitation(admin,owner,"first");
 const existing=await call("/api/platform-admin/customer-invitations",admin);
 assert.equal(existing.status,200);
 assert.ok(existing.body.invitations.some(x=>x.id===first.id&&x.status==="pending"));
 const wrong=await accept(foreign,first.token);
 assert.equal(wrong.status,403,"Wrong-email token rejection "+JSON.stringify(wrong.body));
 const activate=await accept(owner,first.token);
 assert.equal(activate.status,200,"Verified email accept "+JSON.stringify(activate.body));
 assert.ok(activate.body.organizationId);
 orgs.push({id:activate.body.organizationId,slug:first.slug});
 assert.equal((await accept(owner,first.token)).status,403,"Replay cannot activate again");
 const theme=await call("/api/tenant-branding?organizationId="+activate.body.organizationId,owner);
 assert.equal(theme.status,200,"New owner effective theme "+JSON.stringify(theme.body));
 assert.equal(theme.body.branding.level,"standard");
 assert.equal((await call("/api/tenant-branding?organizationId="+activate.body.organizationId,foreign)).status,403);
 console.log("PASS real DEV first invited Owner acceptance and single-use token");
 const second=await invitation(admin,owner,"second");
 const acceptedSecond=await accept(owner,second.token);
 assert.equal(acceptedSecond.status,200,"Existing Owner can join second org "+JSON.stringify(acceptedSecond.body));
 orgs.push({id:acceptedSecond.body.organizationId,slug:second.slug});
 const list=await call("/api/platform/organizations",owner);
 assert.equal(list.status,200);
 assert.ok(list.body.organizations.filter(x=>orgs.some(o=>o.id===x.id)).length>=2,
  "Existing Owner must retain both organizations");
 console.log("PASS existing Owner can accept another academy without duplicate Auth identity");
 const revoked=await invitation(admin,foreign,"revoke");
 assert.equal((await call("/api/platform-admin/customer-invitations",admin,"DELETE",{id:revoked.id})).status,200);
 assert.equal((await accept(foreign,revoked.token)).status,403);
 console.log("PASS revoked Owner link rejected");
 const selfSlug="phase7a-http-self-"+randomUUID().slice(0,8);
 const selfCreated=await call("/api/platform/onboard",self,"POST",{
  name:"Phase7A Temporary Self",slug:selfSlug,kind:"academy",modules:["academy"],requestKey:randomUUID()});
 assert.equal(selfCreated.status,200,"Self signup provision "+JSON.stringify(selfCreated.body));
 orgs.push({id:selfCreated.body.organizationId,slug:selfSlug});
 assert.equal((await call("/api/platform-admin/access",self)).status,403);
 console.log("PASS authenticated self onboarding with trial but without Super Admin");
 console.log("PASS Phase7A real DEV HTTP: invitations, existing Owner, self-registration, wrong-email, revoke, replay, tenant isolation");
}finally{
 console.log("PHASE7A_QA_USERS="+JSON.stringify(users));
 console.log("PHASE7A_QA_ORGS="+JSON.stringify(orgs));
 console.log("PHASE7A_QA_PENDING="+JSON.stringify(pending));
 // Cleanup is handled by the exact-ID guarded DEV SQL and subsequent Auth cleanup.
}
