import fs from "node:fs";
const profiles=JSON.parse(fs.readFileSync("config/deployment-profiles.json","utf8")).profiles;
const id=process.argv[2];
const p=profiles.find(x=>x.id===id);
if(!p){console.error("Usage: npm run deployment:profile -- <"+profiles.map(x=>x.id).join("|")+">");process.exit(1);}
const lines=[
 "# Non-secret template for "+p.id+"; configure in a NEW isolated Netlify site.",
 "# Database package: "+p.databasePackage,
 "PRODUCT_MODE="+p.mode,
 "ENABLED_PRODUCTS="+p.products.join(","),
 ...(p.integrations.length?["ENABLED_INTEGRATIONS="+p.integrations.join(",")]:[]),
 "NEXT_PUBLIC_APP_ENV=staging",
 "NEXT_PUBLIC_SITE_URL=https://YOUR-DEPLOYMENT-DOMAIN",
 "NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co",
 "NEXT_PUBLIC_SUPABASE_ANON_KEY=SET_IN_NETLIFY",
 "SUPABASE_URL=https://YOUR-PROJECT.supabase.co",
 "SUPABASE_SERVICE_ROLE_KEY=SET_SERVER_SIDE_ONLY",
 "OPTIONAL_JOB_RUNNER=disabled",
 "TASKS_SCHEDULER_ENABLED=false",
 "CONNECT_SCHEDULER_ENABLED=false",
 "CONNECT_PORTAL_JOBS_ENABLED=false",
 "CONNECT_HISTORY_DRAIN_ENABLED=false"
];
console.log(lines.join("\n"));
