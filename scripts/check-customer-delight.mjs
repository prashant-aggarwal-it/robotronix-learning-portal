import fs from "node:fs";
const required=[
 "components/experience/ParentDelightHub.tsx",
 "app/parent/page.tsx",
 "lib/types.ts",
 "lib/repository.ts"
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing customer delight file: "+file);
const hub=fs.readFileSync("components/experience/ParentDelightHub.tsx","utf8");
for(const marker of ["LATEST CLASS SUMMARY","WHAT NEEDS YOUR ATTENTION","MILESTONE UNLOCKED","CONTINUITY & RENEWAL","Request Reschedule","GUIDED SUPPORT","Write a Google Review","Refer a Friend","createCommunicationThread","createFamilyIntroduction"]){
 if(!hub.includes(marker))throw new Error("Parent delight hub missing: "+marker);
}
const parent=fs.readFileSync("app/parent/page.tsx","utf8");
if(!parent.includes("ParentDelightHub"))throw new Error("Parent dashboard is not wired to delight hub.");
const env=fs.readFileSync(".env.example","utf8");
if(!env.includes("NEXT_PUBLIC_GOOGLE_REVIEW_URL"))throw new Error("Google review configuration is missing.");
console.log("Customer delight experience structure: OK");
