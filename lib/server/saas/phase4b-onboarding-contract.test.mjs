import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api=fs.readFileSync("app/api/platform/onboard/route.ts","utf8");
const ui=fs.readFileSync("app/onboarding/organization/page.tsx","utf8");
const subscription=fs.readFileSync("app/api/platform-admin/subscriptions/route.ts","utf8");
const sql=fs.readFileSync("database/saas/62_phase4a_atomic_modules.sql","utf8");

test("same endpoint serves self-service and assisted onboarding",()=>{
 assert.match(api,/const assisted=body\.assisted===true/);
 assert.match(api,/requirePlatformAdmin/);
 assert.match(api,/p_owner_id:ownerId/);
 assert.match(api,/saas_onboard_organization_v1/);
});
test("untrusted input is validated before privileged provisioning",()=>{
 assert.match(api,/new Set\(body\.modules\)\.size!==body\.modules\.length/);
 assert.match(api,/reservedSlugs\.has\(body\.slug\)/);
 assert.match(api,/uuid\.test\(body\.requestKey\)/);
 assert.match(api,/email_confirmed_at/);
});
test("customer onboarding never assumes platform privileges",()=>{
 assert.match(ui,/\/api\/platform\/onboard/);
 assert.doesNotMatch(ui,/super_admin|platform_administrators/);
 assert.match(api,/p_assisted:assisted/);
});
test("subscription activation is platform-authorized and distinct from onboarding",()=>{
 assert.match(subscription,/requirePlatformAdmin/);
 assert.match(subscription,/saas_platform_subscription_manage_v1/);
 assert.match(ui,/standard trial/);
});
test("provisioning SQL includes membership, module, CRM and Tasks linkage",()=>{
 assert.match(sql,/saas\.memberships/i);
 assert.match(sql,/saas\.module_entitlements/i);
 assert.match(sql,/connect\.tenants/i);
 assert.match(sql,/tasks\.workspaces/i);
});
