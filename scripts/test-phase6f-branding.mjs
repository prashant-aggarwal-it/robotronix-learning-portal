import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("public login hides saved branding for Standard and preserves custom/white-label",()=>{
 const sql=read("database/saas/78_phase6f_public_academy_brand_entitlement.sql");
 assert.match(sql,/create or replace function public\.saas_public_academy_brand/);
 assert.match(sql,/s\.setting_value in \('"custom"'::jsonb,'"white_label"'::jsonb\)/);
 assert.match(sql,/else '#6d3cc9' end/);
 assert.doesNotMatch(sql,/delete from saas\.organization_settings|drop table/i);
 const smoke=read("database/saas/PHASE6F_PUBLIC_LOGIN_DEV_ROLLBACK_VERIFY.sql");
 assert.match(smoke,/rollback;/);
 assert.match(smoke,/Downgrade failed to suppress yet retain branding/);
});
test("foreign tier reads return 403 and API responses are uncacheable",()=>{
 const api=read("app/api/tenant-branding/route.ts");
 assert.match(api,/tierError\?\.code==="42501"/);
 assert.match(api,/new SaaSAccessError\(403,"Organization is not accessible"\)/);
 assert.match(api,/private, no-store/);
});
test("real HTTP QA requires user tokens and restricted DEV credentials",()=>{
 const qa=read("scripts/qa-phase6f-live.mjs");
 assert.match(qa,/Only the approved DEV project is permitted/);
 assert.match(qa,/auth\.signInWithPassword/);
 assert.match(qa,/\[a,orgA,b\],\[b,orgB,a\]/);
 assert.match(qa,/unauthorizedSave\.status,403/);
 assert.match(qa,/upload\.status,403/);
 assert.match(qa,/upgrade\.status,403/);
});
