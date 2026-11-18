import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
const url=process.env.E2E_SUPABASE_URL||"";
const anon=process.env.E2E_SUPABASE_ANON_KEY||"";
const key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","Only the approved DEV project is permitted");
assert.ok(anon&&key,"DEV QA credentials required");
const root="http://127.0.0.1:3000";
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],orgs=[];
async function user(label){
 const email="phase6f-"+label+"-"+randomUUID().slice(0,10)+"@example.com";
 const password=randomUUID()+"Aa9!";
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(created.error);
 const id=created.data.user?.id;assert.ok(id);users.push(id);
 const browser=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await browser.auth.signInWithPassword({email,password});
 assert.ifError(signed.error);assert.ok(signed.data.session?.access_token);
 return {id,email,token:signed.data.session.access_token};
}
async function call(path,actor=null,method="GET",body=null,extra={}){
 const headers={...extra};
 if(actor)headers.Authorization="Bearer "+actor.token;
 if(body&&!(body instanceof FormData))headers["Content-Type"]="application/json";
 const resp=await fetch(root+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,
  cache:"no-store",signal:AbortSignal.timeout(45000)});
 return {status:resp.status,body:await resp.json().catch(()=>null)};
}
async function onboard(actor,label){
 const slug="phase6f-"+label+"-"+randomUUID().slice(0,8);
 const res=await call("/api/platform/onboard",actor,"POST",{
  name:"Phase 6F "+label+" QA",slug,kind:"academy",modules:["academy"],requestKey:randomUUID()});
 assert.equal(res.status,200,"DEV onboarding "+label+" "+JSON.stringify(res.body));
 const id=res.body?.organizationId;assert.match(id||"",/^[0-9a-f-]{36}$/i);
 orgs.push({id,slug});
 return {id,slug};
}
try{
 const a=await user("owner-a"),b=await user("owner-b"),outside=await user("unrelated");
 const orgA=await onboard(a,"a"),orgB=await onboard(b,"b");
 // Exercise genuine organization Admin and Trainer logins via the product's invitation flow.
 for(const role of ["admin","trainer"]){
  const invitee=await user(role);
  const sent=await call("/api/platform/invitations",a,"POST",
   {organizationId:orgA.id,email:invitee.email,role});
  assert.equal(sent.status,201,"Owner invite "+role+" "+JSON.stringify(sent.body));
  const secret=new URL(sent.body.invitationUrl).searchParams.get("token");
  assert.ok(secret);
  const accepted=await call("/api/platform/invitations/accept",invitee,"POST",{token:secret});
  assert.equal(accepted.status,200,"Invite accepted "+role+" "+JSON.stringify(accepted.body));
  assert.equal(accepted.body.organizationId,orgA.id);
  const own=await call("/api/tenant-branding?organizationId="+orgA.id,invitee);
  assert.equal(own.status,200,"Active "+role+" own branding GET "+JSON.stringify(own.body));
  assert.equal(own.body.branding.level,"standard");
  const tier=await call("/api/platform/branding-entitlements?organizationId="+orgA.id,invitee);
  assert.equal(tier.status,200,"Active "+role+" read tier");
  assert.equal((await call("/api/tenant-branding?organizationId="+orgB.id,invitee)).status,403);
  const attempt=await call("/api/branding-studio",invitee,"POST",
   {organizationId:orgA.id,tagline:"Forbidden",logoUrl:"",
    primary:"#235ce2",secondary:"#e83d8c",accent:"#14b8a6"});
  assert.equal(attempt.status,403,"Non-Owner "+role+" must not edit");
  console.log("PASS real DEV HTTP invited "+role+" access, denial of unrelated org and branding mutation");
 }

 for(const [actor,org,foreign] of [[a,orgA,b],[b,orgB,a]]){
  const id=encodeURIComponent(org.id);
  const entitlement=await call("/api/platform/branding-entitlements?organizationId="+id,actor);
  assert.equal(entitlement.status,200,"Owner tier GET "+JSON.stringify(entitlement.body));
  assert.equal(entitlement.body.level,"standard");
  const theme=await call("/api/tenant-branding?organizationId="+id,actor);
  assert.equal(theme.status,200,"Owner actual theme "+JSON.stringify(theme.body));
  assert.equal(theme.body.branding.level,"standard");
  assert.equal(theme.body.branding.logoUrl,"");
  assert.equal(theme.body.branding.theme.primary,"#6d3cc9");
  assert.equal((await call("/api/tenant-branding?organizationId="+id)).status,401);
  assert.equal((await call("/api/tenant-branding?organizationId="+id,outside)).status,403);
  assert.equal((await call("/api/tenant-branding?organizationId="+id,foreign)).status,403);
  assert.equal((await call("/api/platform/branding-entitlements?organizationId="+id,foreign)).status,403);
  const unauthorizedSave=await call("/api/branding-studio",actor,"POST",{
   organizationId:org.id,tagline:"Disallowed",logoUrl:"",
   primary:"#235ce2",secondary:"#e83d8c",accent:"#14b8a6"});
  assert.equal(unauthorizedSave.status,403,"Standard owner save must be denied "+JSON.stringify(unauthorizedSave.body));
  const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xZkAAAAASUVORK5CYII=","base64");
  const form=new FormData();form.append("logo",new Blob([image],{type:"image/png"}),"qa.png");
  const upload=await call("/api/branding-studio/upload",actor,"POST",form,{"x-branding-organization":org.id});
  assert.equal(upload.status,403,"Standard owner upload must be denied "+JSON.stringify(upload.body));
  const upgrade=await call("/api/platform/branding-entitlements",actor,"POST",{organizationId:org.id,level:"white_label"});
  assert.equal(upgrade.status,403,"Owner cannot self-upgrade "+JSON.stringify(upgrade.body));
  const invalid=await call("/api/platform/branding-entitlements",actor,"POST",{organizationId:"invalid",level:"custom"});
  assert.equal(invalid.status,400);
  const anonymousBrand=await admin.rpc("saas_public_academy_brand",{p_slug:org.slug});
  assert.ifError(anonymousBrand.error);
  if(anonymousBrand.data){assert.equal(anonymousBrand.data.logoUrl,"");
   assert.equal(anonymousBrand.data.accentColor,"#6d3cc9");
   assert.equal(anonymousBrand.data.level,"standard");
  }else console.log("NOT VERIFIED: public login brand requires active paid/trial subscription for",org.slug);
  console.log("PASS real DEV HTTP owner",org.slug,"default tier, tenant isolation, forbidden writes/uploads/escalation");
 }
 assert.equal((await call("/api/tenant-branding?organizationId="+orgA.id,{token:"invalid.jwt"})).status,401);
 console.log("PASS real DEV HTTP: two separately authenticated owners, unrelated actor, invalid bearer.");
}finally{
 for(const uid of users){
  const {error}=await admin.auth.admin.deleteUser(uid);
  if(error){console.error("DEV QA auth cleanup failure",uid,error.message);process.exitCode=1;}
 }
 for(const org of orgs)console.log("DEV QA organization for exact-scope cleanup",org.slug,org.id);
}
