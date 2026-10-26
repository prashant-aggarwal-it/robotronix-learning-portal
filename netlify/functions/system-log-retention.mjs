import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";
// Daily bounded cleanup. Only service-role can execute the retention SQL functions.
export default async ()=>{
 const started=Date.now(),reference=randomUUID();
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){console.error("[system-log-retention] configuration unavailable",reference);return Response.json({ok:false,reference},{status:500});}
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [logs,jobs]=await Promise.all([
   db.rpc("purge_old_portal_system_logs",{p_retention_days:90}),
   db.rpc("purge_old_portal_job_runs",{p_retention_days:30})
  ]);
  const failed=Boolean(logs.error||jobs.error),duration_ms=Date.now()-started;
  console[failed?"error":"info"]("[system-log-retention]",JSON.stringify({status:failed?"failed":"success",logs_purged:logs.error?null:logs.data,jobs_purged:jobs.error?null:jobs.data,duration_ms,reference}));
  const {error:writeError}=await db.from("portal_job_runs").insert({job_name:"system-log-retention",started_at:new Date(started).toISOString(),status:failed?"failed":"success",processed:0,succeeded:failed?0:1,failed:failed?1:0,reference_id:reference,error_code:failed?"LOG_RETENTION_FAILED":null,duration_ms});
  if(writeError)console.error("[system-log-retention] history unavailable",reference,writeError.code||"unknown");
  if(failed){await db.from("portal_system_logs").insert({source:"background-job",action:"system-log-retention",level:"error",error_code:"LOG_RETENTION_FAILED",reference_id:reference,safe_message:"Automated operational log retention cleanup failed."});}
  return Response.json({ok:!failed,reference,logs_purged:logs.error?null:logs.data,jobs_purged:jobs.error?null:jobs.data},{status:failed?500:200});
 }catch{
  console.error("[system-log-retention] unexpected failure",reference);
  return Response.json({ok:false,reference},{status:500});
 }
};
export const config={schedule:"30 3 * * *"};
