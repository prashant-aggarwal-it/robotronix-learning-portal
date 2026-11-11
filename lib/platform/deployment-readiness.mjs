// Deployment preflight only. Never print configuration values: they may contain secrets.
const urlValue=(value)=>{try{const u=new URL(value);return u.protocol==="https:"&&u.username===""&&u.password===""&&u.search===""&&u.hash===""&&u.pathname==="/"?u.origin:null;}catch{return null;}};
export function checkDeploymentReadiness(env,config,{requireCredentials=true}={}){
 const errors=[];
 const has=(name)=>typeof env[name]==="string"&&env[name].trim().length>0;
 const add=(code)=>errors.push(code);
 if(config.legacyDefault)add("EXPLICIT_PRODUCT_MODE_REQUIRED");
 if(!requireCredentials)return errors;
 for(const name of ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","NEXT_PUBLIC_SITE_URL"]){
  if(!has(name))add("MISSING_"+name);
 }
 const browserOrigin=has("NEXT_PUBLIC_SUPABASE_URL")?urlValue(env.NEXT_PUBLIC_SUPABASE_URL):null;
 const serverOrigin=has("SUPABASE_URL")?urlValue(env.SUPABASE_URL):null;
 const siteOrigin=has("NEXT_PUBLIC_SITE_URL")?urlValue(env.NEXT_PUBLIC_SITE_URL):null;
 if(has("NEXT_PUBLIC_SUPABASE_URL")&&!browserOrigin)add("INVALID_PUBLIC_SUPABASE_URL");
 if(has("SUPABASE_URL")&&!serverOrigin)add("INVALID_SERVER_SUPABASE_URL");
 if(browserOrigin&&serverOrigin&&browserOrigin!==serverOrigin)add("SUPABASE_PROJECT_MISMATCH");
 if(has("NEXT_PUBLIC_SITE_URL")&&!siteOrigin)add("INVALID_SITE_URL");
 if(has("NEXT_PUBLIC_SUPABASE_ANON_KEY")&&has("SUPABASE_SERVICE_ROLE_KEY")&&env.NEXT_PUBLIC_SUPABASE_ANON_KEY===env.SUPABASE_SERVICE_ROLE_KEY)add("PUBLIC_AND_SERVICE_KEYS_MATCH");
 if(Object.keys(env).some(k=>/^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PRIVATE_KEY)/.test(k)&&has(k)))add("SECRET_IN_PUBLIC_ENV");
 if(has("NEXT_PUBLIC_APP_ENV")&&!new Set(["local","development","preview","staging","production","demo"]).has(env.NEXT_PUBLIC_APP_ENV))add("INVALID_APP_ENV");
 if(env.OPTIONAL_JOB_RUNNER!==undefined&&!new Set(["netlify","pg_cron","disabled"]).has(env.OPTIONAL_JOB_RUNNER))add("INVALID_JOB_RUNNER");
 const enabledJobs=["TASKS_SCHEDULER_ENABLED","CONNECT_SCHEDULER_ENABLED","CONNECT_PORTAL_JOBS_ENABLED"].filter(key=>env[key]==="true");
 if(enabledJobs.length&&env.OPTIONAL_JOB_RUNNER!=="netlify")add("OPTIONAL_JOBS_REQUIRE_NETLIFY_OWNER");
 if(env.TASKS_SCHEDULER_ENABLED==="true"&&!config.products.includes("tasks"))add("TASKS_WORKER_WITHOUT_TASKS");
 if(env.CONNECT_SCHEDULER_ENABLED==="true"&&!config.products.includes("crm"))add("CRM_WORKER_WITHOUT_CRM");
 if(env.CONNECT_PORTAL_JOBS_ENABLED==="true"&&!config.integrations.includes("crmPortal"))add("CRM_PORTAL_WORKER_WITHOUT_INTEGRATION");
 if(env.CONNECT_HISTORY_DRAIN_ENABLED==="true"&&!config.products.includes("crm"))add("HISTORY_WORKER_WITHOUT_CRM");
 if(env.CONNECT_HISTORY_DRAIN_ENABLED==="true"&&!has("CONNECT_HISTORY_JOB_SECRET"))add("HISTORY_WORKER_SECRET_MISSING");
 if(enabledJobs.length&&!has("SUPABASE_SERVICE_ROLE_KEY"))add("WORKER_SERVICE_KEY_MISSING");
 if(env.NEXT_PUBLIC_SITE_URL?.includes("localhost")&&env.NEXT_PUBLIC_APP_ENV==="production")add("PRODUCTION_LOCALHOST_SITE");
 // Integration calls use one Supabase Auth/project client. Cross-project
 // installations require an explicit identity/API gateway architecture.
 return [...new Set(errors)];
}
