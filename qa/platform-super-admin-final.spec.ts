import {test,expect,type Page} from "@playwright/test";
const ORG="bc83e7f0-dc14-401c-8776-2af84045ff8e";
const ADMIN="eab2e455-886c-4835-9c2b-7901bfbb249a";
const org={id:ORG,display_name:"Synthetic School C",slug:"saas-e2e-c-bc83e7f0dc14",status:"active",created_at:"2026-11-17T00:00:00Z"};
async function prepare(page:Page,events:{actions:string[];plan?:string}){
 await page.addInitScript(()=>{
  const auth={access_token:"synthetic-final-ux",refresh_token:"synthetic-final-ux-refresh",token_type:"bearer",
   expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,user:{id:"55555555-5555-4555-8555-555555555555",
   email:"qa@example.test",app_metadata:{provider:"email"},user_metadata:{},aud:"authenticated",
   role:"authenticated",email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString()}};
  localStorage.setItem("sb-mock-auth-token",JSON.stringify(auth));
 });
 await page.route("https://mock.supabase.co/**",route=>route.fulfill({status:200,contentType:"application/json",body:"{}"}));
 await page.route("**/api/platform-admin/**",async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  const body=(method==="POST"||method==="DELETE")?req.postDataJSON():{};
  if(method==="POST"&&body?.action)events.actions.push(String(body.action));
  const respond=(v:unknown)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,...(v as object)})});
  if(path.endsWith("/overview"))return respond({organizations:[org],page:1,total:1,metrics:{organizations:1,activeSubscriptions:0,trials:0}});
  if(path.endsWith("/customer-preview"))return respond({organizations:[org]});
  if(path.endsWith("/operations-summary"))return respond({subscriptions:[{organization_id:ORG,organization_name:org.display_name,plan_code:"qa_trial",status:"trial",ends_at:"2026-11-18T00:00:00Z"}],
   metrics:{expiringTrials:0,expiredTrials:1,pendingInvitations:0,expiredInvitations:0,pastDueSubscriptions:0},
   alerts:[{type:"trial_expired",organizationId:ORG,organizationName:org.display_name,expiresAt:"2026-11-18T00:00:00Z"}],truncated:false});
  if(path.endsWith("/subscriptions"))return respond(method==="POST"?{result:{}}:{subscription:{plan_code:"qa_trial",status:"trial",started_at:"2026-11-01T00:00:00Z",ends_at:"2026-11-18T00:00:00Z"},modules:[{module:"academy",enabled:true},{module:"crm",enabled:false},{module:"tasks",enabled:false}],events:[]});
  if(path.endsWith("/customer-invitations"))return respond(method==="POST"?{invitation:{id:ORG,status:"pending"},delivery:"not_configured",message:"Email delivery is not configured",invitationUrl:"http://localhost:3000/customer-invite?token="+("a".repeat(64))}:{invitations:[],deliveries:[]});
  if(path.endsWith("/manage"))return respond(method==="POST"?{result:{}}:{invitations:[]});
  if(path.endsWith("/administrators"))return respond(url.searchParams.has("email")?{verifiedUserId:ADMIN,lookupLimited:false}:{administrators:[],audit:[]});
  if(path.endsWith("/incidents"))return respond({incidents:[],history:[]});
  if(path.endsWith("/reliability"))return respond({observedAt:new Date().toISOString()});
  return respond({});
 });
 await page.route("**/api/platform/branding-entitlements*",async route=>{
  if(route.request().method()==="POST"){events.plan="custom";return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,level:"custom"})})}
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,level:events.plan||"standard"})});
 });
 await page.route("**/api/branding-studio*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,canEdit:true,branding:{tagline:"",logoUrl:"",accentColor:"#4537a5",palette:null}})}));
}
test("Directory customer actions preserve customer identity and hide IDs until expanded",async({page})=>{
 const events={actions:[] as string[]};await prepare(page,events);
 await page.goto("/platform-admin#directory");
 await expect(page.getByRole("columnheader",{name:"Workspace slug"})).toHaveCount(0);
 await page.getByRole("button",{name:"View customer",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Synthetic School C",exact:true})).toBeVisible();
 await expect(page.getByText("Organization ID",{exact:true})).not.toBeVisible();
 await page.getByText("Technical details",{exact:true}).click();
 await expect(page.getByText("Organization ID",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Subscription & modules"}).click();
 await expect(page.locator("#subscription-management").getByText("Customer: Synthetic School C").first()).toBeVisible();
 await expect(page.getByText(/Expired trial/).first()).toBeVisible();
});
test("Overview follow-up opens selected customer and subscription writes remain wired",async({page})=>{
 const events={actions:[] as string[]};await prepare(page,events);
 await page.goto("/platform-admin#overview");
 await page.getByRole("button",{name:"Manage subscription",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Synthetic School C",exact:true})).toBeVisible();
 await page.getByLabel("New subscription end date").fill("2026-12-31T17:00");
 await page.getByRole("button",{name:"Extend trial"}).click();
 await expect.poll(()=>events.actions.includes("extend_trial")).toBe(true);
});
test("New customer creates activation request with generated advanced slug",async({page})=>{
 const events={actions:[] as string[]};await prepare(page,events);
 await page.goto("/platform-admin#onboarding");
 await page.getByLabel("Owner email").fill("owner@example.test");
 await page.getByLabel("Organization name").fill("Bright Future Academy");
 await page.getByText("Advanced workspace URL settings").click();
 await expect(page.getByLabel("Workspace URL name")).toHaveValue("bright-future-academy");
 await page.getByRole("button",{name:"Create customer & attempt activation email"}).click();
 await expect(page.getByText(/Email delivery is not configured/).first()).toBeVisible();
});
test("Branding is bound to selected customer and entitlement update reopens studio",async({page})=>{
 const events={actions:[] as string[],plan:"standard"};await prepare(page,events);
 await page.goto("/platform-admin#directory");
 await page.getByRole("button",{name:"View customer",exact:true}).click();
 await page.getByRole("button",{name:"Branding",exact:true}).click();
 await expect(page.getByLabel("Choose organization")).toHaveValue(ORG);
 await page.getByLabel("Branding level").selectOption("custom");
 await page.getByRole("button",{name:"Update branding access"}).click();
 await expect.poll(()=>events.plan).toBe("custom");
 await expect(page.getByLabel("Choose organization")).toHaveValue(ORG);
});
test("Security administrator access uses email lookup, never UUID input",async({page})=>{
 const events={actions:[] as string[]};await prepare(page,events);
 await page.goto("/platform-admin#system-health");
 await page.getByRole("button",{name:"Security & Incidents"}).click();
 await page.getByLabel("Find verified account by email").fill("admin@example.com");
 await page.getByRole("button",{name:"Find verified user"}).click();
 await expect(page.getByRole("button",{name:"Grant platform administrator"})).toBeVisible();
 page.once("dialog",d=>void d.accept("admin@example.com"));
 await page.getByRole("button",{name:"Grant platform administrator"}).click();
 await expect.poll(()=>events.actions.includes("grant_platform_admin")).toBe(true);
});
