import {test,expect} from "@playwright/test";

const tenant="00000000-0000-4000-8000-000000000099";
const routes=[
 `/api/connect/workspaces/${tenant}/admissions`,
 `/api/connect/workspaces/${tenant}/portal-demos`,
 `/api/connect/workspaces/${tenant}/lifecycle`
];

test.describe("Connect API authentication and sensitive-response boundaries",()=>{
 for(const path of routes){
  test(`unauthenticated GET denied: ${path.split("/").at(-1)}`,async({request})=>{
   const result=await request.get(path,{headers:{Authorization:""}});
   expect(result.status()).toBe(401);
   expect(result.headers()["cache-control"]).toContain("no-store");
   const body=await result.json();
   expect(body.ok).toBe(false);
   expect(JSON.stringify(body)).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY|stack|postgresql:|access_token/i);
  });
 }

 test("unauthenticated lifecycle writes cannot change renewal status",async({request})=>{
  const result=await request.post(`/api/connect/workspaces/${tenant}/lifecycle`,{
   data:{enrollmentId:tenant,status:"dismissed"}
  });
  expect(result.status()).toBe(401);
 });

 test("unauthenticated integration install cannot be enabled",async({request})=>{
  const response=await request.post(`/api/connect/workspaces/${tenant}/portal-integration`,{data:{action:"enable"}});
  expect(response.status()).toBe(401);
 });

 test("malformed lifecycle tenant is rejected before database access",async({request})=>{
  const response=await request.get("/api/connect/workspaces/not-a-uuid/lifecycle");
  expect(response.status()).toBe(400);
 });
});
