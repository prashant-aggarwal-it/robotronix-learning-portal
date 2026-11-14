// Real Auth E2E, dedicated to Phase 3C; DEV-only, no production credentials.
import {createClient} from "@supabase/supabase-js";
import {randomBytes} from "node:crypto";
import {spawn} from "node:child_process";
const DEV="uzzuquxeeqonxeqcuohh";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!secret||new URL(url).hostname!==DEV+".supabase.co")throw new Error("DEV-only test protection");
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
let orgs=null,server=null,failed=null,passed=0;
const base="http://127.0.0.1:3458",tag="saas-e2e-"+randomBytes(5).toString("hex");
function check(ok,label){if(!ok)throw new Error("FAILED: "+label);passed++;console.log("PASS: "+label)}
async function account(role){
 const email=tag+"-"+role+"@example.invalid",password=randomBytes(32).toString("base64url")+"A1!";
 const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{qa_user:true,qa_suite:"saas_academy_isolation"}});
 if(error||!data?.user)throw new Error("Temporary Auth user creation unavailable");
 users.push(data.user.id);
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 let session=null;
 for(let i=0;i<4;i++){
  const result=await client.auth.signInWithPassword({email,password});
  if(result.data.session){session=result.data.session;break}
  if(![429,500,502,503,504].includes(Number(result.error?.status)))break;
  await new Promise(resolve=>setTimeout(resolve,500*(i+1)));
 }
 if(!session)throw new Error("Temporary account sign-in unavailable");
 return {id:data.user.id,email,token:session.access_token};
}
async function api(user,method,path,payload){
 const response=await fetch(base+path,{method,headers:{Authorization:"Bearer "+user.token,...(payload?{"Content-Type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined});
 return {status:response.status,body:await response.json().catch(()=>null)};
}
async function serve(){
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--webpack","--hostname","127.0.0.1","--port","3458"],{
  cwd:process.cwd(),detached:true,stdio:["ignore","pipe","pipe"],
  env:{...process.env,PRODUCT_MODE:"combined",NEXT_PUBLIC_APP_ENV:"live",SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_URL:url,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:secret}
 });
 let output="";
 server.stdout.on("data",b=>{output=(output+b.toString()).slice(-1000)});
 server.stderr.on("data",b=>{output=(output+b.toString()).slice(-1000)});
 for(let i=0;i<75;i++){
  if(server.exitCode!==null)throw new Error("Next development server exited: "+output);
  try{let r=await fetch(base+"/login",{signal:AbortSignal.timeout(1000)});if(r.status<500)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error("Next.js development server unavailable");
}
async function run(){
 const a=await account("a"),b=await account("b"),multi=await account("multi"),invitee=await account("invited");
 const setup=await db.rpc("saas_qa_fixture_create",{p_user_a:a.id,p_user_b:b.id,p_user_multi:multi.id});
 if(setup.error||!setup.data?.schoolA||!setup.data?.schoolB)throw new Error("DEV organization fixture unavailable");
 orgs=setup.data;
 const A=orgs.schoolA;
 await serve();
 let r=await api(b,"GET","/api/platform/organizations/"+A+"/members");
 check(r.status===403,"Foreign organization members denied HTTP "+r.status);
 r=await api(a,"GET","/api/platform/organizations/"+A+"/members");
 check(r.status===200&&Array.isArray(r.body?.members),"Authorized roster read HTTP "+r.status);
 r=await api(b,"POST","/api/platform/organizations/"+A+"/invitations",{email:invitee.email,role:"member"});
 check(r.status===403,"Foreign invitation creation denied HTTP "+r.status);
 r=await api(multi,"POST","/api/platform/organizations/"+A+"/invitations",{email:invitee.email,role:"owner"});
 check(r.status===403,"Organization admin cannot elevate to owner");
 r=await api(a,"POST","/api/platform/organizations/"+A+"/invitations",{email:invitee.email,role:"member"});
 check(r.status===201&&typeof r.body?.acceptToken==="string","Member invitation created HTTP "+r.status);
 const token=r.body.acceptToken;
 r=await api(b,"POST","/api/platform/invitations/accept",{token});
 check(r.status===403,"Wrong verified email denied");
 r=await api(invitee,"POST","/api/platform/invitations/accept",{token:randomBytes(32).toString("base64url")});
 check(r.status===403,"Unknown token denied");
 r=await api(invitee,"POST","/api/platform/invitations/accept",{token});
 check(r.status===200&&r.body?.organizationId===A,"Verified email accepts invitation HTTP "+r.status);
 r=await api(invitee,"POST","/api/platform/invitations/accept",{token});
 check(r.status===403,"One-time token replay denied");
 r=await api(invitee,"GET","/api/platform/organizations");
 check(r.status===200&&r.body?.organizations?.some(o=>o.id===A),"New member can discover authorized organization");
 r=await api(a,"GET","/api/platform/organizations/"+A+"/members");
 const member=r.body?.members?.find(m=>m.user_id===invitee.id);
 check(r.status===200&&member?.role_key==="member","Member appears with assigned limited role");
 r=await api(a,"PATCH","/api/platform/organizations/"+A+"/members/"+member.id,{role:"member",status:"suspended"});
 check(r.status===200,"Organization admin suspends member");
 r=await api(invitee,"POST","/api/platform/organizations",{organizationId:A});
 check(r.status===403,"Suspended member cannot access organization");
 r=await api(a,"PATCH","/api/platform/organizations/"+A+"/members/"+member.id,{role:"member",status:"active"});
 check(r.status===200,"Organization admin restores membership");
 r=await api(a,"POST","/api/platform/organizations/"+A+"/invitations",{email:"unclaimed-"+tag+"@example.invalid",role:"member"});
 check(r.status===201&&Boolean(r.body?.invitationId),"Pending invitation created");
 const pending=r.body.invitationId;
 r=await api(a,"DELETE","/api/platform/organizations/"+A+"/invitations/"+pending);
 check(r.status===200&&r.body?.revoked===true,"Pending invitation revoked");
 r=await api(a,"GET","/api/platform/organizations/"+A+"/invitations");
 check(r.status===200&&r.body?.invitations?.some(i=>i.id===pending&&i.status==="revoked"),"Revocation listed without token disclosure");
 console.log("Verified "+passed+" authenticated Phase 3C assertions against DEV");
}
try{await run()}catch(e){failed=e;console.error(e instanceof Error?e.message:String(e))}
finally{
 if(server){
  try{process.kill(-server.pid,"SIGTERM")}catch{try{server.kill("SIGTERM")}catch{}}
  await new Promise(resolve=>{
   if(server.exitCode!==null){resolve();return}
   const limit=setTimeout(()=>{try{process.kill(-server.pid,"SIGKILL")}catch{}resolve()},5000);
   server.once("close",()=>{clearTimeout(limit);resolve()});
  });
  server.stdout?.destroy();server.stderr?.destroy();
 }
 if(orgs){
  const args={p_school_a:orgs.schoolA,p_school_b:orgs.schoolB};
  const a=await db.rpc("saas_qa_phase3c_cleanup",args);
  if(a.error){console.error("Invitation fixture cleanup failed: "+a.error.message);failed??=a.error}
  const b=await db.rpc("saas_qa_fixture_cleanup",args);
  if(b.error){console.error("Organization fixture cleanup failed: "+b.error.message);failed??=b.error}
 }
 for(const id of users.reverse()){
  const {error}=await db.auth.admin.deleteUser(id);
  if(error){console.error("Synthetic Auth cleanup failed");failed??=error}
 }
}
if(failed)process.exitCode=1;
