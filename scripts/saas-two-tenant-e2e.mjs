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
const adoptedCourseIds=[];
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
 return {id:data.user.id,token:login.data.session.access_token,session:login.data.session};
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
 const templateRows=await admin.from("courses").select("id").eq("code","RTX-PYTHON").limit(1);
 if(templateRows.error||!templateRows.data?.[0]?.id)throw new Error("Shared Academy template catalog unavailable");
 const adopted=await admin.rpc("saas_academy_clone_course_template",{
  p_actor_id:a.id,p_organization_id:A,p_template_id:templateRows.data[0].id,
  p_slug:name+"-adopted",p_code:("SAAS-E2E-ADOPTED-"+name.slice(-10)).toUpperCase()
 });
 if(adopted.error||!adopted.data)throw new Error("Tenant-owned course adoption failed: "+(adopted.error?.message||"no course id"));
 adoptedCourseIds.push(adopted.data);
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
 const {data:ownTemplateCourse,error:ownerError}=await admin.rpc("saas_academy_resource_owned",{
  p_actor_id:a.id,p_organization_id:A,p_kind:"courses",p_resource_id:adoptedCourseIds[0]
 });
 assert(!ownerError&&ownTemplateCourse===true,"School A owns adopted template course");
 const {data:foreignTemplateCourse,error:foreignError}=await admin.rpc("saas_academy_resource_owned",{
  p_actor_id:b.id,p_organization_id:B,p_kind:"courses",p_resource_id:adoptedCourseIds[0]
 });
 assert(!foreignError&&foreignTemplateCourse===false,"School B cannot access School A adopted course");
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
 // Personal tasks remain private even when the owner belongs to multiple schools.
 r=await request(a,"POST","/api/tasks",{title:"SaaS E2E Private Task A"});
 assert(r.status===201&&Boolean(r.body?.item?.id),"Create private task for School A user");
 const privateTaskId=r.body.item.id;
 r=await request(a,"GET","/api/tasks?limit=100");
 assert(r.status===200&&r.body?.items?.some(t=>t.id===privateTaskId),
  "Owner sees personal task");
 r=await request(b,"GET","/api/tasks?limit=100");
 assert(r.status===200&&!r.body?.items?.some(t=>t.id===privateTaskId),
  "Other school member cannot see personal task");
 r=await request(multi,"GET","/api/tasks?limit=100");
 assert(r.status===200&&!r.body?.items?.some(t=>t.id===privateTaskId),
  "Multi-organization member cannot see another user's personal task");
 // Real browser organization-switching verification using the synthetic user's
 // authenticated Supabase session. Never log access or refresh credentials.
 {
  const {chromium}=await import("@playwright/test");
  const browser=await chromium.launch({headless:true});
  try{
   const context=await browser.newContext({viewport:{width:1280,height:850}});
   await context.addInitScript(({key,session})=>{
    window.localStorage.setItem(key,JSON.stringify(session));
   },{key:"sb-"+EXPECTED_REF+"-auth-token",session:multi.session});
   const page=await context.newPage();
   await page.goto(base+"/suite",{waitUntil:"domcontentloaded"});
   const picker=page.getByRole("combobox",{name:"Active organization"});
   await picker.waitFor({timeout:25000});
   for(const [org,crm,workspace,label] of [
    [A,links.crmA,links.tasksA,"School A"],
    [B,links.crmB,links.tasksB,"School B"]
   ]){
    await picker.selectOption(org);
    await page.waitForFunction(expected=>document.body.innerText.includes("Active organization: "+expected),
     "Synthetic "+label,{timeout:25000});
    const crmLink=page.locator('a[href*="suiteTenant="]').first();
    await crmLink.waitFor({timeout:25000});
    assert((await crmLink.getAttribute("href"))?.includes(crm),
     label+" browser CRM navigation has correct organization link");
    const taskLink=page.locator('a[href*="suiteWorkspace="]').first();
    await taskLink.waitFor({timeout:25000});
    assert((await taskLink.getAttribute("href"))?.includes(workspace),
     label+" browser Tasks navigation has correct organization link");
   }
   await page.setViewportSize({width:390,height:844});
   assert(await page.getByRole("combobox",{name:"Active organization"}).isVisible(),
    "Mobile organization switcher remains keyboard-accessible and visible");
   await context.close();
  }finally{await browser.close();}
 }
 const create=async(actor,org,kind,data)=>{
  const response=await request(actor,"POST","/api/platform/academy/"+kind,{organizationId:org,...data});
  if(response.status!==201||!response.body?.data?.id)
   throw new Error("Fixture "+kind+" creation failed: "+response.status+" "+JSON.stringify(response.body));
  return response.body.data.id;
 };
 const sa=await create(a,A,"students",{full_name:"SaaS E2E Student A"});
 const sb=await create(b,B,"students",{full_name:"SaaS E2E Student B"});
 const directRead=async(actor,selectedOrg,studentId)=>{
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},
   global:{headers:{authorization:"Bearer "+actor.token,...(selectedOrg?{"x-organization-id":selectedOrg}:{})}}});
  const {data,error}=await client.from("students").select("id").eq("id",studentId);
  if(error)throw new Error("DEV direct RLS read failed: "+error.message);
  return data??[];
 };
 assert((await directRead(a,A,sa)).length===1,
  "Existing Supabase REST student read permits own selected organization");
 assert((await directRead(a,B,sb)).length===0,
  "Forged foreign organization header cannot read School B student");
 assert((await directRead(a,null,sa)).length===0,
  "SaaS member without organization selection cannot read student records");
 assert((await directRead(multi,A,sa)).length===1,
  "Multi-organization member can read explicitly selected School A student");
 assert((await directRead(multi,A,sb)).length===0,
  "Multi-organization member cannot read School B records while selecting School A");
 assert((await directRead(multi,B,sb)).length===1,
  "Multi-organization member can switch REST tenant selection to School B");
 const changeSyntheticRole=async(role)=>{
  const {error}=await admin.rpc("saas_qa_set_synthetic_role",{
   p_actor_id:multi.id,p_organization_id:A,p_role:role
  });
  if(error)throw new Error("Synthetic role switch failed: "+error.message);
 };
 await changeSyntheticRole("member");
 try{
  assert((await directRead(multi,A,sa)).length===0,
   "Ordinary organization member cannot read all school student records");
  assert((await directRead(multi,B,sb)).length===1,
   "Role downgrade in School A does not revoke authorized admin access in School B");
 }finally{await changeSyntheticRole("admin")}
 const directA=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{authorization:"Bearer "+a.token,"x-organization-id":A}}});
 const {data:directCreated,error:directCreateError}=await directA.from("students")
  .insert({full_name:"SaaS E2E Direct Student A",grade:"5",school:"Synthetic School A"}).select("id").single();
 assert(!directCreateError&&Boolean(directCreated?.id),"Legacy browser insert creates organization-owned student atomically"+(directCreateError?" ("+directCreateError.code+")":""));
 if(directCreated?.id){
  const {data:linked,error:linkError}=await admin.rpc("saas_academy_resource_owned",{
   p_actor_id:a.id,p_organization_id:A,p_kind:"students",p_resource_id:directCreated.id
  });
  assert(!linkError&&linked===true,"Direct student insert automatically creates School A ownership link");
  assert((await directRead(b,B,directCreated.id)).length===0,
   "Directly created student cannot leak to School B");
 }
 const ownership=async(actor,org,kind,id)=>{
  const {data,error}=await admin.rpc("saas_academy_resource_owned",{
   p_actor_id:actor.id,p_organization_id:org,p_kind:kind,p_resource_id:id
  });
  if(error)throw new Error("DEV ownership guard failed: "+error.message);
  return data;
 };
 assert(await ownership(a,A,"students",sa)===true,
  "Phase 3B owner can resolve own student resource");
 assert(await ownership(b,B,"students",sa)===false,
  "Phase 3B denies cross-school student ownership");
 assert(await ownership(a,A,"student_invoices",sa)===false,
  "Phase 3B denies unmapped invoice resource");
 assert(await ownership(a,A,"zoom_recordings",sa)===false,
  "Phase 3B denies unmapped Zoom recording resource");

 const slug=name.replace(/[^a-z0-9-]/g,"");
 const ca=await create(a,A,"courses",{title:"SaaS E2E Course A",slug:slug+"-a",code:slug.toUpperCase()+"A",category:"Robotics",grade_from:1,grade_to:8,total_sessions:8});
 const cb=await create(b,B,"courses",{title:"SaaS E2E Course B",slug:slug+"-b",code:slug.toUpperCase()+"B",category:"Robotics",grade_from:1,grade_to:8,total_sessions:8});
 const ta=await create(a,A,"trainers",{full_name:"SaaS E2E Trainer A"});
 const tb=await create(b,B,"trainers",{full_name:"SaaS E2E Trainer B"});
 const {error:foreignInsert}=await directA.from("enrollments").insert({
  student_id:sa,course_id:cb,trainer_id:ta,enrollment_type:"one_to_one",
  started_at:new Date().toISOString().slice(0,10)
 });
 assert(Boolean(foreignInsert)&&foreignInsert.code==="42501",
  "Legacy direct enrollment insert rejects cross-school course relationships");
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
 assert(r.status===200&&r.body?.data?.length===2&&r.body.data.some(x=>x.id===ca)&&r.body.data.some(x=>x.id===adoptedCourseIds[0])&&!r.body.data.some(x=>x.id===cb),"Organization-scoped course listing includes owned adopted course but excludes foreign courses");
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
 if(adoptedCourseIds.length){
  const {error}=await admin.from("courses").delete().in("id",adoptedCourseIds);
  if(error){console.error("Synthetic course cleanup failed: "+error.message);failure??=error}
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
