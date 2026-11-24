import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("app/platform-admin/page.tsx");
const security=read("app/platform-admin/PlatformSecurity.tsx");
const css=read("app/platform-admin/platform-admin.css");
const admins=read("app/api/platform-admin/administrators/route.ts");
const health=read("app/platform-admin/PlatformSystemHealth.tsx");
test("New customer uses a responsive two-column setup and separate invitation table",()=>{
 for(const expected of ["platformOnboardingWorkspace","platformOnboardingGrid","platformOnboardingAside","platformOnboardingPreview","platformOnboardingFormGrid","platformOnboardingActionRow","platformInvitationsPanel","platformInvitationsTable"]){
  assert.ok(page.includes(expected),expected);
 }
 assert.match(css,/\.platformOnboardingGrid\{display:grid;grid-template-columns/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(page,/Create customer & send invitation/);
});
test("Live preview uses the same submitted owner, workspace and trial modules",()=>{
 for(const field of ["assisted.name","assisted.ownerEmail","assisted.slug","assisted.kind","assisted.modules"]){
  assert.ok(page.includes(field),field);
 }
 assert.match(page,/onSubmit=\{e=>\{e.preventDefault\(\);void createAssisted\(\)\}\}/);
 assert.match(page,/void rotatePending\(inv.id\)/);
 assert.match(page,/void revokePending\(inv.id\)/);
});
test("Admin security has a genuine loaded list, audit, and guarded contextual revoke",()=>{
 assert.match(security,/\/api\/platform-admin\/administrators/);
 assert.match(security,/administrators\.map/);
 assert.match(security,/audit\.slice/);
 assert.match(security,/activeAdmins\.length<=1/);
 assert.match(security,/changeAccess\("revoke_platform_admin",a\)/);
 assert.match(security,/window\.prompt/);
 assert.match(security,/verifiedUserId/);
 assert.match(admins,/db\.auth\.admin\.getUserById/);
 assert.match(admins,/requirePlatformAdmin/);
 assert.doesNotMatch(security,/Verified user UUID|<code>\{a\.user_id\}<\/code>/);
});
test("Avoid duplicated access administration and show section-specific subtitles",()=>{
 assert.doesNotMatch(health,/<PlatformAdminSafety\/>/);
 assert.match(health,/Open administrator security/);
 assert.match(page,/Create a customer workspace, assign trial modules and invite the owner/);
 assert.match(page,/Control privileged administrator access and review security activity/);
 assert.match(page,/PLATFORM SETTINGS/);
});
