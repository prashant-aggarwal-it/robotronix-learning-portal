import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/platform-admin/page.tsx");
const customer=read("app/platform-admin/PlatformCustomerActions.tsx");
const security=read("app/platform-admin/PlatformSecurity.tsx");
const entitlements=read("app/platform-admin/PlatformBrandingEntitlements.tsx");
const studio=read("features/branding/BrandingStudio.tsx");
test("Customer directory is the primary management hub without raw IDs or slug columns",()=>{
 assert.doesNotMatch(page,/<dt>Organization ID<\/dt>|<th>Workspace slug<\/th>/);
 assert.match(page,/Manage customer & access/);
 assert.match(page,/Manage subscription/);
 assert.match(page,/Manage branding/);
});
test("Security administration is separate and uses verified email lookup",()=>{
 assert.match(page,/Security & admins/);
 assert.match(page,/<PlatformSecurity\/>/);
 assert.doesNotMatch(customer,/Verified user UUID|grant_platform_admin|revoke_platform_admin/);
 assert.match(security,/administrators\?email=/);
 assert.match(security,/verifiedUserId/);
 assert.match(security,/revoke_platform_admin/);
});
test("Customer selection survives navigation to both branding editors",()=>{
 assert.match(page,/PlatformBrandingEntitlements key=\{selectedCustomerId/);
 assert.match(page,/PlatformTenantBranding initialOrganizationId=\{selectedCustomerId\}/);
 assert.match(entitlements,/initialOrganizationId/);
 assert.match(studio,/initialOrganizationId/);
 assert.doesNotMatch(studio,/\{o.display_name\} \(\{o.slug\}\)/);
});
test("Existing backend actions and invitation API remain wired",()=>{
 for(const action of ["set_organization_status","rename_organization","invite_owner","revoke_owner_invitation"])assert.ok(customer.includes(action));
 assert.match(page,/PlatformSubscriptions/);
 assert.match(page,/PlatformSystemHealth/);
});