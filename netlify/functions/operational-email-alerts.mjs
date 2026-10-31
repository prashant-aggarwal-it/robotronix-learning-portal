import {createClient} from "@supabase/supabase-js";
import {randomUUID} from "node:crypto";

// Runs on Netlify's server only. No customer/financial payloads are emailed.
const expectedJobs={
 "process-reminders":5,
 "zoom-auto-reconcile":5,
 "zoom-retention":1440,
 "system-log-retention":1440
};
const elapsedMinutes=(iso)=>Math.max(0,(Date.now()-new Date(iso).getTime())/60000);
const safeCode=(value)=>String(value||"UNCLASSIFIED").replace(/[^A-Z0-9_]/g,"").slice(0,60)||"UNCLASSIFIED";

async function sendEmail(recipient,from,apiKey,subject,body){
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",cache:"no-store",
  headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},
  body:JSON.stringify({from,to:[recipient],subject,text:body})
 });
 if(!response.ok)throw new Error("EMAIL_PROVIDER_HTTP_"+response.status);
}

async function dispatch(db,kind,recipient,from,apiKey,subject,body,windowMs){
 const referenceId=randomUUID();
 const dedupeKey=kind+":"+Math.floor(Date.now()/windowMs);
 const {error:claimError}=await db.from("portal_alert_dispatches").insert({
  dedupe_key:dedupeKey,category:kind,status:"claimed",reference_id:referenceId
 });
 if(claimError?.code==="23505")return "deduplicated";
 if(claimError)throw new Error("ALERT_OUTBOX_CLAIM_FAILED");
 try{
  await sendEmail(recipient,from,apiKey,subject,body);
  const {error:markError}=await db.from("portal_alert_dispatches").update({
   status:"sent",completed_at:new Date().toISOString()
  }).eq("dedupe_key",dedupeKey);
  if(markError)console.error("[operational-email-alerts] delivery status write failed",{referenceId,code:markError.code||"unknown"});
  console.info("[operational-email-alerts] email sent",{kind,referenceId});
  return "sent";
 }catch{
  await db.from("portal_alert_dispatches").update({
   status:"failed",failure_code:"EMAIL_DELIVERY_FAILED",completed_at:new Date().toISOString()
  }).eq("dedupe_key",dedupeKey);
  console.error("[operational-email-alerts] provider delivery failed",{kind,referenceId});
  return "failed";
 }
}

export default async ()=>{
 const started=Date.now();
 const recipient=process.env.ROBOTRONIX_ALERT_TO_EMAIL?.trim()||"";
 const from=process.env.ROBOTRONIX_ALERT_FROM_EMAIL?.trim()||"";
 const apiKey=process.env.RESEND_API_KEY?.trim()||"";
 if(!recipient||!from||!apiKey){
  console.info("[operational-email-alerts] disabled: alert recipient, verified sender, or email API key missing");
  return Response.json({ok:true,enabled:false});
 }
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))
  return Response.json({ok:false,error:"Alert email configuration invalid."},{status:503});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return Response.json({ok:false,error:"Alert database configuration unavailable."},{status:503});
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const since=new Date(Date.now()-30*60000).toISOString();
  const [{data:events,error:eventError},...jobResults]=await Promise.all([
   db.from("portal_system_logs").select("error_code,reference_id,source,occurred_at")
    .eq("level","error").gte("occurred_at",since).neq("source","email-alerts")
    .order("occurred_at",{ascending:false}).limit(40),
   ...Object.keys(expectedJobs).map(jobName=>db.from("portal_job_runs")
    .select("started_at,status,failed").eq("job_name",jobName)
    .order("started_at",{ascending:false}).limit(1).maybeSingle())
  ]);
  if(eventError||jobResults.some(result=>result.error))
   throw new Error("ALERT_MONITOR_QUERY_FAILED");
  const overdue=Object.keys(expectedJobs).filter((name,index)=>{
   const run=jobResults[index].data;
   return !run||elapsedMinutes(run.started_at)>Math.max(15,expectedJobs[name]*1.5);
  });
  const failed=Object.keys(expectedJobs).filter((name,index)=>{
   const run=jobResults[index].data;
   return run&&(run.status==="failed"||run.status==="partial"||Number(run.failed)>0);
  });
  const base="Robotronix Learning Portal operational alert\n\n";
  const guidance="\nReview Admin > System Logs, the job execution history, and Netlify function logs. This notification contains no user data or provider credentials.\n";
  const results=[];
  if((events||[]).length){
   const grouped=new Map();
   for(const item of events||[]){const code=safeCode(item.error_code);grouped.set(code,(grouped.get(code)||0)+1);}
   const list=Array.from(grouped).slice(0,12).map(([code,count])=>"- "+code+": "+count).join("\n");
   const refs=(events||[]).slice(0,5).map(item=>String(item.reference_id).slice(0,40)).join(", ");
   results.push(await dispatch(db,"critical-errors",recipient,from,apiKey,
    "[Robotronix] Critical portal errors detected",
    base+"Errors recorded in the last 30 minutes: "+events.length+"\n"+list+"\nReference IDs: "+refs+guidance,60*60000));
  }
  if(overdue.length||failed.length){
   results.push(await dispatch(db,"job-heartbeat",recipient,from,apiKey,
    "[Robotronix] Scheduled job health needs attention",
    base+"Missing/overdue jobs: "+(overdue.join(", ")||"None")+"\nFailed/partial latest runs: "+(failed.join(", ")||"None")+guidance,
    6*60*60000));
  }
  console.info("[operational-email-alerts] sweep",{errors:(events||[]).length,overdue:overdue.length,failed:failed.length,results,durationMs:Date.now()-started});
  return Response.json({ok:true,enabled:true,results});
 }catch{
  console.error("[operational-email-alerts] sweep failed",{code:"ALERT_MONITOR_FAILED",durationMs:Date.now()-started});
  return Response.json({ok:false,error:"Alert monitor unavailable."},{status:500});
 }
};
export const config={schedule:"*/15 * * * *"};
