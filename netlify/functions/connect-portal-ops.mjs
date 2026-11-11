import {createClient} from "@supabase/supabase-js";

// Optional CRM + Portal installation only. Do not run in standalone CRM.
// Enable after both schemas/integration SQL exist and disable overlapping pg_cron jobs.
const operations=[
 ["connect_process_portal_demo_followups",100],
 ["connect_reconcile_portal_enrollments",100],
 ["connect_sync_portal_lifecycle",500]
];
export default async () => {
 if(process.env.CONNECT_PORTAL_JOBS_ENABLED!=="true")
  return Response.json({ok:true,enabled:false,job:"connect-portal-ops"});
 const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){
  console.error("[connect-portal-ops]",{status:"failed",code:"CONFIG_MISSING"});
  return Response.json({ok:false,error:"Scheduler configuration unavailable"},{status:503});
 }
 try{
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const results=[];
  for(const [name,batch] of operations){
   const {data,error}=await db.rpc(name,{p_batch_size:batch});
   if(error){
    console.error("[connect-portal-ops]",{status:"failed",job:name,code:error.code||"RPC_FAILED"});
    results.push({job:name,ok:false});
   }else{
    results.push({job:name,ok:true,result:data});
   }
  }
  const ok=results.every(r=>r.ok);
  console.info("[connect-portal-ops]",{status:ok?"success":"partial",succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length});
  return Response.json({ok,enabled:true,results},{status:ok?200:503});
 }catch{
  console.error("[connect-portal-ops]",{status:"failed",code:"UNEXPECTED"});
  return Response.json({ok:false,error:"CRM Portal background processing unavailable"},{status:503});
 }
};
export const config={schedule:"*/5 * * * *"};
