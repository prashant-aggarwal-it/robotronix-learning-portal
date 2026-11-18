import {test,expect,type Page} from "@playwright/test";
const ORG="11111111-1111-4111-8111-111111111111";
async function session(page:Page){
 await page.addInitScript(()=>{
  const auth={access_token:"synthetic-phase6b",refresh_token:"synthetic-phase6b-refresh",
   token_type:"bearer",expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,
   user:{id:"55555555-5555-4555-8555-555555555555",email:"qa@example.test",
    app_metadata:{provider:"email"},user_metadata:{},aud:"authenticated",role:"authenticated",
    created_at:new Date().toISOString()}};
  localStorage.setItem("sb-mock-auth-token",JSON.stringify(auth));
 });
 await page.route("https://mock.supabase.co/**",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
}
test("Platform Super Admin can upgrade and confirm downgrade without losing saved entitlement state",async({page})=>{
 await session(page);
 let level:"standard"|"custom"|"white_label"="standard";
 await page.route("**/api/platform-admin/overview?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,organizations:[{id:ORG,slug:"alpha",display_name:"Alpha Academy",status:"active",created_at:"2026-01-01T00:00:00Z"}],page:1,total:1,metrics:{organizations:1,trials:0,activeSubscriptions:0}})}));
 await page.route("**/api/platform/branding-entitlements?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,organizationId:ORG,level,isDefault:level==="standard"})}));
 await page.route("**/api/platform/branding-entitlements",async route=>{
  const body=route.request().postDataJSON();
  level=body.level;
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,organizationId:ORG,level,changed:true})});
 });
 await page.goto("/platform-admin#customers");
 await expect(page.getByRole("heading",{name:"Branding entitlements"})).toBeVisible();
 await page.getByLabel("Branding customer").selectOption(ORG);
 await expect(page.getByText("Current level: standard")).toBeVisible();
 await page.getByLabel("Branding level").selectOption("custom");
 await page.getByRole("button",{name:"Update branding access"}).click();
 await expect(page.getByText("Current level: custom")).toBeVisible();
 page.once("dialog",dialog=>dialog.accept());
 await page.getByLabel("Branding level").selectOption("standard");
 await page.getByRole("button",{name:"Update branding access"}).click();
 await expect(page.getByText("Current level: standard")).toBeVisible();
});
test("Standard Owner sees saved branding but cannot edit; upgrading unlocks Studio",async({page})=>{
 await session(page);
 let edit=false;
 await page.route("**/api/branding-studio/owner",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,organizations:[{id:ORG,slug:"alpha",display_name:"Alpha Academy"}]})}));
 await page.route("**/api/branding-studio?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,organization:{id:ORG,slug:"alpha",display_name:"Alpha Academy"},
   branding:{tagline:"Saved Academy",logoUrl:"",accentColor:"#4537a5",palette:null},canEdit:edit})}));
 await page.route("**/api/platform/branding-entitlements?*",route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,organizationId:ORG,level:edit?"custom":"standard",isDefault:!edit})}));
 await page.goto("/onboarding/branding");
 await expect(page.getByText("Standard branding is active.")).toBeVisible();
 await expect(page.getByRole("button",{name:"Browse logo"})).toBeDisabled();
 await expect(page.locator(".brandingPreview")).toBeVisible();
 expect(await page.getByLabel("Tagline").inputValue()).toBe("Saved Academy");
 edit=true;await page.reload();
 await expect(page.getByRole("button",{name:"Browse logo"})).toBeEnabled();
 await expect(page.getByLabel("Tagline")).toBeEnabled();
});
