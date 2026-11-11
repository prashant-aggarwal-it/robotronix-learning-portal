import test from "node:test";
import assert from "node:assert/strict";
import {resolveDeploymentConfig} from "./deployment.ts";
import {checkDeploymentReadiness} from "./deployment-readiness.mjs";
const base={PRODUCT_MODE:"combined",ENABLED_PRODUCTS:"crm,tasks",ENABLED_INTEGRATIONS:"crmTasks",
 NEXT_PUBLIC_SUPABASE_URL:"https://project.supabase.co",SUPABASE_URL:"https://project.supabase.co",
 NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-key",SUPABASE_SERVICE_ROLE_KEY:"server-key",
 NEXT_PUBLIC_SITE_URL:"https://tasks.example.com",NEXT_PUBLIC_APP_ENV:"staging"};
const inspect=patch=>{const env={...base,...patch};return checkDeploymentReadiness(env,resolveDeploymentConfig(env));};
test("valid standalone and combined credentials use one project",()=>{
 assert.deepEqual(inspect({}),[]);
 assert.deepEqual(inspect({PRODUCT_MODE:"tasks",ENABLED_PRODUCTS:"tasks",ENABLED_INTEGRATIONS:undefined}),[]);
});
test("explicit mode required for new customer deployment",()=>{
 assert.ok(checkDeploymentReadiness(base,resolveDeploymentConfig({})).includes("EXPLICIT_PRODUCT_MODE_REQUIRED"));
});
test("fail closed for missing credentials and cross-project Auth",()=>{
 assert.ok(inspect({SUPABASE_SERVICE_ROLE_KEY:undefined}).includes("MISSING_SUPABASE_SERVICE_ROLE_KEY"));
 assert.ok(inspect({SUPABASE_URL:"https://another.supabase.co"}).includes("SUPABASE_PROJECT_MISMATCH"));
 assert.ok(inspect({NEXT_PUBLIC_SUPABASE_URL:"http://project.supabase.co"}).includes("INVALID_PUBLIC_SUPABASE_URL"));
 assert.ok(inspect({NEXT_PUBLIC_SUPABASE_ANON_KEY:"server-key"}).includes("PUBLIC_AND_SERVICE_KEYS_MATCH"));
 assert.ok(inspect({NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:"leak"}).includes("SECRET_IN_PUBLIC_ENV"));
});
test("enablement forbids overlapping or missing worker ownership",()=>{
 assert.ok(inspect({CONNECT_SCHEDULER_ENABLED:"true"}).includes("OPTIONAL_JOBS_REQUIRE_NETLIFY_OWNER"));
 assert.deepEqual(inspect({CONNECT_SCHEDULER_ENABLED:"true",OPTIONAL_JOB_RUNNER:"netlify"}),[]);
 assert.ok(inspect({CONNECT_PORTAL_JOBS_ENABLED:"true",OPTIONAL_JOB_RUNNER:"netlify"}).includes("CRM_PORTAL_WORKER_WITHOUT_INTEGRATION"));
 assert.ok(inspect({CONNECT_HISTORY_DRAIN_ENABLED:"true"}).includes("HISTORY_WORKER_SECRET_MISSING"));
});
test("reject invalid site and unsafe production localhost",()=>{
 assert.ok(inspect({NEXT_PUBLIC_SITE_URL:"http://localhost:3000"}).includes("INVALID_SITE_URL"));
 assert.ok(inspect({NEXT_PUBLIC_SITE_URL:"http://localhost:3000",NEXT_PUBLIC_APP_ENV:"production"}).includes("PRODUCTION_LOCALHOST_SITE"));
});
