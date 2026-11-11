import {schedulerCapabilityEnabled,netlifyJobOwned} from "../../lib/platform/scheduler-capabilities.mjs";
import {createClient} from "@supabase/supabase-js";

// This schedule is provisioned by Netlify, not pg_cron. The module must be installed first.
// Opt in only once equivalent Supabase cron jobs for this database are disabled.
export default async () => {
 if(!schedulerCapabilityEnabled("crm"))return Response.json({ok:true,enabled:false,job:"module-disabled"});
 if(!netlifyJobOwned("CONNECT_SCHEDULER_ENABLED"))
  return Response.json({ok:true,enabled:false,job:"connect-reminders"});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){
  console.error("[connect-reminders]",{status:"failed",code:"CONFIG_MISSING"});
  return Response.json({ok:false,error:"Scheduler configuration unavailable"},{status:503});
 }
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("connect_run_reminders",{p_batch_size:500});
  if(error){
   console.error("[connect-reminders]",{status:"failed",code:error.code||"RPC_FAILED"});
   return Response.json({ok:false,error:"CRM reminders unavailable"},{status:503});
  }
  console.info("[connect-reminders]",{status:"success"});
  return Response.json({ok:true,enabled:true,result:data});
 }catch{
  console.error("[connect-reminders]",{status:"failed",code:"UNEXPECTED"});
  return Response.json({ok:false,error:"CRM reminders unavailable"},{status:503});
 }
};
export const config={schedule:"*/5 * * * *"};
