import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("database/saas/76_phase6a_commercial_branding_tiers.sql");
const api=read("app/api/platform/branding-entitlements/route.ts");
const service=read("lib/server/saas/branding-entitlements.ts");
test("tiers limited to exactly standard, custom and white_label; default is standard",()=>{
 assert.match(sql,/v_level:='standard'/);
 assert.match(sql,/p_level not in \('standard','custom','white_label'\)/);
 assert.match(service,/BRANDING_LEVELS=\["standard","custom","white_label"\] as const/);
 assert.match(sql,/setting_key='branding_tier'/);
});
test("existing Phase 5 saved branding is retained; no extra tenancy tables",()=>{
 assert.doesNotMatch(sql,/drop table|delete from saas\.organization_settings|truncate/i);
 assert.doesNotMatch(sql,/create table/i);
 assert.match(sql,/insert into saas\.organization_settings/);
});
test("tier write is service-only and enforces active platform administrator in database",()=>{
 assert.match(sql,/\(auth\.jwt\(\)->>'role'\) is distinct from 'service_role'/);
 assert.match(sql,/from saas\.platform_administrators where user_id=p_actor and active/);
 assert.match(sql,/revoke all on function public\.saas_branding_tier_set_v1\(uuid,uuid,text\) from public,anon,authenticated/);
 assert.match(service,/requirePlatformAdmin\(authorization\)/);
});
test("owner read checks own active membership and blocks foreign organizations",()=>{
 assert.match(sql,/m\.organization_id=p_org/);
 assert.match(sql,/m\.user_id=p_actor and m\.status='active'/);
 assert.match(sql,/v_status<>'active'/);
 assert.match(service,/verifiedBrandingActor\(authorization\)/);
});
test("changes are transactionally audited with previous and next level",()=>{
 assert.match(sql,/for update/);
 assert.match(sql,/insert into saas\.audit_events/);
 assert.match(sql,/jsonb_build_object\('previous',v_previous,'next',p_level/);
 assert.match(sql,/insert into saas\.platform_admin_audit/);
 assert.match(sql,/if v_changed then/);
});
test("invalid direct setting writes rejected and only privileged services access RPC",()=>{
 assert.match(sql,/create trigger validate_branding_tier_setting_v1/);
 assert.match(sql,/jsonb_typeof\(new\.setting_value\)/);
 assert.match(sql,/grant execute on function public\.saas_branding_tier_read_v1\(uuid,uuid\) to service_role/);
 assert.match(sql,/grant execute on function public\.saas_branding_tier_set_v1\(uuid,uuid,text\) to service_role/);
});
test("API validates JSON, uses no-store and never trusts caller actor id",()=>{
 assert.match(api,/readBrandingEntitlement\(request\.headers\.get\("authorization"\),organizationId\)/);
 assert.match(api,/updateBrandingEntitlement\(request\.headers\.get\("authorization"\),payload\.organizationId,payload\.level\)/);
 assert.match(api,/private, no-store/);
 assert.doesNotMatch(api,/payload\.userId|payload\.actorId/);
});
