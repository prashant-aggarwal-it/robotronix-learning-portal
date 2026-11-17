import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";

const url=process.env.E2E_SUPABASE_URL||"";
const anon=process.env.E2E_SUPABASE_ANON_KEY||"";
const key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","Only the approved DEV Supabase project is permitted");
assert.ok(anon&&key,"DEV test keys required");
const base="http://127.0.0.1:3000";
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
let orgId="",published=null,uploadedPath="",ownerToken="";
async function actor(label){
 const email="phase5c-"+label+"-"+randomUUID().slice(0,12)+"@example.com";
 const password=randomUUID()+"Aa9!";
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(error);assert.ok(data.user?.id);
 users.push(data.user.id);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await client.auth.signInWithPassword({email,password});
 assert.ifError(signed.error);assert.ok(signed.data.session?.access_token);
 return signed.data.session.access_token;
}
async function call(path,token="",method="GET",body=null,extra={}){
 const headers={...extra};
 if(token)headers.Authorization="Bearer "+token;
 if(body&&!(body instanceof FormData))headers["Content-Type"]="application/json";
 const response=await fetch(base+path,{method,headers,cache:"no-store",signal:AbortSignal.timeout(40000),
  body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 return {status:response.status,value:await response.json().catch(()=>null)};
}
function brandBody(from){
 const saved=from?.branding||{},p=saved.palette||{};
 return {organizationId:orgId,tagline:saved.tagline||"",logoUrl:saved.logoUrl||"",
 primary:p.primary||saved.accentColor||"#6d3cc9",secondary:p.secondary||"#e83d8c",accent:p.accent||"#14b8a6"};
}
try{
 ownerToken=await actor("owner");
 const outsider=await actor("outsider");
 const slug="phase5c-qa-"+randomUUID().slice(0,10);
 const onboard=await call("/api/platform/onboard",ownerToken,"POST",
  {name:"Disposable Phase 5C QA",slug,kind:"academy",modules:["academy"],requestKey:randomUUID()});
 assert.equal(onboard.status,200,"DEV onboarding: "+JSON.stringify(onboard.value));
 orgId=onboard.value?.organizationId;
 assert.match(orgId||"",/^[a-f0-9-]{36}$/i);
 console.log("DEV test organization",slug,orgId);
 const route="/api/branding-studio?organizationId="+orgId;
 const theme="/api/tenant-branding?organizationId="+orgId;
 const initial=await call(route,ownerToken);
 assert.equal(initial.status,200,"Owner branding GET: "+JSON.stringify(initial.value));
 published=initial.value;
 assert.equal((await call(theme,ownerToken)).status,200);
 assert.equal((await call(theme)).status,401);
 assert.equal((await call(theme,outsider)).status,403);
 const original=brandBody(published);
 // Valid 1x1 PNG, used only in synthetic DEV storage.
 const image=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xZkAAAAASUVORK5CYII=","base64");
 const form=new FormData();
 form.append("logo",new Blob([image],{type:"image/png"}),"qa.png");
 const uploaded=await call("/api/branding-studio/upload",ownerToken,"POST",form,{"x-branding-organization":orgId});
 assert.equal(uploaded.status,200,"Real Storage upload: "+JSON.stringify(uploaded.value));
 const publicUrl=uploaded.value?.logoUrl;
 assert.ok(typeof publicUrl==="string"&&publicUrl.startsWith("https://"));
 uploadedPath=decodeURIComponent(new URL(publicUrl).pathname.split("/object/public/tenant-brand-logos/")[1]||"");
 assert.ok(uploadedPath.startsWith(orgId+"/"));
 const change={organizationId:orgId,tagline:"Temporary Phase 5C smoke test",logoUrl:publicUrl,
  primary:"#235ce2",secondary:"#e83d8c",accent:"#14b8a6"};
 const saved=await call("/api/branding-studio",ownerToken,"POST",change);
 assert.equal(saved.status,200,"Owner branding save: "+JSON.stringify(saved.value));
 const checked=await call(theme,ownerToken);
 assert.equal(checked.status,200);
 assert.equal(checked.value?.branding?.tagline,change.tagline);
 assert.equal(checked.value?.branding?.logoUrl,publicUrl);
 assert.equal((await call("/api/branding-studio",outsider,"POST",change)).status,403);
 assert.equal((await call("/api/branding-studio",ownerToken,"POST",{...change,primary:"bad"})).status,400);
 assert.equal((await call(theme,ownerToken)).value?.branding?.tagline,change.tagline);
 const restored=await call("/api/branding-studio",ownerToken,"POST",original);
 assert.equal(restored.status,200,"Restore original brand");
 assert.equal((await call(theme,ownerToken)).value?.branding?.tagline,original.tagline);
 console.log("PASS real DEV HTTP, Owner auth, upload, save, rejection, reload and restore");
}finally{
 if(orgId&&published&&ownerToken){
  try{const state=await call("/api/branding-studio",ownerToken,"POST",brandBody(published));
   if(state.status!==200)throw Error("Restore rejected");
  }catch(error){console.error("CRITICAL: DEV branding restore failed",orgId,error);process.exitCode=1;}
 }
 if(uploadedPath){
  const {error}=await admin.storage.from("tenant-brand-logos").remove([uploadedPath]);
  if(error){console.error("DEV logo cleanup failed",error.message);process.exitCode=1;}
 }
 for(const userId of users){
  const {error}=await admin.auth.admin.deleteUser(userId);
  if(error)console.warn("DEV test actor deletion requires review",userId,error.message);
 }
 if(orgId)console.log("Disposable DEV organization requires safe database cleanup:",orgId);
}
