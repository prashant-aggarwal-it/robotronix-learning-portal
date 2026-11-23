import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Overview follow-up routes to specific customer and subscriptions list has a separate detail view",()=>{
 const page=read("app/platform-admin/page.tsx");
 for(const token of [
  "setSelectedCustomerId(organizationId)",
  'navigate("subscriptions")',
  "selectedCustomerId?<>",
  "Back to all subscriptions",
  "setSelectedCustomerId(\"\")",
  'initialOrganizationId={selectedCustomerId}',
  'key={selectedCustomerId}',
  'onClick={()=>{setSelectedCustomerId(x.organization_id);'
 ])assert.ok(page.includes(token),token);
 assert.ok(!page.includes('getElementById("subscription-management")'));
});
test("Customer subscription form auto-loads and does not allow accidental switching when preselected",()=>{
 const form=read("app/platform-admin/PlatformSubscriptions.tsx");
 for(const token of ["useEffect","if(initialOrganizationId)void refresh(initialOrganizationId)","initialOrganizationId?<p>","Loading selected customer subscription","Refresh subscription"])assert.ok(form.includes(token),token);
 assert.ok(form.includes('organizationId="+encodeURIComponent(id)'));
});
test("Subscription list distinguishes expired trial and humanizes plan labels without changing stored codes",()=>{
 const page=read("app/platform-admin/page.tsx");
 assert.ok(page.includes('expiredTrial?"Expired trial"'));
 assert.ok(page.includes('x.plan_code.replaceAll("_"," ")'));
 assert.ok(page.includes('x.status.replaceAll("_"," ")'));
 assert.ok(page.includes('toLocaleDateString("en-GB")'));
});
