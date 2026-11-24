import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Customer directory is the primary workspace and technical identifiers are optional",()=>{
 const ui=read("app/platform-admin/page.tsx");
 for(const token of ['<span>Customers</span>','id="directory"','className="platformCustomerDetail"','platformTechnicalDetails','<summary>Technical details</summary>','View customer','openCustomerManagement("customers",org.id)','openCustomerManagement("subscriptions",org.id)','openCustomerManagement("branding",org.id)'])assert.ok(ui.includes(token),token);
 assert.ok(!ui.includes('<th>Workspace slug</th>'));
 assert.ok(!ui.includes('<small>{o.slug}</small>'));
});
test("Existing route IDs remain supported for deep linking and legacy navigation",()=>{
 const ui=read("app/platform-admin/page.tsx");
 for(const hash of ['"overview"','"customers"','"subscriptions"','"branding"','"onboarding"','"directory"','"system-health"'])assert.ok(ui.includes(hash),hash);
});
test("Customer management does not grant platform wide access",()=>{
 const ui=read("app/platform-admin/PlatformCustomerActions.tsx");
 assert.ok(!ui.includes("Verified user UUID"));
 assert.ok(!ui.includes('call("grant_platform_admin"'));
 assert.ok(!ui.includes('call("revoke_platform_admin"'));
 assert.ok(ui.includes('invitationId:inv.id'));
 assert.ok(ui.includes('initialOrganizationId'));
});
test("Platform administrators are managed by server verified email",()=>{
 const ui=read("app/platform-admin/PlatformAdminSafety.tsx");
 const api=read("app/api/platform-admin/administrators/route.ts");
 assert.ok(ui.includes('changeAdmin("grant_platform_admin")'));
 assert.ok(ui.includes('changeAdmin("revoke_platform_admin")'));
 assert.ok(ui.includes('verifiedId'));
 assert.ok(ui.includes('window.prompt('));
 assert.ok(api.includes('email_confirmed_at'));
 assert.ok(api.includes('requirePlatformAdmin('));
});
test("Branding studio and entitlement manage exactly the selected customer",()=>{
 const hub=read("app/platform-admin/page.tsx");
 const wrapper=read("app/platform-admin/PlatformTenantBranding.tsx");
 const studio=read("features/branding/BrandingStudio.tsx");
 const ent=read("app/platform-admin/PlatformBrandingEntitlements.tsx");
 assert.ok(hub.includes('initialOrganizationId={selectedCustomerId}'));
 assert.ok(wrapper.includes('initialOrganizationId={initialOrganizationId}'));
 assert.ok(studio.includes('initialOrganizationId&&organizations.some'));
 assert.ok(ent.includes('setOrgId(initialOrganizationId)'));
 assert.ok(!ent.includes("scheduled for Phase 6D"));
});
test("Onboarding clearly distinguishes delivery attempts and does not expose slugs in invitation lists",()=>{
 const page=read("app/platform-admin/page.tsx");
 assert.ok(page.includes("Create customer & attempt activation email"));
 assert.ok(page.includes("Customer activation invitations"));
 assert.ok(page.includes("<details className=\"platformOnboardingAdvanced\">"));
 assert.ok(!page.includes('<small style={{display:"block"}}>{inv.organization_slug}</small>'));
});
test("Subscription management uses server compatible plan validation and preserves success feedback",()=>{
 const ui=read("app/platform-admin/PlatformSubscriptions.tsx");
 const api=read("app/api/platform-admin/subscriptions/route.ts");
 assert.ok(ui.includes('refresh(organizationId,false)'));
 assert.ok(ui.includes("Paid plan identifier"));
 assert.ok(ui.includes("Activate paid plan (manual)"));
 assert.ok(api.includes("requirePlatformAdmin("));
 assert.ok(api.includes("saas_platform_subscription_manage_v1"));
});
test("Layout and action hierarchy are consistent and responsive",()=>{
 const css=read("app/platform-admin/platform-admin.css");
 for(const s of [".platformFollowupAction{width:194px", ".platformCustomerActions{display:flex", ".platformOnboardingFields{display:grid", "@media(max-width:850px)", ".platformTechnicalDetails"])assert.ok(css.includes(s),s);
});
