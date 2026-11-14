// Phase 3B read-only inventory: no database credentials or writes required.
// Maps actual client-side Supabase table use to exported repository functions.
// Run: node scripts/audit-academy-data-access.mjs
import fs from "node:fs";
const files=["lib/repository.ts","lib/student-finance-repository.ts","lib/communication-repository.ts"];
const entries=[];
for(const path of files){
 const source=fs.readFileSync(path,"utf8");
 const fn=/export\s+(?:async\s+)?function\s+(\w+)/g;
 const functions=[...source.matchAll(fn)].map(m=>({name:m[1],at:m.index}));
 const queries=[...source.matchAll(/\.from\(\s*["'`]([\w]+)["'`]\s*\)/g)];
 for(const match of queries){
  const parent=[...functions].reverse().find(f=>f.at<match.index);
  const line=source.slice(0,match.index).split("\n").length;
  entries.push({path,line,table:match[1],function:parent?.name??"(non-exported / module scope)",classification:"requires_tenant_review"});
 }
}
entries.sort((a,b)=>a.path.localeCompare(b.path)||a.line-b.line);
const byTable=Object.fromEntries([...new Set(entries.map(e=>e.table))].sort().map(table=>[table,entries.filter(e=>e.table===table).length]));
const report={generatedAt:new Date().toISOString(),warning:"Read-only static inventory; authorization must be verified separately.",totalDirectTableCalls:entries.length,byTable,entries};
const out="database/saas/academy-access-inventory.json";
fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log("Academy legacy client queries:",entries.length,"across",Object.keys(byTable).length,"tables. Inventory:",out);
