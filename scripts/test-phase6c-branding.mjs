import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("effective theme resolves commercial tier at authorized API boundary",()=>{
 const api=read("app/api/tenant-branding/route.ts");
 assert.match(api,/saas_branding_tier_read_v1/);
 assert.match(api,/saas_branding_view_v1/);
 assert.match(api,/parseTenantBranding\(\{\.\.\.data,level:tier.level\}\)/);
 assert.match(api,/private, no-store/);
});
test("Standard never renders stored logo, palette or tagline",()=>{
 const runtime=read("lib/theme/tenant-runtime.ts");
 assert.match(runtime,/const eligible=level!=="standard"/);
 assert.match(runtime,/eligible\?logo:""/);
 assert.match(runtime,/eligible&&typeof brand.tagline/);
 assert.match(runtime,/raw=eligible\?/);
 assert.match(runtime,/resolveTenantTheme\(raw\)/);
});
test("tenant changes clear identity before an asynchronous reload",()=>{
 const provider=read("components/TenantBrandingProvider.tsx");
 assert.match(provider,/generation.current\+\+;setSnapshot\(null\);setRevision/);
 assert.match(provider,/corporate\|\|loading\|\|!snapshot/);
 assert.match(provider,/linkedCrmTenant!==activeCrmTenant/);
 assert.match(provider,/linkedTaskWorkspaces.includes\(activeTasksWorkspace\)/);
 const switcher=read("components/SuiteOrganizationSwitcher.tsx");
 assert.match(switcher,/window.dispatchEvent\(new Event\("robotronix:organization-changed"\)\)/);
});
test("control plane retains corporate theme and logo palette detection untouched",()=>{
 const p=read("components/TenantBrandingProvider.tsx");
 assert.match(p,/p.startsWith\("\/platform-admin"\)/);
 assert.match(p,/corporate\|\|loading/);
 const t=read("app/tenant-branding.css");
 assert.match(t,/\.tenantThemeScope/);
});
