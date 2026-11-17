import {test,expect,type Page} from "@playwright/test";

const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
const CRM_A="33333333-3333-4333-8333-333333333333";
const CRM_B="44444444-4444-4444-8444-444444444444";
const orgs=[{id:A,displayName:"Alpha Academy",slug:"alpha",role:"owner"},{id:B,displayName:"Beta Academy",slug:"beta",role:"owner"}];

async function mockSuite(page:Page){
 let selected=A;
 let tenantAccess=CRM_A;
 let getCalls=0;
 await page.addInitScript(()=>{
  const session={access_token:"qa-synthetic-access-token",refresh_token:"qa-synthetic-refresh-token",
   token_type:"bearer",expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,
   user:{id:"55555555-5555-4555-8555-555555555555",email:"qa@example.test",app_metadata:{provider:"email"},
    user_metadata:{},aud:"authenticated",role:"authenticated",created_at:new Date().toISOString()}};
  localStorage.setItem("sb-mock-auth-token",JSON.stringify(session));
 });
 await page.route("https://mock.supabase.co/**",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
 await page.route("**/api/platform/**",async route=>{
  const req=route.request(),u=new URL(req.url());
  const body=JSON.parse(req.postData()||"{}");
  let payload:Record<string,unknown>={ok:true};
  if(u.pathname.endsWith("/organizations")){
   if(req.method()==="POST")selected=body.organizationId;
   if(req.method()==="DELETE")selected="";
   payload={ok:true,organizations:orgs,selectedOrganizationId:selected||null,requiresSelection:!selected};
  }else if(u.pathname.endsWith("/organization-modules")){
   payload={ok:true,modules:{academy:true,crm:true,tasks:true}};
  }else if(u.pathname.endsWith("/organization-links")){
   payload={ok:true,links:{crm:{status:"ready",tenantId:u.searchParams.get("organizationId")===A?CRM_A:CRM_B},
    tasks:{status:"ready",workspaces:[]}}};
  }else if(u.pathname.endsWith("/my-products")){
   payload={ok:true,products:[{id:"portal",href:"/admin",label:"Academy"},
    {id:"crm",href:"/connect",label:"Connect"},{id:"tasks",href:"/tasks",label:"My Tasks"}]};
  }else if(u.pathname.endsWith("/capabilities")){
   payload={ok:true,legacyDefault:false,products:["portal","crm","tasks"]};
  }else payload={ok:true};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload)});
 });
 await page.route("**/api/tenant-branding**",async route=>{
  getCalls++;
  const id=new URL(route.request().url()).searchParams.get("organizationId");
  const alpha=id===A;
  await route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({ok:true,branding:{
    organizationId:id,slug:alpha?"alpha":"beta",name:alpha?"Alpha Academy":"Beta Academy",
    tagline:alpha?"Explore and create":"Learn with Beta",logoUrl:"",
    theme:{primary:alpha?"#235ce2":"#126b4d",secondary:"#e83d8c",accent:"#14b8a6",
     primaryHover:"#123b99",primarySoft:"#eef2ff",onPrimary:"#ffffff"}}})});
 });
 await page.route("**/api/connect/**",async route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,items:[]})}));
 // Playwright selects the last registered matching route.
 await page.route("**/api/connect/workspaces",async route=>route.fulfill({status:200,contentType:"application/json",
  body:JSON.stringify({ok:true,workspaces:[{tenant_id:tenantAccess,workspace_name:"QA CRM"}]})}));
 return {getSelected:()=>selected,setCrmTenant:(id:string)=>{tenantAccess=id},getCalls:()=>getCalls};
}
test("Suite theme follows server-confirmed organization selection without page reload",async({page})=>{
 await mockSuite(page);
 let loads=0;
 page.on("load",()=>loads++);
 await page.goto("/suite");
 await expect(page.locator("[data-tenant-id='"+A+"']")).toBeVisible();
 await expect(page.getByText("Alpha Academy").first()).toBeVisible();
 await expect.poll(()=>page.locator("[data-tenant-id='"+A+"']").evaluate(el=>getComputedStyle(el).getPropertyValue("--brand-primary").trim())).toBe("#235ce2");
 const initialLoads=loads;
 await page.getByLabel("Active organization").selectOption(B);
 await expect(page.locator("[data-tenant-id='"+B+"']")).toBeVisible();
 await expect(page.getByText("Beta Academy").first()).toBeVisible();
 await expect.poll(()=>page.locator("[data-tenant-id='"+B+"']").evaluate(el=>getComputedStyle(el).getPropertyValue("--brand-primary").trim())).toBe("#126b4d");
 expect(loads).toBe(initialLoads);
 await page.reload();
 await expect(page.locator("[data-tenant-id='"+B+"']")).toBeVisible();
});
test("Suite mobile layout does not overflow after switching identity",async({page})=>{
 await mockSuite(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/suite");
 await expect(page.locator("[data-tenant-id='"+A+"']")).toBeVisible();
 await page.getByLabel("Active organization").selectOption(B);
 await expect(page.locator("[data-tenant-id='"+B+"']")).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
test("unlinked CRM workspace does not borrow Suite tenant branding",async({page})=>{
 const api=await mockSuite(page);
 api.setCrmTenant(CRM_B);
 await page.goto("/connect");
 await expect(page.locator(".cx-sidebar")).toBeVisible();
 await expect(page.locator("[data-tenant-id='"+A+"']")).toHaveCount(0);
 expect(await page.locator(".tenantThemeScope").count()).toBe(0);
});
