import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const helper=read("app/platform-admin/formatPlatformLabel.ts");
const parts=["PlatformEmailHealth","PlatformServiceHealth","PlatformWorkerHealth","PlatformIncidents","PlatformCustomerHealth","PlatformSystemHealth","PlatformSecurity","PlatformSubscriptions","PlatformCustomerActions","PlatformBrandingEntitlements","page"];
test("System-status formatter converts snake/kebab case to readable display labels",()=>{
 for(const part of ['replaceAll("_"," ")','replaceAll("-"," ")','toUpperCase()']) assert.ok(helper.includes(part),part);
 assert.match(helper,/if\(!value\)return "Unknown"/);
});
test("All status-facing Super Admin screens share presentation-only formatter",()=>{
 for(const part of parts){
  const src=read("app/platform-admin/"+part+(part==="page"?".tsx":".tsx"));
  assert.match(src,/import \{formatPlatformLabel\} from "\.\/formatPlatformLabel";/,part);
  assert.match(src,/formatPlatformLabel\(/,part);
 }
});
test("Email queue counts and service status are capitalized for humans, not API calls",()=>{
 const email=read("app/platform-admin/PlatformEmailHealth.tsx");
 const service=read("app/platform-admin/PlatformServiceHealth.tsx");
 assert.match(email,/status==="sent"\?"Provider Accepted":formatPlatformLabel\(status\)/);
 assert.match(service,/Status: \{formatPlatformLabel\(c.status\)\}/);
 assert.match(service,/formatPlatformLabel\(health.overall\)/);
 const incidents=read("app/platform-admin/PlatformIncidents.tsx");
 assert.match(incidents,/formatPlatformLabel\(i.severity\)/);
 assert.match(incidents,/formatPlatformLabel\(i.status\)/);
 assert.match(incidents,/value=\{x\}>\{formatPlatformLabel\(x\)\}/);
 const worker=read("app/platform-admin/PlatformWorkerHealth.tsx");
 assert.match(worker,/formatPlatformLabel\(data.heartbeat.last_status\)/);
});
test("Backend enum comparisons and API payload keys remain unchanged",()=>{
 const incidents=read("app/platform-admin/PlatformIncidents.tsx");
 const email=read("app/platform-admin/PlatformEmailHealth.tsx");
 assert.match(incidents,/i.status!=="resolved"/);
 assert.match(incidents,/value=\{x\}/);
 assert.match(email,/data.jobs\[status\]/);
});
