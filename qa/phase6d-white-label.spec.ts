import {test,expect,type Page} from "@playwright/test";
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
const theme=(primary:string)=>({primary,secondary:"#e83d8c",accent:"#14b8a6",primaryHover:"#123b99",primarySoft:"#eef2ff",onPrimary:"#ffffff"});
async function mock(page:Page){
 let selected=A;
 let levelA:"standard"|"custom"|"white_label"="custom";
 let levelB:"standard"|"custom"|"white_label"="standard";
 await page.addInitScript(()=>{
  localStorage.setItem("sb-mock-auth-token",JSON.stringify({access_token:"qa-synthetic-access-token",
   refresh_token:"qa-synthetic-refresh-token",token_type:"bearer",
   expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,
   user:{id:"55555555-5555-4555-8555-555555555555",email:"qa@example.test",app_metadata:{provider:"email"},
    user_metadata:{},aud:"authenticated",role:"authenticated",created_at:new Date().toISOString()}}));
 });
 await page.route("https://mock.supabase.co/**",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
 await page.route("**/api/platform/**",route=>{
  const req=route.request(),u=new URL(req.url()),body=JSON.parse(req.postData()||"{}");
  let data:Record<string,unknown>={ok:true};
  if(u.pathname.endsWith("/organizations")){
   if(req.method()==="POST")selected=body.organizationId;
   if(req.method()==="DELETE")selected="";
   data={ok:true,organizations:[{id:A,displayName:"Alpha Academy",slug:"alpha",role:"owner"},{id:B,displayName:"Beta Academy",slug:"beta",role:"owner"}],selectedOrganizationId:selected||null,requiresSelection:!selected};
  }else if(u.pathname.endsWith("/organization-modules"))data={ok:true,modules:{academy:true,crm:true,tasks:true}};
  else if(u.pathname.endsWith("/organization-links"))data={ok:true,links:{crm:{status:"disabled",tenantId:null},tasks:{status:"disabled",workspaces:[]}}};
  else if(u.pathname.endsWith("/my-products"))data={ok:true,products:[{id:"portal",label:"Academy",href:"/admin"}]};
  else if(u.pathname.endsWith("/capabilities"))data={ok:true,legacyDefault:false,products:["portal"]};
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
 });
 await page.route("**/api/tenant-branding**",route=>{
  const id=new URL(route.request().url()).searchParams.get("organizationId");
  const a=id===A,level=a?levelA:levelB;
  const brand={organizationId:id,slug:a?"alpha":"beta",name:a?"Alpha Academy":"Beta Academy",
   level,tagline:level==="standard"?"":a?"Explore and create":"Learn Beta",
   logoUrl:level==="standard"?"":a?"https://example.com/alpha.png":"https://example.com/beta.png",
   theme:level==="standard"?theme("#6d3cc9"):theme(a?"#235ce2":"#126b4d")};
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,branding:brand})});
 });
 return {setA:(l:typeof levelA)=>{levelA=l},setB:(l:typeof levelB)=>{levelB=l}};
}
test("Vendor attribution is visible on Custom and Standard, suppressed for White-label",async({page})=>{
 const state=await mock(page);await page.goto("/suite");
 await expect(page.locator("[data-tenant-id='"+A+"']")).toBeVisible();
 await expect(page.locator(".tenantVendorAttribution")).toContainText("Powered by Robotronix");
 await expect.poll(()=>page.locator("[data-tenant-id='"+A+"']").evaluate(x=>getComputedStyle(x).getPropertyValue("--brand-primary").trim())).toBe("#235ce2");
 await page.getByLabel("Active organization").selectOption(B);
 await expect(page.locator("[data-tenant-id='"+B+"']")).toBeVisible();
 await expect.poll(()=>page.locator("[data-tenant-id='"+B+"']").evaluate(x=>getComputedStyle(x).getPropertyValue("--brand-primary").trim())).toBe("#6d3cc9");
 await expect(page.getByText("Learn Beta")).toHaveCount(0);
 await expect(page.locator(".tenantVendorAttribution")).toContainText("Powered by Robotronix");
 state.setB("custom");await page.reload();
 await expect.poll(()=>page.locator("[data-tenant-id='"+B+"']").evaluate(x=>getComputedStyle(x).getPropertyValue("--brand-primary").trim())).toBe("#126b4d");
 state.setB("white_label");await page.reload();
 await expect(page.locator("[data-tenant-id='"+B+"']")).toBeVisible();
 await expect(page.locator(".tenantVendorAttribution")).toHaveCount(0);
 await expect.poll(()=>page.locator("[data-tenant-id='"+B+"']").evaluate(x=>getComputedStyle(x).getPropertyValue("--brand-primary").trim())).toBe("#126b4d");
});
test("Downgrading an organization resets its actual rendered theme; workspace selection remains isolated",async({page})=>{
 const state=await mock(page);await page.goto("/suite");
 await expect(page.locator("[data-tenant-id='"+A+"']")).toBeVisible();
 state.setA("standard");await page.reload();
 await expect(page.locator(".tenantVendorAttribution")).toContainText("Powered by Robotronix");
 await expect.poll(()=>page.locator("[data-tenant-id='"+A+"']").evaluate(x=>getComputedStyle(x).getPropertyValue("--brand-primary").trim())).toBe("#6d3cc9");
 state.setA("custom");await page.reload();
 await expect(page.locator(".tenantVendorAttribution")).toContainText("Powered by Robotronix");
 await expect.poll(()=>page.locator("[data-tenant-id='"+A+"']").evaluate(x=>getComputedStyle(x).getPropertyValue("--brand-primary").trim())).toBe("#235ce2");
});

test("White-label Suite mobile removes vendor attribution without page overflow",async({page})=>{
 const state=await mock(page);state.setA("white_label");
 await page.setViewportSize({width:390,height:844});await page.goto("/suite");
 await expect(page.locator("[data-tenant-id='"+A+"']")).toBeVisible();
 await expect(page.locator(".tenantVendorAttribution")).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});
