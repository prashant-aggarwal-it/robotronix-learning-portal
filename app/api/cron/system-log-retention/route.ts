import {NextRequest,NextResponse} from "next/server";
import {zoomServiceClient} from "@/lib/server/zoom";
import {logSystemEvent} from "@/lib/server/system-log";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const secret=process.env.INTERNAL_CRON_SECRET;
 if(!secret||request.headers.get("x-robotronix-cron-secret")!==secret)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
 const started=Date.now();
 let status:"success"|"failed"="success",failureCode:string|null=null,processed=0;
 const db=zoomServiceClient();
 try{
  for(const fn of ["purge_old_portal_system_logs","purge_old_portal_job_runs"]){
   const {data,error}=await db.rpc(fn,{p_retention_days:30});
   if(error){status="failed";failureCode="LOG_RETENTION_RPC_FAILED";break;}
   processed+=Number(data||0);
  }
 }catch{status="failed";failureCode="LOG_RETENTION_REQUEST_FAILED";}
 const {error:historyError}=await db.from("portal_job_runs").insert({job_name:"system-log-retention",started_at:new Date(started).toISOString(),finished_at:new Date().toISOString(),status,processed,succeeded:status==="success"?processed:0,failed:status==="failed"?1:0,duration_ms:Date.now()-started,reference_id:crypto.randomUUID(),error_code:failureCode});
 if(historyError)return NextResponse.json({ok:false,error:"Unable to record retention job heartbeat"},{status:503});
 if(status==="failed")await logSystemEvent({source:"system-log-retention",action:"purge",code:failureCode||"RETENTION_FAILED",message:"Operational log retention failed"});
 return NextResponse.json({ok:status==="success",status,processed},{status:status==="success"?200:500});
}
