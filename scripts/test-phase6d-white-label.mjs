import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("only verified white-label omits optional vendor attribution",()=>{
 const runtime=read("lib/theme/tenant-runtime.ts");
 assert.match(runtime,/showVendorAttribution\(level:BrandingLevel\|null\|undefined\)/);
 assert.match(runtime,/level!=="white_label"/);
 const ui=read("components/TenantVendorAttribution.tsx");
 assert.match(ui,/showVendorAttribution\(branding\?\.level\)/);
 assert.match(ui,/loading\|\|!/);
});
test("all supported application shells use centralized attribution",()=>{
 for(const p of ["components/AppShell.tsx","app/suite/page.tsx","features/connect/ConnectSidebar.tsx","features/tasks/v2/TasksV2Connected.tsx"])
  assert.match(read(p),/TenantVendorAttribution/);
});
test("control plane retains vendor and unrelated Tasks remain corporate",()=>{
 const admin=read("app/platform-admin/page.tsx");
 const provider=read("components/TenantBrandingProvider.tsx");
 assert.match(admin,/robotronix-horizontal\.png/);
 assert.match(provider,/p.startsWith\("\/platform-admin"\)/);
 assert.match(provider,/p.startsWith\("\/tasks"\)&&!p.startsWith\("\/tasks\/connected"\)/);
 assert.match(provider,/linkedCrmTenant!==activeCrmTenant/);
 assert.match(provider,/linkedTaskWorkspaces.includes\(activeTasksWorkspace\)/);
});
test("entitlement is obtained from member-authorized backend, not browser flag",()=>{
 const route=read("app/api/tenant-branding/route.ts");
 assert.match(route,/saas_branding_tier_read_v1/);
 assert.match(route,/saas_branding_view_v1/);
 assert.match(route,/verifiedBrandingActor/);
 const runtime=read("lib/theme/tenant-runtime.ts");
 assert.match(runtime,/payload.level==="custom"\|\|payload.level==="white_label"/);
});
