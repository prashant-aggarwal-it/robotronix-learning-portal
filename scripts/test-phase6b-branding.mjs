import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("only enabled customer tiers or Super Admin can mutate branding",()=>{
 const sql=read("database/saas/77_phase6b_branding_write_entitlement_gate.sql");
 assert.match(sql,/saas_branding_write_access_v2/);
 assert.match(sql,/'"custom"'::jsonb,'"white_label"'::jsonb/);
 assert.match(sql,/perform 1 from saas.organizations where id=p_org for update/);
 assert.match(sql,/if not public.saas_branding_write_access_v2\(p_actor,p_org\)/);
 assert.match(sql,/revoke all on function public.saas_branding_save_v1/);
 assert.doesNotMatch(sql,/delete from saas\.organization_settings|truncate saas\.organization_settings/i);
});
test("logo upload and save enforce database entitlement on every request",()=>{
 const auth=read("lib/server/saas/branding-auth.ts");
 const route=read("app/api/branding-studio/route.ts");
 const upload=read("app/api/branding-studio/upload/route.ts");
 assert.match(auth,/authorizeBrandingWrite/);
 assert.match(auth,/rpc\("saas_branding_write_access_v2"/);
 assert.match(route,/await authorizeBrandingWrite\(/);
 assert.match(upload,/await authorizeBrandingWrite\(/);
 assert.match(route,/canEdit:canEdit===true/);
});
test("phase6a level transitions keep stored configuration and audit history",()=>{
 const api=read("app/api/platform/branding-entitlements/route.ts");
 assert.match(api,/updateBrandingEntitlement/);
 const sql=read("database/saas/76_phase6a_commercial_branding_tiers.sql");
 assert.match(sql,/insert into saas.audit_events/);
 assert.doesNotMatch(sql,/delete from saas.organization_settings/i);
});

test("admin controls are persisted and reload effective level",()=>{
 const ui=read("app/platform-admin/PlatformBrandingEntitlements.tsx");
 assert.match(ui,/Branding level/);
 assert.match(ui,/window.confirm/);
 assert.match(ui,/method:"POST"/);
 assert.match(ui,/Could not verify saved entitlement/);
 assert.match(ui,/existing logo, colors and tagline/i);
 const page=read("app/platform-admin/page.tsx");assert.match(page,/PlatformBrandingEntitlements/);
});
test("branding editor is read-only for non-entitled owners, but retains preview",()=>{
 const ui=read("features/branding/BrandingStudio.tsx");
 assert.match(ui,/setCanEdit\(body.canEdit===true\)/);
 assert.match(ui,/disabled=\{!canEdit\|\|busy\|\|loading\}/);
 assert.match(ui,/Standard branding is active/);
 assert.match(ui,/!canEdit\)return/);
 assert.match(ui,/className="brandingPreview"/);
});
