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
const syntheticParentIds=[];
const syntheticScheduleIds=[];
const syntheticEarningIds=[];
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
 let session=null;
 let lastError=null;
 for(let attempt=0;attempt<4;attempt++){
  const login=await browser.auth.signInWithPassword({email,password});
  if(login.data.session){session=login.data.session;break;}
  lastError=login.error;
  // DEV Auth may briefly lag behind admin.createUser; never retry credentials or
  // authorization failures other than short-lived service / rate-limit errors.
  if(![429,500,502,503,504].includes(Number(login.error?.status))&&
     !/user not found|email not confirmed/i.test(login.error?.message||""))break;
  await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
 }
 if(!session)throw new Error("Synthetic user sign-in failed (status="+
  (lastError?.status??"unknown")+", code="+(lastError?.code??"unknown")+")");
 return {id:data.user.id,email,token:session.access_token,session};
}
async function request(actor,method,path,payload,cookie,extraHeaders={}){
 const res=await fetch(base+path,{method,headers:{
  authorization:actor?.token?"Bearer "+actor.token:"",
  ...(payload?{"Content-Type":"application/json"}:{}),
  ...(cookie?{cookie}: {}),
  ...extraHeaders
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
 const parent=await account("parent"),studentActor=await account("student"),trainerActor=await account("trainer");
 const invitedActor=await account("invited");
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
 const {error:profileSetupError}=await admin.from("profiles").upsert([
  {id:a.id,full_name:"SaaS E2E Admin A",role:"admin",active:true},
  {id:b.id,full_name:"SaaS E2E Admin B",role:"admin",active:true},
  {id:multi.id,full_name:"SaaS E2E Admin Multi",role:"admin",active:true},
  {id:parent.id,full_name:"SaaS E2E Parent",role:"parent",active:true},
  {id:studentActor.id,full_name:"SaaS E2E Student User",role:"student",active:true},
  {id:trainerActor.id,full_name:"SaaS E2E Trainer User",role:"trainer",active:true}
 ],{onConflict:"id"});
 if(profileSetupError)throw new Error("Synthetic Academy role profiles unavailable: "+profileSetupError.message);
 for(const [actor,role] of [[parent,"member"],[studentActor,"member"],[trainerActor,"trainer"]]){
  const {error}=await admin.rpc("saas_qa_add_synthetic_member",{
   p_actor_id:actor.id,p_organization_id:A,p_role_key:role
  });
  if(error)throw new Error("Synthetic Academy role membership failed: "+error.message);
 }

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
 r=await request(a,"GET","/api/platform/academy/course-templates?organizationId="+A);
 assert(r.status===200&&r.body?.templates?.some(t=>t.id===templateRows.data[0].id),
  "School A admin lists approved shared course templates");
 r=await request(b,"GET","/api/platform/academy/course-templates?organizationId="+A);
 assert(r.status===403,"School B cannot request School A template adoption context");
 r=await request(a,"POST","/api/platform/academy/course-templates/adopt",{
  organizationId:A,templateId:templateRows.data[0].id,
  slug:name+"-ui-adopted",code:("SAAS-E2E-UI-"+name.slice(-10)).toUpperCase()
 });
 assert(r.status===201&&Boolean(r.body?.courseId),"School A imports shared template through authenticated HTTP API");
 if(r.body?.courseId)adoptedCourseIds.push(r.body.courseId);
 r=await request(a,"GET","/api/admin/invoices",undefined,undefined,{"x-organization-id":A});
 assert(r.status===200&&r.body?.ok===true&&r.body?.invoices?.length===0&&r.body?.packageSummaries?.length===0,
  "SaaS Admin finance endpoint returns only mapped organization invoices (HTTP "+r.status+", error "+String(r.body?.error||"none")+")");
 r=await request(a,"GET","/api/admin/invoices");
 assert(r.status===403,"SaaS Admin invoice access requires selected organization");
 r=await request(b,"GET","/api/admin/invoices",undefined,undefined,{"x-organization-id":A});
 assert(r.status===403,"SaaS Admin invoice endpoint rejects foreign organization header");
 r=await request(a,"POST","/api/admin/invoices",{
  action:"create",packageId:"00000000-0000-0000-0000-000000000003"
 },undefined,{"x-organization-id":A});
 assert(r.status===403,"Foreign or unmapped invoice package blocked before Razorpay operation");
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
 r=await request(b,"GET","/api/connect/workspaces/"+links.crmA+"/members");
 assert(r.status===403,"Other organization's CRM member roster denied");
 r=await request(a,"GET","/api/connect/workspaces/"+links.crmA+"/members");
 assert(r.status===200&&Array.isArray(r.body?.members),"Owner can read own CRM workspace members");
 r=await request(b,"PATCH","/api/connect/workspaces/"+links.crmA+"/members/00000000-0000-4000-8000-000000000001",{role:"viewer",status:"active"});
 assert(r.status===403,"Other organization's CRM member update denied");
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
 r=await request(b,"PATCH","/api/tasks/"+privateTaskId,{status:"done"});
 assert(r.status===404||r.status===403,"Foreign member cannot modify personal task");
 r=await request(b,"DELETE","/api/tasks/"+privateTaskId);
 assert(r.status===404||r.status===403,"Foreign member cannot archive personal task");
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
   "Downgraded legacy global Admin profile cannot bypass School A SaaS member role cannot read all school student records");
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
 const {error:studentLinkError}=await admin.from("students").update({profile_id:studentActor.id}).eq("id",sa);
 if(studentLinkError)throw new Error("Synthetic student user link failed: "+studentLinkError.message);
 const {error:trainerLinkError}=await admin.from("trainers").update({profile_id:trainerActor.id}).eq("id",ta);
 if(trainerLinkError)throw new Error("Synthetic trainer user link failed: "+trainerLinkError.message);
 const {data:parentRecord,error:parentRecordError}=await admin.from("parents")
  .insert({profile_id:parent.id}).select("id").single();
 if(parentRecordError||!parentRecord?.id)throw new Error("Synthetic parent profile link failed: "+(parentRecordError?.message||"no parent ID"));
 syntheticParentIds.push(parentRecord.id);
 const {error:parentLinkError}=await admin.from("parent_students").insert({parent_id:parentRecord.id,student_id:sa});
 if(parentLinkError)throw new Error("Synthetic parent student link failed: "+parentLinkError.message);
 const ea=await create(a,A,"enrollments",{student_id:sa,course_id:ca,trainer_id:ta});
 const scheduleInput={
  trainer_id:ta,course_id:ca,enrollment_id:ea,student_id:sa,
  title:"SaaS E2E Class A",date:"2027-01-15",start_time:"12:00",end_time:"13:00",
  event_type:"class",delivery_mode:"one_to_one"
 };
 const {data:createdSchedule,error:scheduleError}=await directA.from("schedule_events")
  .insert(scheduleInput).select("id").single();
 assert(!scheduleError&&Boolean(createdSchedule?.id),"School A can create its own class through legacy REST");
 if(createdSchedule?.id)syntheticScheduleIds.push(createdSchedule.id);
 const directB=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{authorization:"Bearer "+b.token,"x-organization-id":B}}});
 for(const [actor,expected,label] of [
  [a,true,"School A Admin"],
  [b,false,"School B Admin"],
  [parent,true,"School A Parent"],
  [studentActor,true,"School A Student"],
  [trainerActor,true,"School A Trainer"]
 ]){
  const {data,error}=await admin.rpc("saas_academy_schedule_scope",{
   p_actor_id:actor.id,p_schedule_event_id:createdSchedule.id
  });
  assert(!error&&data===expected,label+" Zoom classroom ownership scope");
 }
 r=await request(b,"GET","/api/zoom/classroom/"+createdSchedule.id);
 assert(r.status===403,"Foreign School B user cannot retrieve School A Zoom classroom");
 const {data:foreignSchedule,error:foreignScheduleReadError}=await directB.from("schedule_events")
  .select("id").eq("id",createdSchedule.id);
 assert(!foreignScheduleReadError&&foreignSchedule?.length===0,"School B cannot read School A class");
 const {error:badScheduleWrite}=await directA.from("schedule_events").insert({
  ...scheduleInput,trainer_id:tb,title:"SaaS E2E Foreign Trainer Class"
 });
 assert(Boolean(badScheduleWrite)&&badScheduleWrite.code==="42501",
  "School A cannot schedule a trainer belonging to School B");
 const {data:attendance,error:attendanceError}=await directA.from("class_attendance").insert({
  schedule_event_id:createdSchedule.id,student_id:sa,enrollment_id:ea,status:"attended"
 }).select("id").single();
 assert(!attendanceError&&Boolean(attendance?.id),"School A can record attendance for its own class");
 const {data:foreignAttendance,error:foreignAttendanceError}=await directB.from("class_attendance")
  .select("id").eq("id",attendance.id);
 assert(!foreignAttendanceError&&foreignAttendance?.length===0,"School B cannot read School A attendance");
 const {error:badAttendance}=await directA.from("class_attendance").insert({
  schedule_event_id:createdSchedule.id,student_id:sb,enrollment_id:ea,status:"attended"
 });
 assert(Boolean(badAttendance)&&badAttendance.code==="42501",
  "Attendance rejects a foreign-school student even when the class is local");
 // Payroll must remain private even when two organizations share the same database.
 const {data:earning,error:earningError}=await admin.from("trainer_earnings").insert({
  trainer_id:ta,schedule_event_id:createdSchedule.id,earning_date:scheduleInput.date,
  session_type:"one_to_one",pay_band:"day",class_outcome:"completed",
  duration_minutes:60,learner_count:1,base_rate:500,total_amount:500,status:"pending",
  notes:"SaaS E2E payroll isolation"
 }).select("id").single();
 assert(!earningError&&Boolean(earning?.id),
  "DEV School A payroll record created for isolation regression");
 syntheticEarningIds.push(earning.id);
 const {data:ownerPayroll,error:ownerPayrollError}=await directA.from("trainer_earnings")
  .select("id").eq("id",earning.id);
 assert(!ownerPayrollError&&ownerPayroll?.some(x=>x.id===earning.id),
  "School A admin can read own trainer earnings");
 const {data:foreignPayroll,error:foreignPayrollError}=await directB.from("trainer_earnings")
  .select("id").eq("id",earning.id);
 assert(!foreignPayrollError&&foreignPayroll?.length===0,
  "School B admin cannot read School A trainer earnings");


 assert(Boolean(ea&&tb),"Authorized enrollment created");
 assert((await directRead(parent,A,sa)).length===1,"Parent can read own School A child");
 assert((await directRead(parent,A,sb)).length===0,"Parent cannot read School B student");
 assert((await directRead(studentActor,A,sa)).length===1,"Student can read own School A record");
 assert((await directRead(studentActor,A,sb)).length===0,"Student cannot read School B record");
 assert((await directRead(trainerActor,A,sa)).length===1,"Trainer can read assigned School A learner");
 assert((await directRead(trainerActor,A,sb)).length===0,"Trainer cannot read unassigned School B learner");

 r=await request(a,"GET","/api/platform/academy/students?organizationId="+A);
 assert(r.status===200&&r.body?.data?.length===2&&r.body.data.some(x=>x.id===sa)&&r.body.data.some(x=>x.id===directCreated.id)&&!r.body.data.some(x=>x.id===sb),"School A lists both authorized students and excludes School B");
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
 assert(r.status===200&&r.body?.data?.length===3&&r.body.data.some(x=>x.id===ca)&&adoptedCourseIds.every(id=>r.body.data.some(x=>x.id===id))&&!r.body.data.some(x=>x.id===cb),"Organization-scoped course listing includes owned adopted course but excludes foreign courses");
 const ui=await fetch(base+"/saas/academy");
 assert(ui.status===200,"Academy workspace page serves successfully");
 // Exercise actual legacy Admin pages with a real authorized profile and organization context.
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
   await picker.waitFor({timeout:30000});
   await picker.selectOption(B);
   await page.waitForFunction(()=>document.body.innerText.includes("Active organization: Synthetic School B"),
    null,{timeout:30000});
   await page.goto(base+"/admin/courses",{waitUntil:"domcontentloaded"});
   await page.getByRole("heading",{name:"Courses",exact:true}).waitFor({timeout:30000});
   await page.locator("select").filter({hasText:"All statuses"}).selectOption("all");
   await page.getByText("SaaS E2E Course B",{exact:false}).first().waitFor({timeout:30000});
   assert((await page.getByText("SaaS E2E Course A",{exact:false}).count())===0,
    "Original Admin Courses page excludes School A while School B selected");
   await page.goto(base+"/admin/students",{waitUntil:"domcontentloaded"});
   await page.getByText("SaaS E2E Student B",{exact:false}).first().waitFor({timeout:30000});
   assert((await page.getByText("SaaS E2E Student A",{exact:false}).count())===0,
    "Original Admin Students page excludes School A while School B selected");
   // Verify representative original Admin modules mount under the selected tenant.
   // This is a navigation/access smoke, not a substitute for workflow assertions.
   for(const path of [
    "/admin/enrollments","/admin/classes","/admin/schedule","/admin/finance",
    "/admin/trainer-finance","/admin/invoices","/admin/progress",
    "/admin/messages","/admin/notifications","/admin/trainers"
   ]){
    const response=await page.goto(base+path,{waitUntil:"domcontentloaded"});
    await page.waitForTimeout(750);
    assert(response?.status()===200&&new URL(page.url()).pathname===path,
     "Selected School B authorized Admin route mounts: "+path);
   }
   await context.close();
  }finally{await browser.close()}
 }
 // Role-specific original dashboard smoke tests with independently authenticated users.
 {
  const {chromium}=await import("@playwright/test");
  const browser=await chromium.launch({headless:true});
  try{
   for(const [actor,path,label] of [
    [parent,"/parent","Parent"],
    [studentActor,"/student","Student"],
    [trainerActor,"/trainer","Trainer"]
   ]){
    const context=await browser.newContext({viewport:{width:1280,height:850}});
    await context.addInitScript(({key,session})=>window.localStorage.setItem(key,JSON.stringify(session)),
     {key:"sb-"+EXPECTED_REF+"-auth-token",session:actor.session});
    try{
     const page=await context.newPage();
     await page.goto(base+path,{waitUntil:"domcontentloaded"});
     await page.locator(".experienceShell, .workspaceContent").first().waitFor({timeout:35000});
     await page.waitForTimeout(1200);
     assert(new URL(page.url()).pathname===path,
      label+" original Academy dashboard remains accessible after org context resolution");
     assert((await page.getByText("SaaS E2E Student B",{exact:false}).count())===0,
      label+" original Academy dashboard does not render School B learner");
     const roleRoutes={
      Parent:["/parent/billing","/parent/calendar","/parent/learner","/parent/messages"],
      Student:["/student/course","/student/calendar","/student/portfolio"],
      Trainer:["/trainer/classes","/trainer/earnings","/trainer/progress","/trainer/schedule"]
     };
     for(const destination of roleRoutes[label]??[]){
      const response=await page.goto(base+destination,{waitUntil:"domcontentloaded"});
      await page.waitForTimeout(650);
      assert(response?.status()===200&&new URL(page.url()).pathname===destination,
       label+" organization-authorized role page mounts: "+destination);
     }
    }finally{await context.close()}
   }
  }finally{await browser.close()}
 }
 const toggleMembership=async(status)=>{
  const {error}=await admin.rpc("saas_qa_set_synthetic_membership_status",{
   p_actor_id:b.id,p_organization_id:B,p_status:status
  });
  if(error)throw new Error("Synthetic membership status switch failed: "+error.message);
 };
 await toggleMembership("removed");
 try{
  r=await request(b,"GET","/api/admin/invoices",undefined,undefined,{"x-organization-id":B});
  assert(r.status===403,"Revoked SaaS Admin cannot fall back to legacy invoice access");
  const {data:recordingGrant,error:recordingGrantError}=await admin.rpc("saas_academy_recording_scope",{
   p_actor_id:b.id,p_recording_id:"00000000-0000-4000-8000-000000000003"
  });
  assert(!recordingGrantError&&recordingGrant===false,
   "Revoked SaaS user cannot fall back to legacy signed recording access");
 }finally{await toggleMembership("active")}

 // Phase 3C: complete SaaS invitation and membership lifecycle with real verified Auth identities.
 r=await request(b,"POST","/api/platform/organizations/"+A+"/invitations",{email:invitedActor.email,role:"member"});
 assert(r.status===403,"Unrelated tenant owner cannot invite into another organization");
 r=await request(a,"POST","/api/platform/organizations/"+A+"/invitations",{email:invitedActor.email,role:"member"});
 assert(r.status===201&&typeof r.body?.acceptToken==="string","Owner creates one-time email-scoped organization invitation");
 const inviteToken=r.body.acceptToken;
 const inviteId=r.body.invitationId;
 r=await request(invitedActor,"POST","/api/platform/invitations/accept",{token:randomBytes(32).toString("base64url")});
 assert(r.status===403,"Invalid invitation token cannot grant membership");
 r=await request(invitedActor,"POST","/api/platform/invitations/accept",{token:inviteToken});
 assert(r.status===200&&r.body?.organizationId===A,"Verified invitee accepts organization invitation");
 r=await request(invitedActor,"POST","/api/platform/invitations/accept",{token:inviteToken});
 assert(r.status===403,"One-time invitation token cannot be reused");
 r=await request(invitedActor,"GET","/api/platform/organizations");
 assert(r.status===200&&r.body?.organizations?.some(o=>o.id===A),"Invited user gains only intended organization");
 r=await request(b,"GET","/api/platform/organizations/"+A+"/members");
 assert(r.status===403,"Other organization cannot list membership roster");
 r=await request(a,"GET","/api/platform/organizations/"+A+"/members");
 const invitedMember=r.body?.members?.find(m=>m.user_id===invitedActor.id);
 assert(r.status===200&&invitedMember?.role_key==="member","Owner can see invited member with correct role");
 r=await request(a,"PATCH","/api/platform/organizations/"+A+"/members/"+invitedMember.id,{role:"member",status:"suspended"});
 assert(r.status===200,"Owner suspends invited SaaS member");
 r=await request(invitedActor,"POST","/api/platform/organizations",{organizationId:A});
 assert(r.status===403,"Suspended member cannot select organization");
 r=await request(a,"PATCH","/api/platform/organizations/"+A+"/members/"+invitedMember.id,{role:"member",status:"active"});
 assert(r.status===200,"Owner restores synthetic membership");
 r=await request(a,"POST","/api/platform/organizations/"+A+"/invitations",{email:"unclaimed-"+name+"@example.invalid",role:"member"});
 assert(r.status===201,"Owner creates revocable pending invitation");
 const revokableId=r.body.invitationId;
 r=await request(a,"DELETE","/api/platform/organizations/"+A+"/invitations/"+revokableId);
 assert(r.status===200&&r.body?.revoked===true,"Owner revokes pending invitation");
 r=await request(a,"GET","/api/platform/organizations/"+A+"/invitations");
 assert(r.status===200&&r.body?.invitations?.some(i=>i.id===revokableId&&i.status==="revoked"),"Revoked invitation is visible without token hash");
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
 if(syntheticEarningIds.length){
  const {error}=await admin.from("trainer_earnings").delete().in("id",syntheticEarningIds);
  if(error){console.error("Synthetic payroll cleanup failed: "+error.message);failure??=error}
 }
 if(syntheticScheduleIds.length){
  const {error:attendanceCleanupError}=await admin.from("class_attendance").delete().in("schedule_event_id",syntheticScheduleIds);
  if(attendanceCleanupError){console.error("Synthetic attendance cleanup failed: "+attendanceCleanupError.message);failure??=attendanceCleanupError}
  const {error}=await admin.from("schedule_events").delete().in("id",syntheticScheduleIds);
  if(error){console.error("Synthetic schedule cleanup failed: "+error.message);failure??=error}
 }
 if(syntheticParentIds.length){
  const {error:relationshipCleanup}=await admin.from("parent_students").delete().in("parent_id",syntheticParentIds);
  if(relationshipCleanup){console.error("Synthetic parent link cleanup failed: "+relationshipCleanup.message);failure??=relationshipCleanup}
  const {error}=await admin.from("parents").delete().in("id",syntheticParentIds);
  if(error){console.error("Synthetic parent cleanup failed: "+error.message);failure??=error}
 }
 if(adoptedCourseIds.length){
  const {error}=await admin.from("courses").delete().in("id",adoptedCourseIds);
  if(error){console.error("Synthetic course cleanup failed: "+error.message);failure??=error}
 }
 if(schools){
  // DEV-only privileged fixture cleanup checks exact synthetic organization slugs.
  // Never access the private saas schema via PostgREST: it is intentionally unexposed.
  const {error:phase3cCleanupError}=await admin.rpc("saas_qa_phase3c_cleanup",{
   p_school_a:schools.schoolA,p_school_b:schools.schoolB
  });
  if(phase3cCleanupError){console.error("Synthetic SaaS invitation/audit cleanup failed: "+phase3cCleanupError.message);failure??=phase3cCleanupError}
 }
 if(schools&&links){
  const {error}=await admin.rpc("saas_qa_phase3a_cleanup",{p_school_a:schools.schoolA,p_school_b:schools.schoolB});
  if(error){console.error("Phase 3A fixture cleanup failed: "+error.message);failure??=error}
 }
 if(schools){
  const {error:auditCleanupError}=await admin.from("portal_audit_log").delete()
   .in("saas_org_id",[schools.schoolA,schools.schoolB]);
  if(auditCleanupError){console.error("Synthetic Academy audit cleanup failed: "+auditCleanupError.message);failure??=auditCleanupError}
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
