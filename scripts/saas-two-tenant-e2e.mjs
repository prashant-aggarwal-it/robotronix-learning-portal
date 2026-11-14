// Real authenticated HTTP + Supabase integration test. Creates and cleans DEV-only synthetic accounts.
// Absolutely never run on PROD. No passwords or service credentials are logged or persisted.
import {createClient} from "@supabase/supabase-js";
import {randomBytes} from "node:crypto";
import {spawn} from "node:child_process";

const EXPECTED_REF="uzzuquxeeqonxeqcuohh";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!anon||!service)throw new Error("DEV QA Supabase configuration unavailable");
const hostname=new URL(url).hostname;
if(hostname!==EXPECTED_REF+".supabase.co")throw new Error("Refusing to run outside authorized DEV Supabase "+EXPECTED_REF);
const base="http://127.0.0.1:3457";
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[];
let schools=null,links=null,server=null;
let passed=0;
const assert=(condition,label)=>{if(!condition)throw new Error("FAILED: "+label);passed++;console.log("PASS: "+label)};
const name="saas-e2e-"+randomBytes(5).toString("hex");
async function account(suffix){
 const email=name+"-"+suffix+"@example.invalid";
 const password=randomBytes(32).toString("base64url")+"A1!";
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,
  user_metadata:{qa_user:true,qa_suite:"saas_academy_isolation"}});
 if(error||!data?.user)throw new Error("Unable to create synthetic Auth account: "+(error?.message||"unknown error"));
 users.push(data.user.id);
 const browser=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await browser.auth.signInWithPassword({email,password});
 if(login.error||!login.data.session)throw new Error("Synthetic user sign-in failed");
 return {id:data.user.id,token:login.data.session.access_token};
}
async function request(actor,method,path,payload,cookie){
 const res=await fetch(base+path,{method,headers:{
  authorization:actor?.token?"Bearer "+actor.token:"",
  ...(payload?{"Content-Type":"application/json"}:{}),
  ...(cookie?{cookie}: {})
 },body:payload?JSON.stringify(payload):undefined,redirect:"manual"});
 return {status:res.status,body:await res.json().catch(()=>null),cookie:res.headers.get("set-cookie")};
}
async function startServer(){
 server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--webpack","--hostname","127.0.0.1","--port","3457"],{
  cwd:process.cwd(),detached:true,stdio:["ignore","pipe","pipe"],env:{
   ...process.env,
   NEXT_PUBLIC_APP_ENV:"live",SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_URL:url,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,
   PRODUCT_MODE:"combined"
  }
 });
 let output="";
 server.stdout.on("data",x=>{output=(output+x.toString()).slice(-3000)});
 server.stderr.on("data",x=>{output=(output+x.toString()).slice(-3000)});
 for(let i=0;i<90;i++){
  if(server.exitCode!==null)throw new Error("Next.js exited unexpectedly: "+output.slice(-1000));
  try{
   const r=await fetch(base+"/login",{signal:AbortSignal.timeout(1000)});
   if(r.status<500)return;
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 throw new Error("Next.js development server did not become ready: "+output.slice(-1000));
}
async function run(){
 const a=await account("a"),b=await account("b"),multi=await account("multi");
 const setup=await admin.rpc("saas_qa_fixture_create",{
  p_user_a:a.id,p_user_b:b.id,p_user_multi:multi.id
 });
 if(setup.error||!setup.data?.schoolA||!setup.data?.schoolB)
  throw new Error("DEV QA fixture setup failed: "+(setup.error?.message||"invalid response"));
 schools=setup.data;
 const A=schools.schoolA,B=schools.schoolB;
 const setupLinks=await admin.rpc("saas_qa_phase3a_create",{
  p_school_a:A,p_school_b:B,p_user_a:a.id,p_user_b:b.id,p_user_multi:multi.id
 });
 if(setupLinks.error||!setupLinks.data?.crmA||!setupLinks.data?.tasksB)
  throw new Error("DEV Phase 3A mapping fixtures failed: "+(setupLinks.error?.message||"invalid fixture"));
 links=setupLinks.data;
 await startServer();
 let r=await request(a,"GET","/api/platform/organizations");
 assert(r.status===200&&r.body?.selectedOrganizationId===A,"School A organization discovery");
 r=await request(b,"GET","/api/platform/organizations");
 assert(r.status===200&&r.body?.selectedOrganizationId===B,"School B organization discovery");
 r=await request(multi,"GET","/api/platform/organizations");
 assert(r.status===200&&r.body?.requiresSelection===true,"Multiple organization selection required");
 r=await request(a,"POST","/api/platform/organizations",{organizationId:B});
 assert(r.status===403,"Unauthorized organization switch rejected");
 r=await request(multi,"POST","/api/platform/organizations",{organizationId:B});
 assert(r.status===200&&r.body?.selectedOrganizationId===B,"Authorized organization switch");
 const cookie=r.cookie?.split(";")[0];
 r=await request(multi,"GET","/api/platform/organizations",null,cookie);
 assert(r.status===200&&r.body?.selectedOrganizationId===B,"Selected organization persists");
 // Phase 3A: actual CRM and Tasks membership + mapping validation for two schools.
 r=await request(a,"GET","/api/platform/organization-links?organizationId="+A);
 assert(r.status===200&&r.body?.links?.crm?.status==="ready"&&r.body.links.crm.tenantId===links.crmA,
  "School A resolves own CRM workspace");
 assert(r.body?.links?.tasks?.status==="ready"&&r.body.links.tasks.workspaces.some(w=>w.id===links.tasksA),
  "School A resolves own Tasks workspace");
 assert(!r.body.links.tasks.workspaces.some(w=>w.id===links.tasksB),
  "School A never receives School B Tasks workspace");
 r=await request(b,"GET","/api/platform/organization-links?organizationId="+B);
 assert(r.status===200&&r.body?.links?.crm?.tenantId===links.crmB,
  "School B resolves own CRM workspace");
 assert(r.body?.links?.tasks?.workspaces.some(w=>w.id===links.tasksB),
  "School B resolves own Tasks workspace");
 r=await request(multi,"GET","/api/platform/organization-links?organizationId="+A);
 assert(r.status===200&&r.body?.links?.crm?.tenantId===links.crmA&&
  r.body.links.tasks.workspaces.some(w=>w.id===links.tasksA),
  "Multiple-org user resolves mapped School A");
 r=await request(multi,"GET","/api/platform/organization-links?organizationId="+B);
 assert(r.status===200&&r.body?.links?.crm?.tenantId===links.crmB&&
  r.body.links.tasks.workspaces.some(w=>w.id===links.tasksB),
  "Multiple-org user resolves mapped School B");
 r=await request(a,"GET","/api/platform/organization-links?organizationId="+B);
 assert(r.status===403,"Foreign organization linkage discovery rejected");
 r=await request(null,"GET","/api/platform/organization-links?organizationId="+A);
 assert(r.status===401,"Anonymous organization linkage discovery rejected");
 r=await request(a,"GET","/api/platform/organization-links?organizationId=invalid");
 assert(r.status===400,"Invalid organization linkage identifier rejected");
 // Independently authenticate against the actual CRM and Tasks API services.
 for(const [actor,expected,excluded,label] of [
  [a,links.crmA,links.crmB,"School A"],
  [b,links.crmB,links.crmA,"School B"]
 ]){
  r=await request(actor,"GET","/api/connect/workspaces");
  assert(r.status===200&&r.body?.workspaces?.some(w=>w.tenant_id===expected)&&
   !r.body.workspaces.some(w=>w.tenant_id===excluded),label+" CRM module isolation");
 }
 r=await request(multi,"GET","/api/connect/workspaces");
 assert(r.status===200&&r.body?.workspaces?.some(w=>w.tenant_id===links.crmA)&&
  r.body.workspaces.some(w=>w.tenant_id===links.crmB),"Multi-organization CRM memberships");
 for(const [actor,expected,excluded,label] of [
  [a,links.tasksA,links.tasksB,"School A"],
  [b,links.tasksB,links.tasksA,"School B"]
 ]){
  r=await request(actor,"GET","/api/tasks/collaboration?scope=workspaces");
  assert(r.status===200&&r.body?.items?.some(w=>w.id===expected)&&
   !r.body.items.some(w=>w.id===excluded),label+" Tasks module workspace isolation");
 }
 r=await request(multi,"GET","/api/tasks/collaboration?scope=workspaces");
 assert(r.status===200&&r.body?.items?.some(w=>w.id===links.tasksA)&&
  r.body.items.some(w=>w.id===links.tasksB),"Multi-organization Tasks memberships");
 r=await request(a,"GET","/api/tasks/collaboration?scope=members&workspace_id="+links.tasksB);
 assert(r.status===200&&r.body?.items?.length===0,"Foreign Tasks workspace members not exposed");
 r=await request(a,"POST","/api/tasks/collaboration",{
  action:"task_create",workspace_id:links.tasksB,task:{title:"SaaS E2E Unauthorized"}
 });
 assert(r.status===403||r.status===400,"Foreign Tasks workspace creation rejected");
 const create=async(actor,org,kind,data)=>{
  const response=await request(actor,"POST","/api/platform/academy/"+kind,{organizationId:org,...data});
  if(response.status!==201||!response.body?.data?.id)
   throw new Error("Fixture "+kind+" creation failed: "+response.status+" "+JSON.stringify(response.body));
  return response.body.data.id;
 };
 const sa=await create(a,A,"students",{full_name:"SaaS E2E Student A"});
 const sb=await create(b,B,"students",{full_name:"SaaS E2E Student B"});
 const slug=name.replace(/[^a-z0-9-]/g,"");
 const ca=await create(a,A,"courses",{title:"SaaS E2E Course A",slug:slug+"-a",code:slug.toUpperCase()+"A",category:"Robotics",grade_from:1,grade_to:8,total_sessions:8});
 const cb=await create(b,B,"courses",{title:"SaaS E2E Course B",slug:slug+"-b",code:slug.toUpperCase()+"B",category:"Robotics",grade_from:1,grade_to:8,total_sessions:8});
 const ta=await create(a,A,"trainers",{full_name:"SaaS E2E Trainer A"});
 const tb=await create(b,B,"trainers",{full_name:"SaaS E2E Trainer B"});
 const ea=await create(a,A,"enrollments",{student_id:sa,course_id:ca,trainer_id:ta});
 assert(Boolean(ea&&tb),"Authorized enrollment created");
 r=await request(a,"GET","/api/platform/academy/students?organizationId="+A);
 assert(r.status===200&&r.body?.data?.length===1&&r.body.data[0].id===sa,"School A lists only its students");
 r=await request(b,"GET","/api/platform/academy/students?organizationId="+B);
 assert(r.status===200&&r.body?.data?.length===1&&r.body.data[0].id===sb,"School B lists only its students");
 r=await request(a,"GET","/api/platform/academy/students/"+sb+"?organizationId="+A);
 assert(r.status===403,"Cross-tenant student GET denied");
 r=await request(a,"PATCH","/api/platform/academy/courses/"+cb,{organizationId:A,title:"Unsafe"});
 assert(r.status===403,"Cross-tenant course PATCH denied");
 r=await request(a,"POST","/api/platform/academy/enrollments",{organizationId:A,student_id:sa,course_id:cb,trainer_id:ta});
 assert(r.status===403,"Mixed-tenant enrollment denied");
 r=await request(a,"GET","/api/platform/academy/students?organizationId="+B);
 assert(r.status===403,"Foreign organization list denied");
 r=await request(null,"GET","/api/platform/academy/students?organizationId="+A);
 assert(r.status===401,"Anonymous Academy access denied");
 r=await request(a,"GET","/api/platform/academy/enrollments?organizationId="+A);
 assert(r.status===200&&r.body?.data?.length===1&&r.body.data[0].id===ea,"Authorized enrollment listing");
 r=await request(a,"GET","/api/platform/academy/courses?organizationId="+A);
 assert(r.status===200&&r.body?.data?.length===1&&r.body.data[0].id===ca,"Organization-scoped course listing");
 const ui=await fetch(base+"/saas/academy");
 assert(ui.status===200,"Academy workspace page serves successfully");
 console.log("Verified "+passed+" authenticated HTTP assertions against DEV");
}
let failure;
try{await run()}catch(error){failure=error;console.error(error instanceof Error?error.message:String(error))}
finally{
 if(server){
  // Terminate the isolated Next.js process group, not only the npm wrapper.
  // The previous runner could hang indefinitely because orphaned Next.js workers
  // kept inherited stdout/stderr handles open after all assertions and cleanup passed.
  try{process.kill(-server.pid,"SIGTERM")}catch{try{server.kill("SIGTERM")}catch{}}
  await new Promise(resolve=>{
   if(server.exitCode!==null){resolve();return}
   const limit=setTimeout(()=>{try{process.kill(-server.pid,"SIGKILL")}catch{}resolve()},5000);
   server.once("close",()=>{clearTimeout(limit);resolve()});
  });
  server.stdout?.destroy();server.stderr?.destroy();
 }
 if(schools&&links){
  const {error}=await admin.rpc("saas_qa_phase3a_cleanup",{p_school_a:schools.schoolA,p_school_b:schools.schoolB});
  if(error){console.error("Phase 3A fixture cleanup failed: "+error.message);failure??=error}
 }
 if(schools){
  const {error}=await admin.rpc("saas_qa_fixture_cleanup",{p_school_a:schools.schoolA,p_school_b:schools.schoolB});
  if(error){console.error("Fixture cleanup failed: "+error.message);failure??=error}
 }
 for(const id of users.reverse()){
  const {error}=await admin.auth.admin.deleteUser(id);
  if(error){console.error("Synthetic Auth cleanup failed for one fixture");failure??=error}
 }
}
if(failure)process.exitCode=1;
