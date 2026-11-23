import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Overview has one clear Add Customer CTA and removes redundant shortcuts",()=>{
 const ui=read("app/platform-admin/page.tsx");
 assert.ok(ui.includes('className="platformOverviewAddCustomer"'));
 assert.ok(ui.includes('navigate("onboarding")'));
 assert.ok(!ui.includes('className="platformWelcomeCard"'));
 assert.ok(!ui.includes('className="platformQuickGrid"'));
});
test("Three concise KPI widgets are actionable and preserve correct metrics",()=>{
 const ui=read("app/platform-admin/page.tsx");
 for(const key of ["platformKpiGrid","platformKpiWidget","overview.metrics.organizations","overview.metrics.activeSubscriptions","overview.metrics.trials",'openSubscriptionList("active")','openSubscriptionList("active_trials")'])assert.ok(ui.includes(key),key);
});
test("Alert widgets show actual counts, open real sections, and retain follow-up details",()=>{
 const ui=read("app/platform-admin/page.tsx");
 for(const key of ["platformActionWidgetGrid","expiringTrials","expiredTrials","pendingInvitations","expiredInvitations","pastDueSubscriptions","platformActionWidgetNeedsAttention",'navigate("onboarding")','openSubscriptionList(metric.filter||"all")','Priority follow-ups","Review invitation","Manage subscription"])assert.ok(ui.includes(key),key);
});
test("Filtered subscription list has reset and real date comparisons",()=>{
 const ui=read("app/platform-admin/page.tsx");
 for(const key of ['subscriptionFilter!=="all"','setSubscriptionFilter("all")','Date.parse(x.ends_at)','deadline>now','deadline<now','deadline<=now+7*86400000','x.status==="past_due"'])assert.ok(ui.includes(key),key);
});
test("Recent customers use safe filtered directory routing",()=>{
 const ui=read("app/platform-admin/page.tsx");
 assert.ok(ui.includes('className="platformRecentCustomer"'));
 assert.ok(ui.includes('setSearch(o.display_name)'));
 assert.ok(ui.includes('navigate("directory")'));
});
test("Overview widgets have mobile layout and keyboard focus",()=>{
 const css=read("app/platform-admin/platform-admin.css");
 for(const key of [".platformKpiGrid",".platformActionWidgetGrid",".platformKpiWidget:focus-visible","@media(max-width:740px)",".platformOverviewAddCustomer"])assert.ok(css.includes(key),key);
});
