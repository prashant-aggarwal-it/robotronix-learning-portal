import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {setTimeout as sleep} from "node:timers/promises";
const url=process.env.E2E_SUPABASE_URL||"",anon=process.env.E2E_SUPABASE_ANON_KEY||"",key=process.env.E2E_SUPABASE_SERVICE_ROLE_KEY||"";
assert.equal(url,"https://uzzuquxeeqonxeqcuohh.supabase.co","DEV project guard");
assert.ok(anon&&key,"DEV QA credentials missing");
const root="http://127.0.0.1:3000";
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],orgs=[],uploads=[];
async function actor(label){
 const email="phase6f-"+label+"-"+randomUUID().slice(0,8)+"@example.com",password=randomUUID()+"Aa9!";
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});
 assert.ifError(created.error);const id=created.data.user?.id;assert.ok(id);
 users.push({id,label,email});
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const signed=await client.auth.signInWithPassword({email,password});
 assert.ifError(signed.error);assert.ok(signed.data.session?.access_token);
 return {id,email,token:signed.data.session.access_token};
}
async function call(path,a=null,method="GET",body=null,extra={}){
 const headers={...extra};
 if(a)headers.Authorization="Bearer "+a.token;
 if(body&&!(body instanceof FormData))headers["Content-Type"]="application/json";
 const res=await fetch(root+path,{method,headers,cache:"no-store",
  body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(35000)});
 return {status:res.status,body:await res.json().catch(()=>null)};
}
async function onboard(a,label){
 const slug="phase6f-admin-"+label+"-"+randomUUID().slice(0,8);
 const res=await call("/api/platform/onboard",a,"POST",{name:"Phase6F Admin "+label,slug,kind:"academy",modules:["academy"],requestKey:randomUUID()});
 assert.equal(res.status,200,"onboard "+JSON.stringify(res.body));
 const id=res.body?.organizationId;assert.match(id||"",/^[a-f0-9-]{36}$/i);
 orgs.push({id,slug});return {id,slug};
}
const logo=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xZkAAAAASUVORK5CYII=","base64");
const palette={primary:"#235ce2",secondary:"#e83d8c",accent:"#14b8a6"};
async function tier(admin,org,level){
 const res=await call("/api/platform/branding-entitlements",admin,"POST",{organizationId:org.id,level});
 assert.equal(res.status,200,"authenticated Super Admin update "+level+" "+JSON.stringify(res.body));
 assert.equal(res.body.level,level);
 return res;
}
try{
 const owner=await actor("privileged-owner"),outsider=await actor("privileged-outsider"),platform=await actor("platform-qa");
 const a=await onboard(owner,"a"),b=await onboard(outsider,"b");
 console.log("PHASE6F_ADMIN_SEED_USER_ID="+platform.id);
 console.log("PHASE6F_ADMIN_QA_ORGS="+JSON.stringify(orgs));
 console.log("Waiting for DEV-only external platform admin grant. No credentials printed.");
 let granted=false;
 for(let attempt=0;attempt<75;attempt++){
  const {data,error}=await service.rpc("saas_is_platform_admin_v1",{p_actor_id:platform.id});
  if(error)throw error;
  if(data===true){granted=true;break;}
  await sleep(2000);
 }
 assert.ok(granted,"BLOCKED: No temporary DEV platform admin grant received");
 assert.equal((await call("/api/platform/branding-entitlements?organizationId="+a.id,platform)).status,200);
 assert.equal((await call("/api/platform/branding-entitlements",outsider,"POST",{organizationId:a.id,level:"custom"})).status,403);
 await tier(platform,a,"custom");
 const publicBrand=await call("/api/branding-studio?organizationId="+a.id,owner);
 assert.equal(publicBrand.status,200);assert.equal(publicBrand.body.canEdit,true);
 const form=new FormData();form.append("logo",new Blob([logo],{type:"image/png"}),"qa.png");
 const up=await call("/api/branding-studio/upload",owner,"POST",form,{"x-branding-organization":a.id});
 assert.equal(up.status,200,"entitled Owner logo upload "+JSON.stringify(up.body));
 assert.ok(up.body.logoUrl?.startsWith("https://"));
 const objectKey=decodeURIComponent(new URL(up.body.logoUrl).pathname.split("/object/public/tenant-brand-logos/")[1]||"");
 assert.ok(objectKey.startsWith(a.id+"/"));uploads.push(objectKey);
 const branding={organizationId:a.id,tagline:"Phase 6F real QA",logoUrl:up.body.logoUrl,...palette};
 const saved=await call("/api/branding-studio",owner,"POST",branding);
 assert.equal(saved.status,200,"entitled Owner save "+JSON.stringify(saved.body));
 let theme=await call("/api/tenant-branding?organizationId="+a.id,owner);
 assert.equal(theme.status,200);assert.equal(theme.body.branding.level,"custom");
 assert.equal(theme.body.branding.logoUrl,up.body.logoUrl);assert.equal(theme.body.branding.tagline,branding.tagline);
 assert.equal(theme.body.branding.theme.primary,palette.primary);
 assert.equal((await call("/api/tenant-branding?organizationId="+a.id,outsider)).status,403);
 await tier(platform,a,"white_label");
 theme=await call("/api/tenant-branding?organizationId="+a.id,owner);
 assert.equal(theme.status,200);assert.equal(theme.body.branding.level,"white_label");
 assert.equal(theme.body.branding.logoUrl,up.body.logoUrl);
 await tier(platform,a,"standard");
 theme=await call("/api/tenant-branding?organizationId="+a.id,owner);
 assert.equal(theme.status,200);assert.equal(theme.body.branding.level,"standard");
 assert.equal(theme.body.branding.logoUrl,"");assert.equal(theme.body.branding.tagline,"");
 assert.equal(theme.body.branding.theme.primary,"#6d3cc9");
 const retained=await call("/api/branding-studio?organizationId="+a.id,owner);
 assert.equal(retained.status,200);assert.equal(retained.body.canEdit,false);
 assert.equal(retained.body.branding.logoUrl,up.body.logoUrl);
 assert.equal((await call("/api/branding-studio",owner,"POST",branding)).status,403);
 await tier(platform,a,"custom");
 theme=await call("/api/tenant-branding?organizationId="+a.id,owner);
 assert.equal(theme.status,200);assert.equal(theme.body.branding.logoUrl,up.body.logoUrl);
 assert.equal(theme.body.branding.tagline,branding.tagline);
 console.log("PASS real authenticated DEV Super Admin tier changes, Owner upload/save, white-label, downgrade/restore, isolation.");
}finally{
 console.log("PHASE6F_ADMIN_QA_USERS="+JSON.stringify(users.map(({id,label})=>({id,label}))));
 console.log("PHASE6F_ADMIN_QA_ORGS="+JSON.stringify(orgs));
 console.log("PHASE6F_ADMIN_QA_STORAGE="+JSON.stringify(uploads));
 // These orgs deliberately remain until the scoped, auditable SQL cleanup.
 // Do not attempt to delete the last organization owner while its membership exists.
}
