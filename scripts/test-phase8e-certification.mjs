import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const privileged=[
 "app/api/platform-admin/overview/route.ts",
 "app/api/platform-admin/operations-summary/route.ts",
 "app/api/platform-admin/administrators/route.ts",
 "app/api/platform-admin/email-health/route.ts",
 "app/api/platform-admin/customer-invitations/route.ts",
 "app/api/platform-admin/manage/route.ts"
];

test("all platform admin API surfaces enforce server-side administrator authorization",()=>{
 for(const file of privileged){
  const s=read(file);
  assert.match(s,/requirePlatformAdmin\(/,file);
  assert.match(s,/Cache-Control.*no-store/,file);
  assert.match(s,/Vary.*Authorization/,file);
 }
});
test("platform admin gate verifies authenticated confirmed users and persisted administrator role",()=>{
 const s=read("lib/server/saas/platform-admin.ts");
 for(const value of ["db.auth.getUser(bearer)","email_confirmed_at","saas_is_platform_admin_v1","allowed!==true"])
  assert.ok(s.includes(value),value);
 assert.ok(!s.includes("user_metadata"));
});
test("email health has bounded, sanitized read-only surface",()=>{
 const s=read("app/api/platform-admin/email-health/route.ts");
 assert.match(s,/\.limit\(501\)/);
 assert.match(s,/organizationId\)q=q\.eq\("organization_id",organizationId\)/);
 assert.match(s,/connectionsTruncated:/);
 assert.ok(!/\.select\([^\n]*(credential_reference|recipient_email|body_text|subject|provider_message_id)/.test(s));
 assert.ok(!s.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"));
});
test("platform roster has privileged limited reads and no credentials",()=>{
 const s=read("app/api/platform-admin/administrators/route.ts");
 assert.match(s,/\.limit\(100\)/);
 assert.match(s,/\.limit\(50\)/);
 assert.match(s,/email_confirmed_at/);
 assert.ok(!s.includes("password_hash"));
});
test("customer invitation lifecycle requires privileged mutations with rotation and revocation",()=>{
 const s=read("app/api/platform-admin/customer-invitations/route.ts");
 for(const token of ['action==="rotate"','p_action:"revoke"','randomBytes(32)','createHash("sha256")','saas_pending_customer_manage_v1'])
  assert.ok(s.includes(token),token);
 assert.ok(!s.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"));
});
test("UI adds confirmation for destructive admin actions",()=>{
 const s=read("app/platform-admin/PlatformCustomerActions.tsx");
 for(const value of ["set_organization_status","revoke_platform_admin","revoke_owner_invitation","window.prompt","confirmation!==target"])assert.ok(s.includes(value),value);
});

test("administrator lookup differentiates fully scanned absence from safety limit",()=>{
 const api=read("app/api/platform-admin/administrators/route.ts");
 const ui=read("app/platform-admin/PlatformAdminSafety.tsx");
 assert.ok(api.includes("emailParam!==null"));
 assert.ok(api.includes("exhausted=true"));
 assert.ok(api.includes("lookupLimited:userId===null&&!exhausted"));
 assert.ok(ui.includes("data.lookupLimited"));
});
