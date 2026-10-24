// Production E2E is read-only and must be an explicit, named opt-in.
// This is NOT the mutable qa:prod-gate / qa:prod-sanity suite.
const exact="https://portal.robotronixstemlab.com";
const target=(process.env.QA_BASE_URL||"").replace(/\/$/,"");
if(process.env.QA_TARGET!=="production"||process.env.PRODUCTION_READONLY_QA_ACK!=="READ_ONLY_ONLY")
 throw new Error("Production read-only QA requires explicit target and acknowledgement.");
if(target!==exact||process.env.QA_NO_WEBSERVER!=="1")
 throw new Error("Unexpected production host or attempted local server startup.");
if(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SANITY_SUPABASE_SERVICE_ROLE_KEY)
 throw new Error("Never pass service-role credentials to the read-only production runner.");
if(process.env.QA_RUN_AUTH==="1"){
 const names=["SANITY_SUPABASE_URL","SANITY_SUPABASE_ANON_KEY",...["ADMIN","TRAINER","PARENT","STUDENT"].flatMap(role=>[`SANITY_${role}_EMAIL`,`SANITY_${role}_PASSWORD`])];
 const missing=names.filter(name=>!process.env[name]);
 if(missing.length)throw new Error("Missing production SANITY credentials: "+missing.join(", "));
 const url=new URL(process.env.SANITY_SUPABASE_URL);
 if(url.protocol!=="https:"||!url.hostname.endsWith(".supabase.co"))
  throw new Error("Production SANITY Supabase URL must be secure.");
}
console.log("Production read-only QA target approved; mutation-capable suites disabled.");
