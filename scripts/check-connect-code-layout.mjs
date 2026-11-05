import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const required=[
 "app/connect/page.tsx","app/connect/layout.tsx","app/connect/connect.css",
 "features/connect/api/client.ts","features/connect/model.ts","features/connect/types/enquiries.ts","features/connect/EmptyStates.tsx",
 "features/connect/ConnectSidebar.tsx","features/connect/ConnectTopbar.tsx",
 "features/connect/ConnectAuthGates.tsx",
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
if(!page.includes("<ConnectSidebar")||!page.includes("<ConnectTopbar")||!page.includes("<ConnectSignInGate"))throw Error("Connect page is missing an extracted shell component.");
if(fs.existsSync(path.join(root,"lib/connect-client.ts")))throw Error("Redundant legacy Connect API shim has been reintroduced.");
console.log("Connect code organization and local import paths OK.");

const portal=fs.readFileSync(path.join(root,"components/AppShell.tsx"),"utf8");
const sidebar=fs.readFileSync(path.join(root,"features/connect/ConnectSidebar.tsx"),"utf8");
if(!portal.includes('<ApplicationSwitcher current="portal"')||!sidebar.includes('<ApplicationSwitcher current="connect"'))throw Error("Both products must use the shared app switcher.");
