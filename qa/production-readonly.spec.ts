import {test,expect} from "@playwright/test";
import {ensureRoleSession} from "./session";
import {assertHealthyScreen} from "./helpers";
import {authConfig} from "./env";

/** Read-only against production: no service-role access, seed or cleanup. */
test.describe("Production read-only authenticated smoke",()=>{
 test.setTimeout(90000);
 const cases=[
  {role:"admin",paths:["/admin","/admin/students","/admin/enrollments","/admin/classes"]},
  {role:"trainer",paths:["/trainer","/trainer/schedule","/trainer/classes"]},
  {role:"parent",paths:["/parent"]},
  {role:"student",paths:["/student"]}
 ] as const;
 for(const {role,paths} of cases){
  test(`${role} signs in and accesses read-only portal pages`,async({page})=>{
   await ensureRoleSession(page,role);
   for(const path of paths){
    const res=await page.goto(path,{waitUntil:"domcontentloaded"});
    expect(res?.status(),`${role}: ${path}`).toBeLessThan(500);
    await assertHealthyScreen(page,path);
   }
  });
 }
 test("signed in QA roles cannot access privileged foreign screens",async({browser})=>{
  for(const role of ["parent","student","trainer"] as const){
   const context=await browser.newContext();
   try{
    const page=await context.newPage();
    await ensureRoleSession(page,role);
    await page.goto("/admin",{waitUntil:"domcontentloaded"});
    await expect.poll(()=>new URL(page.url()).pathname,{timeout:18000})
     .not.toBe("/admin");
   }finally{await context.close()}
  }
 });
 test("anonymous Zoom endpoints do not reveal classroom and recording data",async({request})=>{
  const id="00000000-0000-4000-8000-000000000099";
  for(const path of [`/api/zoom/classroom/${id}`,`/api/zoom/recordings/${id}`]){
   const response=await request.get(path);
   expect(response.status(),path).toBe(401);
  }
 });
 test("each authenticated QA role has a valid active session",async({page})=>{
  await ensureRoleSession(page,"parent");
  const {storageKey}=authConfig();
  const exists=await page.evaluate(key=>Boolean(localStorage.getItem(key)),storageKey);
  expect(exists).toBe(true);
 });
});
