import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Super Admin onboarding no longer requires customer Auth UUID",()=>{
 const ui=read("app/platform-admin/page.tsx");
 assert.match(ui,/Owner email/);
 assert.match(ui,/customer-invitations/);
 assert.match(ui,/manual delivery/);
 assert.doesNotMatch(ui,/Owner Auth UUID/);
});
test("pending invitations have no membership until email-verified acceptance",()=>{
 const sql=read("database/saas/79_phase7a_pending_customer_invitations.sql");
 assert.match(sql,/create table if not exists saas.pending_customer_invitations/);
 assert.match(sql,/email_confirmed_at is null/);
 assert.match(sql,/select \* into rec .* for update/);
 assert.match(sql,/public.saas_onboard_organization_v1/);
 assert.match(sql,/rec.status<>'pending'/);
 assert.match(sql,/rec.expires_at<=now/);
 assert.match(sql,/status='accepted'/);
});
test("pending invitation RPCs are not browser callable",()=>{
 for(const p of ["database/saas/79_phase7a_pending_customer_invitations.sql","database/saas/80_phase7a_pending_customer_admin_rpc.sql"]){
  const sql=read(p);
  assert.match(sql,/revoke all on function/);
  assert.match(sql,/service_role/);
  assert.match(sql,/security definer/);
 }
});
test("Invitation API verifies bearer identity and hashes link token",()=>{
 const route=read("app/api/platform-admin/customer-invitations/route.ts");
 const accept=read("app/api/platform-admin/customer-invitations/accept/route.ts");
 assert.match(route,/requirePlatformAdmin/);
 assert.match(route,/randomBytes\(32\)/);
 assert.match(route,/delivery:"manual"/);
 assert.match(accept,/verifiedBrandingActor/);
 assert.match(accept,/createHash\("sha256"\)/);
});
