import {test,expect} from "@playwright/test";
test.describe("Production anonymous read-only smoke",()=>{
 test("homepage and sign-in load without server errors",async({page})=>{
  for(const path of ["/","/login","/privacy"]){
   const response=await page.goto(path,{waitUntil:"domcontentloaded"});
   expect(response?.status(),path).toBe(200);
   await expect(page.locator("body")).not.toContainText("Application error");
   await expect(page.locator("body")).not.toContainText("Internal Server Error");
  }
 });
 test("private Zoom classroom and recordings require a session",async({request})=>{
  const id="00000000-0000-4000-8000-000000000099";
  for(const path of [`/api/zoom/classroom/${id}`,`/api/zoom/recordings/${id}`]){
   const response=await request.get(path);
   expect(response.status(),path).toBe(401);
  }
 });
});
