import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Platform-wide preview uses a protected independent RPC with three active-first customers",()=>{
 const sql=read("database/saas/101_platform_customer_preview.sql");
 for(const needle of ["saas.platform_administrators","where a.user_id=p_actor_id and a.active","(status='active') desc","created_at desc","limit 3","revoke all on function public.saas_platform_customer_preview_v1","to service_role"])assert.ok(sql.includes(needle),needle);
 const api=read("app/api/platform-admin/customer-preview/route.ts");
 for(const needle of ["requirePlatformAdmin","saas_platform_customer_preview_v1","no-store","Vary"])assert.ok(api.includes(needle),needle);
});

test("Overview uses independent preview rather than current paginated directory records",()=>{
 const page=read("app/platform-admin/page.tsx");
 for(const needle of ['fetch("/api/platform-admin/customer-preview"','customerPreview.map(o=>','Customer preview','openCustomer(o.id,o.display_name)','setSearch(o.display_name)','View customer'])assert.ok(page.includes(needle),needle);
 assert.ok(!page.includes('overview.organizations.slice(0,4)'));
 assert.ok(page.includes('setSearch("");setPage(1);navigate("directory")'));
});

test("Overview section spacing and row actions are accessible",()=>{
 const page=read("app/platform-admin/page.tsx");
 const css=read("app/platform-admin/platform-admin.css");
 assert.ok(page.includes('aria-label="Customer preview"'));
 assert.ok(page.includes('marginBottom:0'));
 assert.ok(css.includes(".platformRecentCustomerAction"));
 assert.ok(css.includes(".platformOverviewBody{gap:12px}"));
 assert.ok(css.includes(".platformRecentCustomer:focus-visible"));
});
