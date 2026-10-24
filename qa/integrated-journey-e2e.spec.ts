import {test,expect} from "@playwright/test";
import {ensureRoleSession,newRoleContext} from "./session";
import {QA_IDS,qaDb} from "./qa-db";
import {authConfig} from "./env";
import {assertHealthyScreen} from "./helpers";

/**
 * REAL authenticated E2E coverage over seeded SANITY-AUTO records.
 * This suite is read-only. It doesn't create or delete learners or meetings.
 * Requires QA credentials for four roles and an isolated QA/test project.
 * Zoom's actual provider API and database-migration installation are tested separately.
 */
test.describe("Integrated learner journey and cross-role access",()=>{
 test.setTimeout(100_000);

 test("admin student → enrollment → filtered course history → class detail",async({page})=>{
  await ensureRoleSession(page,"admin");
  const db=qaDb();
  const {data:enrollment,error}=await db.from("enrollments")
    .select("id,student_id,course_id").eq("id",QA_IDS.enrollment).single();
  if(error)throw error;
  expect(enrollment?.student_id).toBe(QA_IDS.student);

  await page.goto(`/admin/students/${QA_IDS.student}`,{waitUntil:"domcontentloaded"});
  await assertHealthyScreen(page,`/admin/students/${QA_IDS.student}`);
  const nextSteps=page.getByRole("region",{name:"Learner next steps"});
  await expect(nextSteps).toBeVisible();
  await nextSteps.getByRole("link",{name:/Open enrollment/i}).click();

  await expect(page).toHaveURL(new RegExp(`/admin/enrollments/${QA_IDS.enrollment}$`));
  const classes=page.getByRole("region",{name:"Enrollment classes"});
  await expect(classes).toBeVisible({timeout:20_000});
  await expect(classes.getByText("Booked class records")).toBeVisible();
  await classes.getByRole("link",{name:"All enrollment classes"}).click();
  await expect(page).toHaveURL(new RegExp(`/admin/classes\\?enrollment=${QA_IDS.enrollment}`));
  await expect(page.getByRole("button",{name:/Clear enrollment filter/i})).toBeVisible({timeout:20_000});
  const {data:dbClasses,error:classesError}=await db.from("schedule_events")
    .select("id,enrollment_id").eq("enrollment_id",QA_IDS.enrollment).eq("event_type","class").limit(100);
  if(classesError)throw classesError;
  expect(dbClasses).toBeDefined();
  await expect(page.getByRole("heading").first()).toBeVisible();
 });

 test("admin can open the seeded class workspace and return to enrollment",async({page})=>{
  await ensureRoleSession(page,"admin");
  await page.goto(`/admin/classes/${QA_IDS.workflowClass}`,{waitUntil:"domcontentloaded"});
  await assertHealthyScreen(page,`/admin/classes/${QA_IDS.workflowClass}`);
  const back=page.getByRole("link",{name:"Open enrollment"});
  await expect(back).toBeVisible({timeout:20_000});
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/admin/enrollments/${QA_IDS.enrollment}$`));
 });

 test("trainer and parent can navigate to their respective learning views",async({browser})=>{
  const trainer=await newRoleContext(browser,"trainer");
  try{
   await trainer.page.goto("/trainer/schedule",{waitUntil:"domcontentloaded"});
   await assertHealthyScreen(trainer.page,"/trainer/schedule");
   await expect(trainer.page.getByRole("heading").first()).toBeVisible();
   await trainer.page.goto(`/trainer/classes/${QA_IDS.workflowClass}`,{waitUntil:"domcontentloaded"});
   await expect(trainer.page.getByRole("heading",{name:/Attendance & learning outcome/i})).toBeVisible({timeout:20_000});
  }finally{await trainer.context.close()}
  const parent=await newRoleContext(browser,"parent");
  try{
   await parent.page.goto(`/parent/learner/${QA_IDS.student}`,{waitUntil:"domcontentloaded"});
   await assertHealthyScreen(parent.page,`/parent/learner/${QA_IDS.student}`);
   await expect(parent.page.getByRole("heading").first()).toBeVisible();
  }finally{await parent.context.close()}
 });

 test("Zoom classroom authorization is enforced for every role",async({browser,request})=>{
  const path=`/api/zoom/classroom/${QA_IDS.workflowClass}`;
  const unauth=await request.get(path);
  expect(unauth.status()).toBe(401);
  const roles=["admin","trainer","parent","student"] as const;
  for(const role of roles){
   const {context,page}=await newRoleContext(browser,role);
   try{
    const {storageKey}=authConfig();
    const accessToken=await page.evaluate(key=>{
      const raw=localStorage.getItem(key);
      return raw?(JSON.parse(raw).access_token as string):"";
    },storageKey);
    expect(accessToken).toBeTruthy();
    const response=await context.request.get(path,{headers:{Authorization:`Bearer ${accessToken}`}});
    expect(response.status(),`${role} classroom access`).toBe(200);
    const json=await response.json();
    expect(json.ok).toBe(true);
    expect(json.classroom.canJoin).toBe(true);
    expect(json.classroom.canHost).toBe(role==="admin"||role==="trainer");
   }finally{await context.close()}
  }
 });

 test("recording endpoints require authentication, even for unknown IDs",async({request})=>{
  const id="00000000-0000-4000-8000-000000000099";
  for(const path of [`/api/zoom/recordings/${id}`,`/api/zoom/classroom/${QA_IDS.workflowClass}`]){
   const response=await request.get(path);
   expect(response.status(),`Public GET ${path}`).toBe(401);
  }
  const result=await request.patch(`/api/zoom/recordings/${id}`,{data:{action:"delete"}});
  expect(result.status()).toBe(401);
 });
});
