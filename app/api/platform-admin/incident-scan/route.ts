import {NextRequest,NextResponse} from "next/server";
import {requirePlatformAdmin} from "@/lib/server/saas/platform-admin";
import {SaaSAccessError} from "@/lib/server/saas/organization-context";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Vary":"Authorization"};
export async function POST(req:NextRequest){
 try{
  const {db,userId}=await requirePlatformAdmin(req.headers.get("authorization"));
  const {data:worker,error:workerError}=await db.rpc("saas_platform_worker_health_v1");
  const {data:customer,error:customerError}=await db.rpc("saas_platform_customer_health_v1");
  if(workerError||customerError)throw new SaaSAccessError(503,"Signals unavailable");
  const signals:{fingerprint:string;title:string;category:string;severity:string}[]=[];
  if(Number(worker?.queue?.staleSending||0)>0)signals.push({fingerprint:"worker:stale_sending",title:"Email notifications stuck in sending",category:"worker",severity:"warning"});
  if(Number(worker?.queue?.oldestWaitMinutes||0)>30&&Number(worker?.queue?.due||0)>0)signals.push({fingerprint:"worker:overdue_queue",title:"Email notification queue overdue",category:"worker",severity:"warning"});
  if(Number(customer?.deliveries?.failed||0)>0)signals.push({fingerprint:"activation:delivery_failures",title:"Customer invitation delivery failures recorded",category:"email",severity:"warning"});
  // Stale heartbeat alone is not an incident: scheduler activation hasn't been verified.
  const recorded:string[]=[];
  for(const s of signals){
   const {error}=await db.rpc("saas_platform_incidents_v1",{p_actor:userId,p_action:"create",p_id:null,p_fingerprint:s.fingerprint,p_title:s.title,p_category:s.category,p_severity:s.severity});
   if(error)throw new SaaSAccessError(503,"Unable to record monitoring signal");
   recorded.push(s.fingerprint);
  }
  return NextResponse.json({ok:true,observedAt:new Date().toISOString(),detected:signals.length,recorded},{headers});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof SaaSAccessError?e.message:"Signal scan unavailable"},{status:e instanceof SaaSAccessError?e.status:503,headers});}
}
