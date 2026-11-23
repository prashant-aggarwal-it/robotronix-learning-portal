import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("overview SQL preserves platform-admin authorization and counts only unexpired trials",()=>{
 const sql=read("database/saas/100_overview_active_trials.sql");
 assert.match(sql,/status='trial' and ends_at>now\(\)/);
 assert.match(sql,/saas\.platform_administrators/);
 assert.match(sql,/revoke all on function public\.saas_platform_overview_v1/);
 assert.match(sql,/grant execute on function public\.saas_platform_overview_v1.*to service_role/);
});
test("pending activations become actionable follow-ups with known academy names",()=>{
 const api=read("app/api/platform-admin/operations-summary/route.ts");
 assert.match(api,/pending\.map\(i=>\(\{type:"owner_activation_pending"/);
 assert.match(api,/organizationName:i\.organization_name/);
 assert.match(api,/invitationId:i\.id/);
 const ui=read("app/platform-admin/page.tsx");
 assert.match(ui,/kind==="owner_activation_pending"/);
 assert.match(ui,/Review invitation/);
 assert.match(ui,/Owner activation pending/);
 assert.match(ui,/navigate\("onboarding"\)/);
});
test("overview labels unexpired trials and avoids repetitive expired labels",()=>{
 const ui=read("app/platform-admin/page.tsx");
 assert.match(ui,/label:"Active trials",value:overview\.metrics\.trials/);
 assert.match(ui,/Trial expired on /);
 assert.doesNotMatch(ui,/Trial expired".*?"Trial ended"/);
});
