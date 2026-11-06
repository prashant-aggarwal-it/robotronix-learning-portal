import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
 "app/connect/page.tsx","app/connect/layout.tsx","app/connect/connect.css",
 "features/connect/api/client.ts","features/connect/model.ts","features/connect/types/enquiries.ts","features/connect/EmptyStates.tsx",
 "features/connect/ConnectSidebar.tsx","features/connect/ConnectTopbar.tsx","features/connect/ConnectBrand.tsx",
 "features/connect/ConnectAuthGates.tsx",
 "features/connect/components/contact/ContactProfile.tsx",
 "features/connect/components/contact/ContactTimeline.tsx",
 "app/api/connect/workspaces/[tenantId]/contacts/[personId]/timeline/route.ts",
 "features/connect/components/ChannelSettings.tsx",
 "features/connect/components/ConnectAutomationSettings.tsx",
 "features/connect/components/ConnectCommunications.tsx",
 "features/connect/components/ConnectReports.tsx",
 "features/connect/components/EnquirySettings.tsx",
 "components/ApplicationSwitcher.tsx"
];
for(const file of required){if(!fs.existsSync(path.join(root,file)))throw Error("Missing Connect module: "+file);}
if(fs.existsSync(path.join(root,"components/connect")))throw Error("Old Connect components folder must not coexist with consolidated feature module.");

const inspect=[
 "app/connect/page.tsx","features/connect/model.ts","features/connect/types/enquiries.ts","components/AppShell.tsx","components/ApplicationSwitcher.tsx",
 ...required.filter(f=>f.startsWith("features/connect/")&&f.endsWith(".tsx"))
];
for(const file of inspect){
 const source=fs.readFileSync(path.join(root,file),"utf8");
 if(source.includes("@/components/connect/"))throw Error("Stale Connect component import in "+file);
 for(const match of source.matchAll(/from\s+["'](@\/[^"']+)["']/g)){
  const name=match[1].slice(2);
  const candidates=[name+".ts",name+".tsx",name+".js",name+".jsx",name+"/index.ts",name+"/index.tsx"];
  if(!candidates.some(candidate=>fs.existsSync(path.join(root,candidate))))throw Error("Missing local import "+match[1]+" from "+file);
 }
}
const page=fs.readFileSync(path.join(root,"app/connect/page.tsx"),"utf8");
if(!page.includes("<ConnectSidebar")||!page.includes("<ConnectTopbar")||!page.includes("<ConnectSignInGate")||!page.includes("<ConnectNoWorkspaceGate"))throw Error("Connect page is missing an extracted shell component.");
if(fs.existsSync(path.join(root,"lib/connect-client.ts")))throw Error("Redundant legacy Connect API shim has been reintroduced.");
console.log("Connect code organization and local import paths OK.");

const portal=fs.readFileSync(path.join(root,"components/AppShell.tsx"),"utf8");
const sidebar=fs.readFileSync(path.join(root,"features/connect/ConnectSidebar.tsx"),"utf8");
if(!portal.includes('<ApplicationSwitcher current="portal"')||!sidebar.includes('<ApplicationSwitcher current="connect"'))throw Error("Both products must use the shared app switcher.");

const brand=fs.readFileSync(path.join(root,"features/connect/ConnectBrand.tsx"),"utf8");
if(!brand.includes('/brand/robotronix-horizontal.png'))throw Error("Connect brand must reuse the existing Portal logo.");
if(!sidebar.includes("/brand/robotronix-horizontal.png")||!fs.readFileSync(path.join(root,"features/connect/ConnectAuthGates.tsx"),"utf8").includes("<ConnectBrand"))throw Error("Connect entry and sidebar must use the Portal logo.");

if(page.includes("ConnectWorkspaceSetupGate")||page.includes("createWorkspace("))throw Error("Self-service workspace creation must not be shown in Connect UI.");
if(!sidebar.includes("workspaces.length>1"))throw Error("Workspace selector must be hidden for single-organization users.");

const contact=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactProfile.tsx"),"utf8");
if(!page.includes("<ContactProfile")||!contact.includes('role="tablist"')||!contact.includes("Contact follow-ups")||!contact.includes("Related appointments"))throw Error("Contact 360 profile must contain its navigation and linked records.");
if(!page.includes("onSubmit={saveTask}")||!page.includes("onSubmit={saveAppointment}")||!page.includes("onSubmit={saveNote}")||!page.includes("onSubmit={startAdmission}"))throw Error("Contact 360 must retain its existing action forms.");

const timeline=fs.readFileSync(path.join(root,"features/connect/components/contact/ContactTimeline.tsx"),"utf8");
const timelineApi=fs.readFileSync(path.join(root,"app/api/connect/workspaces/[tenantId]/contacts/[personId]/timeline/route.ts"),"utf8");
const migration=fs.readFileSync(path.join(root,"database/connect/saas/24_contact_360_timeline_PENDING.sql"),"utf8");
if(!page.includes("<ContactTimeline")||!timeline.includes("Load older activity")||!timeline.includes("generation.current"))throw Error("Unified Contact 360 timeline or stale response handling missing.");
if(!timelineApi.includes("connect_contact_timeline")||!timelineApi.includes("isConnectSession")||!migration.includes("m.tenant_id=p_tenant_id")||!migration.includes("c.person_id=p_person_id"))throw Error("Tenant-authorized contact timeline query missing.");
if(!migration.includes("revoke all on function public.connect_contact_timeline"))throw Error("Contact timeline RPC must not be callable by public roles.");
