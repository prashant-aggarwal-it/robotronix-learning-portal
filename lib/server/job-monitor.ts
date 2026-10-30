import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";

type JobResult={
 jobName:"process-reminders"|"zoom-retention"|"zoom-auto-reconcile"|"system-log-retention";
 status:"success"|"partial"|"failed";
 processed?:number;succeeded?:number;failed?:number;
 startedAt?:string;durationMs?:number;errorCode?:string;referenceId?:string;
};
const count=(n:number|undefined)=>Number.isFinite(n)&&Number(n)>=0?Math.floor(Number(n)):0;
export async function recordJobRun(input:JobResult):Promise<void>{
 const reference=input.referenceId||randomUUID();
 const row={
  job_name:input.jobName,status:input.status,reference_id:reference,
  started_at:input.startedAt||new Date().toISOString(),
  finished_at:new Date().toISOString(),processed:count(input.processed),
  succeeded:count(input.succeeded),failed:count(input.failed),
  duration_ms:input.durationMs==null?null:count(input.durationMs),
  error_code:input.errorCode||null
 };
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){console.error("[job-monitor] DB configuration missing",reference);return;}
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from("portal_job_runs").insert(row);
  if(error)console.error("[job-monitor] write failed",reference,error.code||"unknown");
 }catch{console.error("[job-monitor] unexpected failure",reference);}
}
