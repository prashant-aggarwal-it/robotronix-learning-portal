import {test,expect} from "@playwright/test";
import {ensureRoleSession} from "./session";
import {authConfig} from "./env";

const foreignTenant="00000000-0000-4000-8000-000000000099";

/**
 * Read-only, real signed-in integration checks. The QA environment must have
 * an active Connect CRM membership linked to the admin test identity.
 * Missing fixture/config is a failure, not a skip. Never targets production.
 */
test.describe("Connect → Portal integration contracts (DEV only)",()=>{
 test.beforeAll(()=>{
  if(process.env.QA_TARGET!=="dev"||!process.env.SECURITY_QA_PROJECT_REF||
     process.env.SECURITY_QA_PROJECT_REF!==new URL(authConfig().url).hostname.split(".")[0])
   throw Error("Connect integration requires explicit isolated DEV project and QA_TARGET=dev");
 });

 test("authorized staff sees permission-scoped lifecycle and no raw ledger",async({page})=>{
  await ensureRoleSession(page,"admin");
  const {storageKey}=authConfig();
  const token=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||"{}").access_token as string,storageKey);
  expect(token).toBeTruthy();
  const headers={Authorization:`Bearer ${token}`};
  const list=await page.request.get("/api/connect/workspaces",{headers});
  expect(list.ok(),await list.text()).toBe(true);
  const workspaces=(await list.json()).workspaces as Array<{tenant_id:string}>;
  expect(workspaces.length,"Seed at least one CRM workspace for the QA admin").toBeGreaterThan(0);
  const tenant=workspaces[0].tenant_id;
  for(const endpoint of ["admissions","portal-demos","lifecycle"]){
   const response=await page.request.get(`/api/connect/workspaces/${tenant}/${endpoint}`,{headers});
   expect(response.ok(),`${endpoint}: ${await response.text()}`).toBe(true);
   expect(response.headers()["cache-control"]).toContain("no-store");
  }
  const lifecycle=await page.request.get(`/api/connect/workspaces/${tenant}/lifecycle`,{headers});
  const body=await lifecycle.json() as {items:Record<string,unknown>[]};
  expect(Array.isArray(body.items)).toBe(true);
  for(const item of body.items){
   for(const forbidden of ["token_hash","guest_token","guardian_consent","invoice_value_inr","amount_due","payment_reference","note","feedback"])
    expect(item).not.toHaveProperty(forbidden);
  }
 });

 test("a signed-in user cannot read a foreign tenant's lifecycle",async({page})=>{
  await ensureRoleSession(page,"admin");
  const {storageKey}=authConfig();
  const token=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||"{}").access_token as string,storageKey);
  const response=await page.request.get(`/api/connect/workspaces/${foreignTenant}/lifecycle`,{
   headers:{Authorization:`Bearer ${token}`}
  });
  expect(response.status()).toBe(403);
 });

 for(const role of ["COUNSELLOR","VIEWER"] as const){
  test(`${role.toLowerCase()} sees only appropriately scoped lifecycle data`,async({request})=>{
   const email=process.env[`QA_CONNECT_${role}_EMAIL`];
   const password=process.env[`QA_CONNECT_${role}_PASSWORD`];
   if(!email||!password)throw Error(`Missing isolated QA_CONNECT_${role}_EMAIL/PASSWORD`);
   const {url,anonKey}=authConfig();
   const login=await request.post(`${url}/auth/v1/token?grant_type=password`,{
    headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`},data:{email,password}
   });
   expect(login.ok(),`QA Connect ${role} login failed`).toBe(true);
   const {access_token:token}=await login.json() as {access_token:string};
   const headers={Authorization:`Bearer ${token}`};
   const workspaceResponse=await request.get("/api/connect/workspaces",{headers});
   expect(workspaceResponse.ok()).toBe(true);
   const workspaces=(await workspaceResponse.json()).workspaces as Array<{tenant_id:string;membership_role:string}>;
   const workspace=workspaces.find(item=>item.membership_role===role.toLowerCase());
   expect(workspace,`Seed a CRM ${role} membership for the QA user`).toBeDefined();
   const lifecycle=await request.get(`/api/connect/workspaces/${workspace!.tenant_id}/lifecycle`,{headers});
   expect(lifecycle.ok()).toBe(true);
   const data=await lifecycle.json() as {items:Array<{payment_attention:boolean|null}>};
   if(role==="VIEWER")expect(data.items).toEqual([]);
   else for(const item of data.items)expect(item.payment_attention).toBeNull();
   const foreign=await request.get(`/api/connect/workspaces/${foreignTenant}/lifecycle`,{headers});
   expect(foreign.status()).toBe(403);
  });
 }
});
