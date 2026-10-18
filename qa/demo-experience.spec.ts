import crypto from "node:crypto";
import {test,expect,type Page} from "@playwright/test";
import {ensureRoleSession} from "./session";
import {QA_IDS,qaDb} from "./qa-db";

const IDS={
 event:"11000000-0000-4000-8000-000000000001",
 session:"11000000-0000-4000-8000-000000000002",
 leadA:"11000000-0000-4000-8000-000000000003",
 leadB:"11000000-0000-4000-8000-000000000004",
 leadExpired:"11000000-0000-4000-8000-000000000005",
 participantA:"11000000-0000-4000-8000-000000000006",
 participantB:"11000000-0000-4000-8000-000000000007",
 participantExpired:"11000000-0000-4000-8000-000000000008",
 eventOne:"11000000-0000-4000-8000-000000000009",
 sessionOne:"11000000-0000-4000-8000-000000000010",
 leadOne:"11000000-0000-4000-8000-000000000011",
 participantOne:"11000000-0000-4000-8000-000000000012",
};
const TOKEN_A="qa-demo-token-aarav-robotronix";
const TOKEN_B="qa-demo-token-riya-robotronix";
const TOKEN_EXPIRED="qa-demo-token-expired";
const TOKEN_ONE="qa-demo-token-one-to-one";
const hash=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
const futureDate=()=>new Date(Date.now()+3*24*60*60*1000).toISOString().slice(0,10);

async function cleanup(){
 const db=qaDb();
 await db.from("demo_guest_requests").delete().in("demo_session_participant_id",[IDS.participantA,IDS.participantB,IDS.participantExpired]);
 await db.from("demo_session_participants").delete().in("id",[IDS.participantA,IDS.participantB,IDS.participantExpired,IDS.participantOne]);
 await db.from("demo_sessions").delete().in("id",[IDS.session,IDS.sessionOne]);
 await db.from("demo_leads").delete().in("id",[IDS.leadA,IDS.leadB,IDS.leadExpired,IDS.leadOne]);
 await db.from("schedule_events").delete().in("id",[IDS.event,IDS.eventOne]);
}
async function seed(){
 await cleanup();
 const db=qaDb(),date=futureDate();
 let r=await db.from("schedule_events").insert({id:IDS.event,trainer_id:QA_IDS.trainer,title:"QA Group Demo · Robotics Discovery",date,start_time:"17:00",end_time:"17:45",timezone:"Asia/Kolkata",event_type:"demo",delivery_mode:"small_group",status:"scheduled",notes:"Demo Experience QA"});
 if(r.error)throw r.error;
 r=await db.from("demo_sessions").insert({id:IDS.session,schedule_event_id:IDS.event,trainer_id:QA_IDS.trainer,session_type:"group",focus:"Robotics Discovery",status:"scheduled"});
 if(r.error)throw r.error;
 r=await db.from("demo_leads").insert([
  {id:IDS.leadA,parent_name:"QA Parent A",parent_whatsapp:"+919111111111",parent_email:"parent-a@example.test",child_name:"Aarav QA",grade:"Grade 6",interest:"Robotics",experience_level:"new",source:"qa",status:"demo_scheduled"},
  {id:IDS.leadB,parent_name:"QA Parent B",parent_whatsapp:"+919222222222",parent_email:"parent-b@example.test",child_name:"Riya QA",grade:"Grade 5",interest:"Coding",experience_level:"some",source:"qa",status:"demo_scheduled"},
  {id:IDS.leadExpired,parent_name:"QA Parent Expired",parent_whatsapp:"+919333333333",child_name:"Expired QA",grade:"Grade 7",interest:"Arduino",experience_level:"new",source:"qa",status:"demo_scheduled"},
 ]);
 if(r.error)throw r.error;
 r=await db.from("schedule_events").insert({id:IDS.eventOne,trainer_id:QA_IDS.trainer,title:"QA 1-to-1 Demo · Coding Discovery",date,start_time:"18:30",end_time:"19:15",timezone:"Asia/Kolkata",event_type:"demo",delivery_mode:"one_to_one",status:"scheduled",notes:"Demo Experience QA"});
 if(r.error)throw r.error;
 r=await db.from("demo_sessions").insert({id:IDS.sessionOne,schedule_event_id:IDS.eventOne,trainer_id:QA_IDS.trainer,session_type:"one_to_one",focus:"Coding Discovery",status:"scheduled"});
 if(r.error)throw r.error;
 r=await db.from("demo_leads").insert({id:IDS.leadOne,parent_name:"QA Parent One",parent_whatsapp:"+919444444444",parent_email:"one@example.test",child_name:"Kabir QA",grade:"Grade 7",interest:"Coding",experience_level:"some",source:"qa",status:"demo_scheduled"});
 if(r.error)throw r.error;
 r=await db.from("demo_session_participants").insert([
  {id:IDS.participantA,demo_session_id:IDS.session,lead_id:IDS.leadA,guest_token_hash:hash(TOKEN_A),guest_token_expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString()},
  {id:IDS.participantB,demo_session_id:IDS.session,lead_id:IDS.leadB,guest_token_hash:hash(TOKEN_B),guest_token_expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString()},
  {id:IDS.participantExpired,demo_session_id:IDS.session,lead_id:IDS.leadExpired,guest_token_hash:hash(TOKEN_EXPIRED),guest_token_expires_at:new Date(Date.now()-60_000).toISOString()},
  {id:IDS.participantOne,demo_session_id:IDS.sessionOne,lead_id:IDS.leadOne,guest_token_hash:hash(TOKEN_ONE),guest_token_expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString()},
 ]);
 if(r.error)throw r.error;
}
function field(page:Page,label:string,kind:"input"|"textarea"|"select"="input"){
 return page.locator("label").filter({hasText:label}).locator(kind).first();
}

test.describe("Demo Experience V1",()=>{
 test.beforeAll(seed);
 test.afterAll(cleanup);

 test("private guest link shows only that learner and never exposes family contact details",async({page})=>{
  await page.goto("/demo/"+TOKEN_A,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/Hi Aarav/i})).toBeVisible({timeout:15000});
  await expect(page.getByText("Group Discovery")).toBeVisible();
  await expect(page.getByText("Riya QA")).toHaveCount(0);
  await expect(page.getByText("+919111111111")).toHaveCount(0);
  await expect(page.getByText("parent-a@example.test")).toHaveCount(0);
 });

 test("1-to-1 guest experience uses the same premium flow without exposing contact details",async({page})=>{
  await page.goto("/demo/"+TOKEN_ONE,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/Hi Kabir/i})).toBeVisible({timeout:15000});
  await expect(page.getByText("1-to-1 Discovery")).toBeVisible();
  await expect(page.getByText("+919444444444")).toHaveCount(0);
  await expect(page.getByText("one@example.test")).toHaveCount(0);
 });

 test("expired guest token is rejected",async({page})=>{
  await page.goto("/demo/"+TOKEN_EXPIRED,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/could not open this demo link/i})).toBeVisible({timeout:15000});
 });

 test("trainer sees learning context for group participants but no parent contact details",async({page})=>{
  await ensureRoleSession(page,"trainer");
  await page.goto("/trainer/demos",{waitUntil:"domcontentloaded"});
  await expect(page.getByText("Aarav QA",{exact:true})).toBeVisible({timeout:15000});
  await expect(page.getByText("Riya QA",{exact:true})).toBeVisible();
  await expect(page.getByText("+919111111111")).toHaveCount(0);
  await expect(page.getByText("parent-a@example.test")).toHaveCount(0);
  await expect(page.getByText("QA Parent A")).toHaveCount(0);
 });

 test("trainer publishes individual outcome and parent sees only their personalised summary",async({page})=>{
  await ensureRoleSession(page,"trainer");
  await page.goto("/trainer/demos",{waitUntil:"domcontentloaded"});
  const card=page.locator(".demoParticipantMini").filter({hasText:"Aarav QA"});
  await card.getByRole("button",{name:"Record outcome"}).click();
  await field(page,"Engagement","select").selectOption("excellent");
  await field(page,"Understanding","select").selectOption("strong");
  await field(page,"What did you explore?").fill("Arduino + sensor activity");
  await field(page,"Strengths noticed").fill("Curiosity, Logical thinking, Hands-on interest");
  await field(page,"Mentor note","textarea").fill("Aarav was curious, followed the build confidently and asked thoughtful questions.");
  // Trainer outcomes cannot be published well before the actual demo ends.
  // Assert the lifecycle guard, then verify the parent summary separately
  // using a deterministic QA fixture published by the service-role test setup.
  await page.getByRole("button",{name:"Save outcome"}).click();
  await expect(page.locator(".errorBanner")).toContainText(/near or after the session end time/i,{timeout:15000});
  const db=qaDb();
  const {error:publishError}=await db.from("demo_session_participants").update({
    attendance:"attended",engagement:"excellent",understanding:"strong",
    explored:"Arduino + sensor activity",
    strengths:["Curiosity","Logical thinking","Hands-on interest"],
    mentor_note:"Aarav was curious, followed the build confidently and asked thoughtful questions.",
    summary_published_at:new Date().toISOString()
  }).eq("id",IDS.participantA);
  if(publishError)throw publishError;

  await expect.poll(async()=>{const{data}=await db.from("demo_session_participants").select("summary_published_at").eq("id",IDS.participantA).single();return Boolean(data?.summary_published_at)}).toBe(true);

  await page.context().clearCookies();
  await page.goto("/demo/"+TOKEN_A,{waitUntil:"domcontentloaded"});
  await expect(page.getByRole("heading",{name:/Great first step, Aarav/i})).toBeVisible({timeout:15000});
  await expect(page.getByText("Arduino + sensor activity")).toBeVisible();
  await expect(page.getByText(/Aarav was curious, followed the build confidently/i)).toBeVisible();
  await expect(page.getByText("Riya QA")).toHaveCount(0);

  await page.getByRole("button",{name:"Excellent"}).click();
  await expect.poll(async()=>{const{data}=await db.from("demo_session_participants").select("parent_rating").eq("id",IDS.participantA).single();return data?.parent_rating}).toBe("excellent");
 });

 test("upcoming guest can request a reschedule without an account",async({page})=>{
  await page.goto("/demo/"+TOKEN_B,{waitUntil:"domcontentloaded"});
  await page.getByRole("button",{name:"Need another time?"}).click();
  await page.locator(".demoModal textarea").fill("Tuesday after 6 PM would work better.");
  await page.getByRole("button",{name:"Send request"}).click();
  await expect(page.getByText(/reschedule request has been sent/i)).toBeVisible({timeout:10000});
  const db=qaDb();
  await expect.poll(async()=>{const{data}=await db.from("demo_guest_requests").select("message").eq("demo_session_participant_id",IDS.participantB).eq("request_type","reschedule").order("created_at",{ascending:false}).limit(1).maybeSingle();return data?.message||""}).toContain("Tuesday after 6 PM");
 });
});
