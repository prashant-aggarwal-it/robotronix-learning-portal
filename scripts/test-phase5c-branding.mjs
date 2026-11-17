import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {test} from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("member brand read remains service-only and scoped to active membership",()=>{
 const sql=read("database/saas/74_phase5c_branding_view.sql");
 assert.match(sql,/auth\.jwt\(\)/);
 assert.match(sql,/m\.organization_id=p_org and m\.user_id=p_actor and m\.status='active'/);
 assert.match(sql,/revoke all on function public\.saas_branding_view_v1\(uuid,uuid\) from public,anon,authenticated/);
});
test("branding route checks bearer identity and never caches private identities",()=>{
 const route=read("app/api/tenant-branding/route.ts");
 assert.match(route,/verifiedBrandingActor/);
 assert.match(route,/saas_branding_view_v1/);
 assert.match(route,/private, no-store/);
});
test("theme scope is tenant-local and corporate route is exempt",()=>{
 const provider=read("components/TenantBrandingProvider.tsx");
 assert.match(provider,/tenantThemeScope/);
 assert.match(provider,/corporatePath\(path\)/);
 assert.match(provider,/\/platform-admin/);
 assert.match(provider,/generation\.current/);
 assert.match(provider,/robotronix:branding-saved/);
 assert.doesNotMatch(provider,/document\.documentElement\.style/);
});
test("Academy identity and Suite Home both use shared runtime",()=>{
 assert.match(read("components/AppShell.tsx"),/TenantIdentity/);
 assert.match(read("app/suite/page.tsx"),/useTenantBranding/);
 assert.match(read("features/branding/BrandingStudio.tsx"),/robotronix:branding-saved/);
});

test("CRM theme fails closed for mismatched mapped workspace",()=>{
 const provider=read("components/TenantBrandingProvider.tsx");
 const page=read("app/connect/page.tsx");
 assert.match(provider,/\/api\/platform\/organization-links/);
 assert.match(provider,/linkedCrmTenant!==activeCrmTenant/);
 assert.match(provider,/access\.modules\?\.crm!==true/);
 assert.match(page,/robotronix:crm-tenant-selected/);
});
test("unscoped Tasks stays corporate; scoped Tasks matches trusted workspace",()=>{
 const provider=read("components/TenantBrandingProvider.tsx");
 const page=read("features/tasks/v2/TasksV2Connected.tsx");
 const teams=read("features/tasks/TaskCollaboration.tsx");
 assert.match(provider,/linkedTaskWorkspaces\\.includes\\(activeTasksWorkspace\\)/);
 assert.match(provider,/access\\.modules\\?\\.tasks!==true/);
 assert.match(page,/robotronix:tasks-workspace-selected/);
 assert.match(page,/distinct\\.filter\\(t=>t\\.workspace_id===verified\\.id\\)/);
 assert.match(teams,/scopeWorkspaceId/);
});

test("Suite Home switches without retaining stale module context",()=>{
 const switcher=read("components/SuiteOrganizationSwitcher.tsx");
 const suite=read("app/suite/page.tsx");
 const provider=read("components/TenantBrandingProvider.tsx");
 assert.match(switcher,/if\(pathname==="\/suite"\)/);
 assert.match(switcher,/robotronix:organization-changed/);
 assert.match(switcher,/window\.location\.reload\(\)/);
 assert.match(suite,/\[orgRevision\]/);
 assert.match(provider,/snapshot\.context!==currentContext/);
});

test("tenant identity hides corporate logo while active organization branding resolves",()=>{
 const identity=read("components/TenantIdentity.tsx");
 const css=read("app/tenant-branding.css");
 assert.match(identity,/if\(loading\)return/);
 assert.match(css,/tenantIdentityLoading/);
 assert.match(css,/cx-nav-item\.active/);
 assert.match(css,/suiteHomeCard:focus-visible/);
});
