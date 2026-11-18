import {test,expect,type Page} from "@playwright/test";
const ORG="11111111-1111-4111-8111-111111111111";
async function session(page:Page){
 await page.addInitScript(()=>{
  const auth={access_token:"synthetic-phase7a",refresh_token:"synthetic-phase7a-refresh",
   token_type:"bearer",expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,
   user:{id:"55555555-5555-4555-8555-555555555555",email:"qa@example.test",
   app_metadata:{provider:"email"},user_metadata:{},aud:"authenticated",role:"authenticated",
   email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString()}};
  localStorage.setItem("sb-mock-auth-token",JSON.stringify(auth));
 });
 await page.route("https://mock.supabase.co/**",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
}
test("Super Admin creates pending customer by Owner email without a UUID",async({page})=>{
 await session(page);
 const submitted:{value:Record<string,unknown>}={value:{}};
 await page.route("**/api/platform-admin/overview?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,organizations:[],page:1,total:0,metrics:{organizations:0,trials:0,activeSubscriptions:0}})}));
 await page.route("**/api/platform-admin/customer-invitations",route=>{
  if(route.request().method()==="POST"){
   submitted.value=route.request().postDataJSON();
   return route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({
    ok:true,invitation:{id:ORG,status:"pending"},delivery:"manual",
    invitationUrl:"http://localhost:3000/customer-invite?token="+("a".repeat(64))})});
  }
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,invitations:[]})});
 });
 await page.goto("/platform-admin#onboarding");
 await expect(page.getByText("Owner Auth UUID")).toHaveCount(0);
 await page.getByLabel("Owner email").fill("owner@brightfuture.example");
 await page.getByLabel("Organization name").fill("Bright Future Academy");
 await expect(page.getByLabel("URL slug")).toHaveValue("bright-future-academy");
 await page.getByRole("button",{name:"Create customer invitation"}).click();
 await expect(page.getByText(/Invitation pending/)).toBeVisible();
 await expect(page.getByLabel("Owner invitation link")).toHaveValue(/\/customer-invite\?token=/);
 expect(submitted.value.ownerEmail).toBe("owner@brightfuture.example");
 expect(submitted.value.ownerId).toBeUndefined();
});
test("Verified customer can open invitation acceptance screen",async({page})=>{
 await session(page);
 await page.route("**/api/platform-admin/customer-invitations/accept",route=>route.fulfill({
  status:403,contentType:"application/json",
  body:JSON.stringify({ok:false,error:"Invitation intended for another email"})}));
 await page.goto("/customer-invite?token="+("a".repeat(64)));
 await expect(page.getByRole("heading",{name:"Join your academy"})).toBeVisible();
 await page.getByRole("button",{name:"Accept invitation and start trial"}).click();
 await expect(page.getByText("Invitation intended for another email")).toBeVisible();
});
